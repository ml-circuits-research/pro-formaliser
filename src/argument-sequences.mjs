import {parse,serialize} from '../.cache/knowledge/tools/sopworld/sopworld.mjs';
import {tokens} from './lexicon.mjs';
import {consumeUnread} from './nominal-evidence.mjs';
import {literalRanges} from './evidence.mjs';

const decode=v=>v?.startsWith('"') ? JSON.parse(v) : v;
const many=(w,k)=>(w.attrs[k] ?? []).map(decode);
const one=(w,k)=>many(w,k)[0];
const keys=s=>tokens(s).map(t=>t[0]);
const encode=s=>JSON.stringify(s);

export function argumentSequences(facts,catalog) {
  const forms=new Map();
  for (const w of facts('core.word')) {
    for (const owner of many(w,'of')) {
      if (!forms.has(owner)) forms.set(owner,[]);
      for (const text of many(w,'text')) for (const value of many(w,'means')) forms.get(owner).push([keys(text),value]);
    }
  }
  const index=new Map();
  for (const w of facts('pro.reader.argument_sequence')) {
    const family=one(w,'family'),act=one(w,'act'),mode=one(w,'mode');
    const props=new Map(catalog.filter(k=>k.family===family && k.tab===one(w,'tab')).map(k=>[k.name,k]));
    const parts=many(w,'part').map(p=>{
      const prop=props.get(p);
      if (!prop) {
        const literal=keys(p);
        return p.includes('.') || !literal.length ? null : {literal};
      }
      if (prop.values.length && prop.head.split('+').some(h=>['class','candidate'].includes(h))) {
        const bank=prop.values.map(v=>[keys(v),v]);
        for (const [alias,v] of forms.get(prop.name) ?? []) if (prop.values.includes(v)) bank.push([alias,v]);
        return {key:p,bank};
      }
      return prop.head.split('+').includes('span') && !prop.values.length ? {key:p} : null;
    });
    if (parts.some(p=>!p) || parts.filter(p=>p.key).length<2 ||
        new Set(parts.filter(p=>p.key).map(p=>p.key)).size!==parts.filter(p=>p.key).length) continue;
    for (const prefix of many(w,'prefix').map(keys).filter(prefix=>prefix.length)) {
      const entries=index.get(prefix[0]) ?? [];
      entries.push({prefix,parts,family,act,mode});index.set(prefix[0],entries);
    }
  }
  return index;
}

export function sequencePacket(ts,worlds) {
  const packets=[];
  let stop=ts.length;
  while (stop && ['.','!','?'].includes(ts[stop-1][0])) stop--;
  for (let i=0;i<stop;i++) for (const f of worlds.argumentSequences?.get(ts[i][0]) ?? []) {
    if (!f.prefix.every((word,j)=>ts[i+j]?.[0]===word)) continue;
    const start=i+f.prefix.length, tail=ts.slice(start,stop);
    if (!tail.length || tail.length>32) continue;
    // A family noun in the declared prefix provides the object of the command.
    const hasHead=f.prefix.some((_,a)=>f.prefix.slice(a).some((_,b)=>
      worlds.lookup(f.prefix.slice(a,a+b+1).join(' ')).some(([role,act,family,mode])=>
        role==='target' && act===f.act && family===f.family && mode===f.mode)));
    if (!hasHead) continue;
    const literals=new Set(f.parts.flatMap(p=>p.literal ?? []));
    const input=tail.map(([word,,a,b],j)=>{
      const protectedWord=literals.has(word) || worlds.negatives.has(word) || worlds.scopeGrammar.conditionals.has(word) ||
        Boolean(worlds.joiners[word]) || worlds.scopeGrammar.auxiliary.has(word) ||
        worlds.lookup(word).some(([role])=>role==='marker') ||
        !/^[\p{L}\p{M}\p{N}_]+$/u.test(word) && !(word==='-' && tail[j-1]?.[3]===a && tail[j+1]?.[2]===b);
      return [word,a,b,!protectedWord];
    });
    packets.push({family:f.family,act:f.act,mode:f.mode,parts:f.parts,input,anchor:ts[i][2],start:ts[start][2],end:tail.at(-1)[3]});
  }
  return packets;
}

export function sequenceReading(text,candidate,proof) {
  const wires=parse(candidate.sop), req=wires.filter(w=>w.type==='w.request.request'), tg=wires.filter(w=>w.type==='w.request.target');
  if (req.length!==1 || tg.length!==1 || one(req[0],'act')!==proof.act || one(tg[0],'family')!==proof.family ||
      one(tg[0],'mode')!==proof.mode || one(tg[0],'request')!=='$'+req[0].id) return;
  const chars=Array.from(text), point=i=>chars.slice(0,i).join('').length;
  const anchor=point(proof.anchor),start=point(proof.start),end=point(proof.end);
  const head=one(tg[0],'sort_words') ?? one(tg[0],'family_words') ?? one(tg[0],'sort');
  if (head && !literalRanges(text.toLowerCase(),head.toLowerCase(),0,start).some(([,b])=>b>anchor)) return;
  const predicate=one(req[0],'predicate');
  if (predicate && !literalRanges(text,predicate,0,start).length) return;
  const scope=one(req[0],'words');
  if (scope && !scope.includes(text.slice(anchor,end))) return;
  const additions=[],ids=new Set(wires.map(w=>w.id));
  for (const [key,canonical,a,b] of proof.bindings) {
    const surface=chars.slice(a,b).join(''),value=canonical || surface;
    const matches=wires.filter(w=>w.type==='w.request.constraint' && one(w,'attribute')===key);
    if (matches.some(w=>one(w,'request')!=='$'+req[0].id || many(w,'value').length!==1 ||
        one(w,'value')!==value || ![undefined,'result'].includes(one(w,'phase')) ||
        ![undefined,'eq'].includes(one(w,'operator')) || one(w,'want') || w.attrs.of)) return;
    if (matches.length) continue;
    let id=req[0].id+'.arg'+additions.length;
    while(ids.has(id)) id+='_';
    ids.add(id);additions.push({id,type:'w.request.constraint',attrs:{request:['$'+req[0].id],on:['attribute'],attribute:[key],value:[canonical && /^[\p{L}_][\p{L}\p{M}\p{N}_.-]*$/u.test(canonical) ? canonical : encode(value)],words:[encode(surface)],operator:['eq'],phase:['result']}});
  }
  if (!additions.length) return;
  return {sop:serialize([...consumeUnread(wires,text,start,end),...additions]),source:'argument-sequence',status:candidate.status};
}
