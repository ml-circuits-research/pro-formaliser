import {serialize,str} from '../.cache/knowledge/tools/sopworld/sopworld.mjs';
import {tokens} from './lexicon.mjs';
import {quotedSpans} from './literal-roles.mjs';

const type=name=>'w.request.'+name;
const quote=JSON.stringify;
const word=/^[\p{L}\p{M}\p{N}_]+$/u;
const terminal=new Set(['.','!']);
const values=(wire,key)=>(wire.attrs[key] ?? []).map(str);
const terms=text=>tokens(text).map(([term])=>term);
const matches=(input,at,words)=>words.every((term,i)=>input[at+i]===term);

export function compileStandingPositions(facts,catalog) {
  return facts('pro.reader.standing_position').flatMap(wire=>{
    const [scopeKey]=values(wire,'scope_attribute');
    const tabs=new Set(catalog.filter(key=>key.name===scopeKey && key.family==='preference' &&
      key.head==='span' && !key.values.length).map(key=>key.tab));
    if (!tabs.size) return [];
    const scopes=values(wire,'scope').map(terms).filter(words=>words.length);
    const wrappers=[[],...values(wire,'wrapper').map(terms)];
    const predicates=values(wire,'predicate').map(terms).filter(words=>words.length);
    const bodyLeads=[[],...values(wire,'body_lead').map(terms)];
    const exclusions=values(wire,'exclusion').map(terms).filter(words=>words.length);
    return [{tabs,scopeKey,scopes,wrappers,predicates,bodyLeads,exclusions}];
  });
}

function owners(input,from,to,worlds,learned) {
  const nominal=input.slice(from,to), [article]=nominal;
  const determiner=Object.hasOwn(worlds.determiners,article) && worlds.determiners[article];
  if (!['definite','demonstrative','possessive'].includes(determiner) || nominal.length<2 ||
      nominal.some(term=>!word.test(term) || worlds.joiners[term] || worlds.negatives.has(term))) return [];
  const families=new Set();
  for (let head=1;head<nominal.length;head++) {
    const surface=nominal.slice(head).join(' ');
    for (const [role,,family] of [...worlds.lookup(surface),...(Object.hasOwn(learned,surface) ? learned[surface] : [])]) {
      if (role==='target' && worlds.literalGrammar.licenses(family,'change')) families.add(family);
    }
  }
  return [...families].map(family=>({family,determiner}));
}

function regions(input,at,end,worlds,family,tabs) {
  return (worlds.nominalPositions.get(family)?.get(input[at]) ?? []).filter(([surface,attribute,, ,operator])=>
    operator==='region' && at+surface.length===end && matches(input,at,surface) &&
    worlds.requestKeys.some(key=>key.name===attribute && key.family===family && tabs.has(key.tab)));
}

function* standingHeads(input,stop,frames) {
  for (const frame of frames) for (const scope of frame.scopes) {
    if (!matches(input,0,scope)) continue;
    for (const wrapper of frame.wrappers) {
      const boundary=scope.length+wrapper.length;
      if (!matches(input,scope.length,wrapper) || ![',',':','—','–'].includes(input[boundary])) continue;
      for (const lead of frame.bodyLeads) {
        const first=boundary+1+lead.length;
        if (!matches(input,boundary+1,lead)) continue;
        for (let head=first+2;head<Math.min(first+9,stop-1);head++) for (const predicate of frame.predicates) {
          if (matches(input,head,predicate)) yield {frame,scope,wrapper,boundary,first,head,at:head+predicate.length};
        }
      }
    }
  }
}

function regionConstraints(input,at,stop,worlds,family,frame,span) {
  const comma=input.indexOf(',',at), end=comma<0 ? stop : comma;
  const placement=regions(input,at,end,worlds,family,frame.tabs);
  if (placement.length!==1) return;
  const [,attribute,value]=placement[0];
  const records=[{id:'placement',type:type('constraint'),attrs:{request:['$r'],on:['attribute'],
    attribute:[attribute],value:[value],operator:['region'],phase:['result'],words:[quote(span(at,end))]}}];
  let pending=end+(comma>=0 ? 1 : 0);
  if (pending<stop) {
    const cue=frame.exclusions.find(words=>matches(input,pending,words));
    const next=input.indexOf(',',pending), denialEnd=next<0 ? stop : next;
    const excluded=cue ? regions(input,pending+cue.length,denialEnd,worlds,family,frame.tabs) : [];
    if (excluded.length!==1 || excluded[0][1]!==attribute || excluded[0][2]===value) return;
    records.push({id:'excluded',type:type('constraint'),attrs:{...records[0].attrs,
      value:[excluded[0][2]],want:['no'],words:[quote(span(pending,denialEnd))]}});
    pending=next<0 ? stop : next+1;
  }
  return {records,pending};
}

export function standingPositionReadings(text,worlds,learned) {
  const ts=tokens(text), input=ts.map(([term])=>term), chars=Array.from(text);
  if (input.length<6 || input.includes('?') || quotedSpans(text).length) return [];
  const span=(start,end)=>chars.slice(ts[start][2],ts[end-1][3]).join('');
  const stop=input.length-Number(terminal.has(input.at(-1)));
  const readings=[];
  for (const {frame,scope,wrapper,boundary,first,head,at} of standingHeads(input,stop,worlds.standingPositions)) {
    if ([...worlds.scopeGrammar.conditionals.keys()].some(form=>{
      const words=form.split(' ');
      return input.some((_,i)=>i>=first && matches(input,i,words));
    })) continue;
    for (const {family,determiner} of owners(input,first,head,worlds,learned)) {
      const position=regionConstraints(input,at,stop,worlds,family,frame,span);
      if (!position) continue;
      const {records,pending}=position;
      const wires=[{id:'r',type:type('request'),attrs:{act:['change'],mood:['do'],
        predicate:[quote(span(head,at))],words:[quote(text)]}},
      {id:'t',type:type('target'),attrs:{request:['$r'],family:[family],mode:['existing'],fill:['description'],
        determiner:[determiner],description:[quote(span(first,head))]}},
      {id:'l',type:type('lookup'),attrs:{request:['$r'],target:['$t'],key:['thing'],from:['page']}},
      {id:'scope',type:type('constraint'),attrs:{request:['$r'],on:['attribute'],attribute:[frame.scopeKey],
        value:[quote(span(0,scope.length))],operator:['eq'],phase:['result']}},...records];
      if (wrapper.length) wires.push({id:'wrapper',type:type('filler'),attrs:{text:[quote(span(scope.length,boundary))]}});
      if (pending<stop) wires.push({id:'u',type:type('unread'),attrs:{request:['$r'],text:[quote(span(pending,stop))]}});
      readings.push({sop:serialize(wires),source:'standing-position',status:pending<stop ? 'partial' : 'matched'});
    }
  }
  return readings;
}
