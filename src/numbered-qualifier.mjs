import { literalRanges } from './evidence.mjs';
import { tokens } from './lexicon.mjs';
import { quotedSpans } from './literal-roles.mjs';
import { consumeUnread } from './nominal-evidence.mjs';
import { parse } from './schema.mjs';
import { serialize } from '../.cache/knowledge/tools/sopworld/sopworld.mjs';

const ns='w.request.';
const quote=JSON.stringify;
const field=(wire,key)=>{
  const value=wire?.attrs[key]?.[0];
  return value?.startsWith('"') ? JSON.parse(value) : value;
};
const selectors=new Set(['pick','remove']);
const results=new Set(['change','place']);
const keyWord=/^[\p{L}\p{M}\p{N}_]+$/u;
const numeric=/^[+-]?(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)$/u;

function measurement(input,at,end,phrase,span,worlds) {
  let found;
  const first=at+(input[at]?.[0]==='=' ? 1 : 0);
  for (let i=first;i<Math.min(first+4,end);i++) {
    const raw=span(first,i+1);
    if (numeric.test(raw)) {
      if (!Number.isFinite(Number(raw))) return;
      found={next:i+1,value:raw};
    }
  }
  if (found) return found;
  for (let i=Math.min(first+8,end);i>first;i--) {
    const entry=worlds.nominalNumbers.get(phrase(first,i));
    if (entry?.kind==='cardinal') return {next:i,value:entry.value,words:span(first,i)};
  }
}

function labelsFor(worlds,family,surface) {
  const aliases=worlds.ownerPropertyLabels?.get(JSON.stringify([surface,family])) ?? [];
  const names=new Set(aliases.filter(label=>label.kinds.includes('number')).map(label=>label.attribute));
  if (names.size!==1) return undefined;
  const [name]=names;
  const keys=worlds.requestKeys.filter(key=>key.family===family && key.name===name);
  return keys.length && keys.every(key=>key.head==='number' && !key.values.length) ? name : undefined;
}

function qualifiers(input,start,end,family,act,shape,worlds) {
  const {phrase,span}=shape;
  const records=[], used=new Set();
  for (let i=start;i<end;) {
    const first=i;
    if (input[i][0]===',') i++;
    const markerAt=i;
    if (results.has(act)) {
      for (let j=Math.min(i+4,end-2);j>i;j--) {
        if (!worlds.lookup(phrase(i,j)).some(([role,sense,slot])=>
          role==='marker' && sense===act && ['place','value'].includes(slot))) continue;
        i=j;
        break;
      }
    }
    if (!records.length && act==='place' && i===markerAt) return [];
    const options=[];
    for (let j=i+1;j<Math.min(i+9,end);j++) {
      if (!keyWord.test(input[j-1][0])) break;
      const attribute=labelsFor(worlds,family,phrase(i,j));
      if (!attribute) continue;
      const measure=measurement(input,j,end,phrase,span,worlds);
      if (measure) options.push({...measure,attribute,label:span(i,j)});
    }
    if (options.length!==1 || used.has(options[0].attribute)) return [];
    const option=options[0];
    used.add(option.attribute);
    records.push({...option,start:input[first][2],stop:input[option.next-1][3]});
    i=option.next;
  }
  return records;
}

function targetEnd(scope,target,headEnd) {
  const groups=[['ids','name','description','code_words'],['family_words','sort_words']];
  for (const slots of groups) {
    const starts=[];
    for (const slot of slots) {
      for (const raw of target.attrs[slot] ?? []) {
        const value=raw.startsWith('"') ? JSON.parse(raw) : raw;
        const ranges=literalRanges(scope,value,headEnd);
        if (ranges.length!==1) return;
        starts.push(ranges[0][1]);
      }
    }
    if (starts.length) return Math.max(...starts);
  }
}

function makeWires(wires,text,request,records,family,phase) {
  const ref='$'+request.id;
  const owned=wires.filter(wire=>wire.type===ns+'constraint' && field(wire,'request')===ref);
  const newRecords=records.filter(record=>!owned.some(wire=>field(wire,'attribute')===record.attribute));
  if (!newRecords.length || records.some(record=>owned.some(wire=>field(wire,'attribute')===record.attribute &&
    (field(wire,'value')!==record.value || (field(wire,'phase') ?? 'result')!==phase)))) return;
  const ids=new Set(wires.map(wire=>wire.id));
  function id(suffix) {
    let result=request.id+suffix;
    for (let i=2;ids.has(result);i++) result=request.id+suffix+i;
    ids.add(result);
    return result;
  }
  const extras=newRecords.map(record=>({
    id:id('.number'),type:ns+'constraint',attrs:{
      request:[ref],on:['attribute'],attribute:[quote(record.attribute)],key_words:[quote(record.label)],
      value:[quote(record.value)],operator:['eq'],phase:[phase],
      ...(record.words ? {words:[quote(record.words)]} : {}),
    }
  }));
  if (family) {
    const targetId=id('.t');
    extras.unshift(
      {id:targetId,type:ns+'target',attrs:{request:[ref],family:[quote(family)],mode:['existing'],
        determiner:['definite'],fill:['context']}},
      {id:id('.l'),type:ns+'lookup',attrs:{request:[ref],target:['$'+targetId],key:['thing'],from:['page']}},
    );
  }
  let remaining=wires;
  for (const record of newRecords) remaining=consumeUnread(remaining,text,record.start,record.stop);
  const all=[...remaining,...extras];
  return {sop:serialize(all),source:'numbered-qualifier',
    status:all.some(wire=>wire.type===ns+'unread') ? 'partial' : 'matched'};
}

