import { tokens } from './lexicon.mjs';
import { quotedSpans } from './literal-roles.mjs';
import { literalRanges } from './evidence.mjs';
import { evidenceInText } from './grounding.mjs';
import { parse, serialize } from '../.cache/knowledge/tools/sopworld/sopworld.mjs';

const quote=JSON.stringify;
const decode=value=>value?.startsWith('"') ? JSON.parse(value) : value;
const fields=(wire,key)=>(wire.attrs[key] ?? []).map(decode);
const one=(wire,key)=>fields(wire,key)[0];
const keyOf=text=>tokens(text).map(([key])=>key).join(' ');
const word=/^[\p{L}\p{M}\p{N}_]+$/u;
const atom=/^[\p{L}_][\p{L}\p{M}\p{N}_.-]*$/u;
const boundary=new Set([',',';','—','–']);
const request='w.request.request';
const target='w.request.target';
const filler='w.request.filler';
const unread='w.request.unread';

export function compilePreservationAdjuncts(facts,requestKeys) {
  const cues=new Map(facts('w.lang.en.cue').filter(wire=>one(wire,'on')==='reaction' &&
    one(wire,'value')==='keep').map(wire=>[one(wire,'name'),new Set(fields(wire,'lead').map(keyOf))]));
  const frames=[];
  for (const wire of facts('pro.reader.retention')) {
    const native=cues.get(one(wire,'cue')), value=one(wire,'value');
    if (!native || !atom.test(value ?? '')) continue;
    const leads=new Set();
    for (const expression of fields(wire,'lead')) {
      const [base,adjunct,...extra]=expression.split(':').map(keyOf);
      if (!native.has(base) || !adjunct || extra.length) continue;
      leads.add(base);
      leads.add(adjunct);
    }
    const tails=new Set(fields(wire,'tail').map(keyOf).filter(Boolean));
    const scopeLeads=new Set(fields(wire,'scope_lead').map(keyOf).filter(Boolean));
    const scopeKey=one(wire,'scope_attribute');
    if (!leads.size || !tails.size && !(scopeLeads.size && scopeKey)) continue;
    const keys=new Map();
    for (const binding of facts('pro.reader.preservation')) {
      const family=one(binding,'family'), name=one(binding,'attribute');
      if (!requestKeys.some(key=>key.family===family && key.name===name &&
        key.head==='class' && key.values.includes(value) && (!scopeKey || requestKeys.some(scope=>
          scope.name===scopeKey && scope.tab===key.tab && scope.head==='span' && !scope.values.length)))) continue;
      const options=keys.get(family) ?? new Set();
      options.add(name);
      keys.set(family,options);
    }
    frames.push({value,leads,tails,keys,scopeLeads,scopeKey,remainder:new Set(fields(wire,'remainder').map(keyOf))});
  }
  return frames;
}

function* scopedRetentionMatches(ts,begin,stop,worlds,span,term,hidden) {
  if (worlds.joiners[ts[begin-1][0]]!=='coordination') return;
  const before=boundary.has(ts[begin-2][0]) ? begin-2 : begin-1;
  if (!before || !ts.slice(begin,stop).every(([key],i)=>word.test(key) && !hidden(begin+i))) return;
  const body=span(0,before), suffix=span(begin,stop);
  for (const frame of worlds.preservationAdjuncts.filter(frame=>frame.scopeKey)) {
    for (let head=begin+1;head<Math.min(begin+5,stop-2);head++) {
      if (!frame.leads.has(term(begin,head))) continue;
      for (let marker=head+1;marker<Math.min(head+5,stop-1);marker++) {
        if (worlds.sequenceObjectPronouns.get(term(head,marker))!=='sg') continue;
        for (let operand=marker+1;operand<stop;operand++) {
          if (!frame.scopeLeads.has(term(marker,operand)) || ts.slice(operand,stop).some(([key])=>
            worlds.joiners[key] || worlds.negatives.has(key) || worlds.scopeGrammar.conditionals.has(key))) continue;
          yield {body,suffix,predicate:span(begin,head),target:span(head,marker),value:frame.value,scope:'bound',
            scopeKey:frame.scopeKey,scopeWords:span(marker,stop),keys:frame.keys};
        }
      }
    }
  }
}

