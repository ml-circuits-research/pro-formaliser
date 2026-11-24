import { tokens } from './lexicon.mjs';
import { quotedSpans } from './literal-roles.mjs';
import { literalRanges } from './evidence.mjs';
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
    if (!leads.size || !tails.size) continue;
    const keys=new Map();
    for (const binding of facts('pro.reader.preservation')) {
      const family=one(binding,'family'), name=one(binding,'attribute');
      if (!requestKeys.some(key=>key.family===family && key.name===name &&
        key.head==='class' && key.values.includes(value))) continue;
      const options=keys.get(family) ?? new Set();
      options.add(name);
      keys.set(family,options);
    }
    frames.push({value,leads,tails,keys,remainder:new Set(fields(wire,'remainder').map(keyOf))});
  }
  return frames;
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
  if (!candidate?.sop || !literalRanges(text,split.suffix).length) return;
  const wires=parse(candidate.sop);
  const requests=wires.filter(wire=>wire.type===request);
  const last=requests.at(-1);
  if (!last || ![undefined,'do'].includes(one(last,'mood'))) return;
  const targets=wires.filter(wire=>wire.type===target && wire.attrs.request?.[0]==='$'+last.id);
  if (targets.length!==1) return;
  const family=one(targets[0],'family'), keys=split.keys.get(family);
  if (keys?.size!==1 || !worlds.literalGrammar.licenses(family,one(last,'act')) ||
    !worlds.literalGrammar.licenses(family,'change')) return;
  for (const req of requests) {
    const words=one(req,'words');
    if (!words && requests.length===1) req.attrs.words=[quote(split.body)];
    else if (!words || literalRanges(split.body,words).length!==1) return;
  }
  const [key]=keys;
  let id='preserve';
  while (wires.some(wire=>wire.id===id || wire.id.startsWith(id+'.'))) id+='_';
  const description=split.scope==='remainder' ? 'fill=description description=' : 'fill=written name=';
  // The open selector is resolved against the current page. It does not expand
  // the rest of the scene into new targets or assert a universal target.
  const suffix=[
    '@'+id+' '+request+' act=change mood=do predicate='+quote(split.predicate)+' words='+quote(split.suffix),
    '@'+id+'.t '+target+' request=$'+id+' family='+quote(family)+' mode=existing '+description+quote(split.target),
    '@'+id+'.l w.request.lookup request=$'+id+' target=$'+id+'.t key=thing from=page',
    '@'+id+'.c w.request.constraint request=$'+id+' on=attribute attribute='+quote(key)+
      ' value='+split.value+' words='+quote(split.suffix)+' operator=eq phase=result',
  ].join('\n');
  return {sop:serialize(wires)+'\n'+suffix,
    source:'preservation-adjunct',status:candidate.status};
}