export function numberedQualifierReadings(text,candidate,worlds) {
  if (!candidate.sop || !worlds.ownerPropertyLabels?.size || !/\p{N}/u.test(text) &&
      !tokens(text).some(([term])=>worlds.nominalNumbers.get(term)?.kind==='cardinal')) return [];
  const wires=parse(candidate.sop);
  const requests=wires.filter(w=>w.type===ns+'request'), targets=wires.filter(w=>w.type===ns+'target');
  if (requests.length!==1 || targets.length>1) return [];
  const [request]=requests, [target]=targets;
  const act=field(request,'act'), predicate=field(request,'predicate'), mood=field(request,'mood');
  if ((!selectors.has(act) && !results.has(act)) || !predicate || mood && mood!=='do' ||
      target && (field(target,'mode')!=='existing' || field(target,'request')!=='$'+request.id)) return [];
  const scope=field(request,'words') ?? text, ranges=literalRanges(text,scope);
  if (ranges.length!==1) return [];
  const [offset]=ranges[0], input=tokens(scope), chars=Array.from(scope), quotes=quotedSpans(scope);
  if (!input.length) return [];
  const phrase=(a,b)=>input.slice(a,b).map(([key])=>key.replaceAll('’',"'")).join(' ');
  const charSpan=(a,b)=>chars.slice(a,b).join('');
  const span=(a,b)=>charSpan(input[a][2],input[b-1][3]);
  const heads=literalRanges(scope,predicate);
  if (heads.length!==1) return [];
  const [[headAt,headEnd]]=heads;
  const headStart=input.findIndex(([, ,start])=>charSpan(0,start).length===headAt);
  const headStop=input.findIndex(([, , ,end])=>charSpan(0,end).length===headEnd)+1;
  if (headStart<0 || !headStop || !worlds.lookup(phrase(headStart,headStop)).some(([role,sense,mode])=>
    role==='act' && sense===act && (!mode || mode==='do'))) return [];
  const lead=phrase(0,headStart);
  if (lead && !worlds.literalGrammar.leads.has(lead) && !worlds.fillerPhrases.has(lead)) return [];
  const visible=(a,b)=>!quotes.some(q=>q.start<input[b-1][3] && input[a][2]<q.end);
  if (!visible(headStart,headStop)) return [];
  let end=input.length;
  while (['.','!'].includes(input[end-1]?.[0])) end--;
  for (let i=headStop;i<end;i++) {
    if (!visible(i,i+1)) continue;
    for (let j=i+1;j<=Math.min(end,i+5);j++) {
      const key=phrase(i,j);
      if (worlds.negatives.has(key) || worlds.scopeGrammar.negatives.has(key) ||
          worlds.scopeGrammar.conditionals.has(key) || ['sequence','contrast','clause','coordination'].includes(worlds.joiners[key]) ||
          [...worlds.scopeGrammar.endings].some(suffix=>key.replaceAll(' ','').endsWith(suffix))) return [];
    }
  }
  let start, families;
  if (target) {
    const family=field(target,'family'), after=targetEnd(scope,target,headEnd);
    if (!after || !worlds.literalGrammar.licenses(family,act)) return [];
    const quoted=quotes.find(q=>charSpan(0,q.start).length<after && after<charSpan(0,q.end).length);
    const boundary=quoted ? charSpan(0,quoted.end).length : after;
    start=input.findIndex(([, ,position])=>charSpan(0,position).length>=boundary);
    families=[family];
  } else {
    if (!results.has(act) || field(request,'refers')!=='thing') return [];
    for (let i=headStop+1;i<Math.min(headStop+5,end);i++) {
      if (worlds.isReference(phrase(headStop,i))) start=i;
    }
    families=[...new Set(worlds.requestKeys.filter(key=>key.head==='number').map(key=>key.family))];
  }
  if (start===undefined || start<0 || start>=end || !visible(start,end)) return [];
  return families.flatMap(family=>{
    if (!worlds.literalGrammar.licenses(family,act)) return [];
    const records=qualifiers(input,start,end,family,act,{phrase,span},worlds).map(record=>({
      ...record,start:offset+charSpan(0,record.start).length,stop:offset+charSpan(0,record.stop).length,
    }));
    if (!records.length) return [];
    const reading=makeWires(wires,text,request,records,target ? undefined : family,selectors.has(act) ? 'selector' : 'result');
    return reading ? [reading] : [];
  });
}