export function preservationAdjunct(text,worlds) {
  if (!worlds.preservationAdjuncts?.length) return;
  const ts=tokens(text), chars=Array.from(text), quotes=quotedSpans(text);
  const span=(a,b)=>chars.slice(ts[a][2],ts[b-1][3]).join('');
  const term=(a,b)=>ts.slice(a,b).map(([key])=>key).join(' ');
  const hidden=i=>quotes.some(q=>q.start<ts[i][3] && ts[i][2]<q.end);
  let stop=ts.length;
  while (stop && ['.','!'].includes(ts[stop-1][0]) && !hidden(stop-1)) stop--;
  if (stop<5 || ts[stop-1][0]==='?') return;
  const matches=new Map();
  for (let begin=Math.max(2,stop-22);begin<stop-2;begin++) {
    if (hidden(begin-1) || hidden(begin)) continue;
    let first=begin, split=begin-1;
    if (worlds.joiners[ts[first][0]]==='contrast') first++;
    for (const matched of scopedRetentionMatches(ts,begin,stop,worlds,span,term,hidden)) {
      const {body,suffix,predicate,target,value,scopeKey,scopeWords}=matched;
      matches.set(JSON.stringify([body,suffix,predicate,target,value,scopeKey,scopeWords]),matched);
    }
    if (!boundary.has(ts[split][0])) {
      if (first===begin) continue;
      split=begin;
    }
    if (first>=stop-2 || split===0 || ts.slice(0,split).some(([key],i)=>key==='?' && !hidden(i))) continue;
    const condition=[...worlds.scopeGrammar.conditionals.keys()].some(form=>{
      const terms=form.split(' ');
      return ts.slice(0,split).some((_,start)=>start+terms.length<=split &&
        terms.every((key,i)=>ts[start+i][0]===key && !hidden(start+i)));
    });
    if (condition) continue;
    for (const frame of worlds.preservationAdjuncts) {
      for (let head=first+1;head<Math.min(first+5,stop-1);head++) {
        if (!frame.leads.has(term(first,head))) continue;
        for (let tail=head+1;tail<stop;tail++) {
          if (hidden(tail) || !frame.tails.has(term(tail,stop))) continue;
          const label=span(head,tail);
          const explicit=quotes.find(q=>q.start===ts[head][2] && q.end===ts[tail-1][3]);
          const scope=frame.remainder.has(term(head,tail)) && !explicit ? 'remainder' : 'named';
          const nominal=ts.slice(head,tail);
          const classified=nominal.every(([key,raw])=>word.test(key) &&
            (/^\p{Lu}/u.test(raw) || /\p{L}/u.test(raw) && /\p{N}/u.test(raw)) &&
            !worlds.evidenceVocabulary.grammar.has(key));
          if (scope==='named' && !explicit && (!classified || nominal.some((_,i)=>hidden(head+i)))) continue;
          const body=span(0,split), suffix=span(first,stop), predicate=span(first,head);
          const name=explicit?.value ?? label;
          if (scope==='named' && !/\p{L}/u.test(name)) continue;
          const signature=JSON.stringify([body,suffix,predicate,name,frame.value,scope]);
          matches.set(signature,{body,suffix,predicate,target:name,value:frame.value,scope,keys:frame.keys});
        }
      }
    }
  }
  return matches.size===1 ? [...matches.values()][0] : undefined;
}

export function preservationAdjunctReading(text,split,candidate,worlds) {
  if (!candidate?.sop) return;
  const bodyRanges=literalRanges(text,split.body), suffixRanges=literalRanges(text,split.suffix);
  if (bodyRanges.length!==1 || suffixRanges.length!==1) return;
  const [[start,stop]]=bodyRanges, [[suffixStart,suffixEnd]]=suffixRanges;
  if (stop>=suffixStart) return;
  const tailEnd=/^[\s.!]*$/u.test(text.slice(suffixEnd)) ? text.length : suffixEnd;
  const removed=new Set();
  const wires=[];
  for (const wire of parse(candidate.sop)) {
    if ([filler,unread].includes(wire.type)) {
      const written=one(wire,'text');
      const hits=literalRanges(text,written);
      if (hits.length===1) {
        const [[a,b]]=hits;
        if (suffixStart<=a && a<suffixEnd && b<=tailEnd) {
          removed.add('$'+wire.id);
          continue;
        }
        if (wire.type===unread && a>=start && a<stop && b>suffixStart && b<=tailEnd &&
            !wire.attrs.note && !wire.attrs.value && !wire.attrs.n) {
          wire.attrs.text=[quote(text.slice(a,stop))];
        }
      }
    }
    wires.push(wire);
  }
  if (removed.size && wires.some(wire=>Object.values(wire.attrs).flat().some(value=>removed.has(value)))) return;
  const requests=wires.filter(wire=>wire.type===request);
  const last=requests.at(-1);
  if (!last || ![undefined,'do'].includes(one(last,'mood'))) return;
  const targets=wires.filter(wire=>wire.type===target && wire.attrs.request?.[0]==='$'+last.id);
  if (targets.length!==1) return;
  const family=one(targets[0],'family'), keys=split.keys.get(family);
  if (keys?.size!==1 || !worlds.literalGrammar.licenses(family,one(last,'act')) ||
    !worlds.literalGrammar.licenses(family,'change')) return;
  if (split.scope==='remainder' && requests.some(req=>{
    const local=wires.filter(wire=>wire.type===target && wire.attrs.request?.[0]==='$'+req.id);
    return local.length!==1 || one(local[0],'family')!==family;
  })) return;
  let cursor=start;
  for (const req of requests) {
    const words=one(req,'words');
    if (!words && requests.length===1) {
      req.attrs.words=[quote(split.body)];
      continue;
    }
    const hits=literalRanges(text,words);
    if (hits.length!==1) return;
    const [[a,b]]=hits;
    if (a<cursor || a>=stop) return;
    if (b>stop) {
      if (req!==last || b>tailEnd) return;
      req.attrs.words=[quote(text.slice(a,stop))];
    }
    cursor=Math.min(b,stop);
  }
  // Any inferred action, property or relation must still have its evidence
  // inside the original base clause after removing preservation bookkeeping.
  const body=serialize(wires);
  if (!evidenceInText(split.body,body,worlds)) return;
  const [key]=keys;
  if (split.scope==='bound') {
    const [owner]=targets;
    if (requests.length!==1 || one(owner,'mode')!=='existing' ||
        !['written','description'].includes(one(owner,'fill')) || (owner.attrs.ids?.length ?? 0)>1 ||
        owner.attrs.quantifier || owner.attrs.quantity || Number(one(owner,'count') ?? 1)!==1 ||
        !wires.some(w=>w.type==='w.request.constraint' && one(w,'request')==='$'+last.id &&
          one(w,'phase')==='result' && one(w,'want')!=='no' && one(w,'attribute')!==key)) return;
  }
  const usesPrior=split.scope==='bound';
  let id='preserve';
  while (wires.some(wire=>wire.id===id || wire.id.startsWith(id+'.'))) id+='_';
  const description=split.scope==='remainder' ? 'fill=description description=' : 'fill=written name=';
  // The open selector is resolved against the current page. It does not expand
  // the rest of the scene into new targets or assert a universal target.
  const suffix=[
    '@'+id+' '+request+' act=change mood=do predicate='+quote(split.predicate)+' words='+quote(split.suffix),
    '@'+id+'.t '+target+' request=$'+id+' family='+quote(family)+(usesPrior ?
      ' mode=bound family_words=' : ' mode=existing '+description)+quote(split.target),
    ...usesPrior ? [] : ['@'+id+'.l w.request.lookup request=$'+id+' target=$'+id+'.t key=thing from=page'],
    '@'+id+'.c w.request.constraint request=$'+id+' on=attribute attribute='+quote(key)+
      ' value='+split.value+' words='+quote(split.suffix)+' operator=eq phase=result',
    ...usesPrior ? ['@'+id+'.scope w.request.constraint request=$'+id+' on=attribute attribute='+quote(split.scopeKey)+
      ' value='+quote(split.scopeWords)+' operator=eq phase=result'] : [],
  ].join('\n');
  return {sop:body+'\n'+suffix,
    source:'preservation-adjunct',status:usesPrior ? (wires.some(w=>w.type===unread) ? 'partial' : 'matched') : candidate.status};
}
