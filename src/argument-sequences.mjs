import {parse,serialize} from '../.cache/knowledge/tools/sopworld/sopworld.mjs';
import {tokens} from './lexicon.mjs';
import {consumeUnread} from './nominal-evidence.mjs';
import {literalRanges} from './evidence.mjs';

const decode=v=>v?.startsWith('"') ? JSON.parse(v) : v;
const many=(w,k)=>(w.attrs[k] ?? []).map(decode);
const one=(w,k)=>many(w,k)[0];
const keys=s=>tokens(s).map(t=>t[0]);
const encode=s=>JSON.stringify(s);
const ownerPart='$owner';
const unreadPart='$unread';
const matchesAt=(ts,start,words)=>words.every((word,i)=>ts[start+i]?.[0]===word);
const atom=/^[\p{L}_][\p{L}\p{M}\p{N}_.-]*$/u;

function admittedLead(ts,end,worlds) {
  if (!end) return true;
  const words=ts.slice(0,end).map(([word])=>word).filter(word=>word!==',');
  const known=text=>worlds.fillerPhrases.has(text) || worlds.literalGrammar.leads.has(text);
  return known(words.join(' ')) ||
    worlds.joiners[words.at(-1)]==='addition' && (words.length===1 || known(words.slice(0,-1).join(' ')));
}

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
    const owners=many(w,'owner').map(keys).filter(words=>words.length), ownerKey=one(w,'owner_key'),ownerValue=one(w,'owner_value');
    const owned=owners.length>0;
    if (Boolean(ownerKey)!==Boolean(ownerValue) || ownerKey && (mode!=='new' || !props.get(ownerKey)?.values.includes(ownerValue))) continue;
    const parts=many(w,'part').map(p=>{
      if (p===ownerPart) return owned ? (mode==='existing' ? {key:p,nominal:owners} :
        {key:p,bank:owners.map(words=>[words,''])}) : null;
      if (p===unreadPart) return owned ? {key:p} : null;
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
    if (parts.some(p=>!p)) continue;
    const slots=parts.filter(p=>p.key && p.key!==unreadPart).map(p=>p.key);
    if (slots.length<2 || new Set(slots).size!==slots.length ||
        owned && (!slots.includes(ownerPart) || slots.includes(ownerKey))) continue;
    const tails=owned ? many(w,'tail').map(keys).filter(words=>words.length) : [];
    for (const prefix of many(w,'prefix').map(keys).filter(prefix=>prefix.length)) {
      const entries=index.get(prefix[0]) ?? [];
      entries.push({prefix,parts,family,act,mode,owned,ownerKey,ownerValue,tails});index.set(prefix[0],entries);
    }
  }
  for (const frames of index.values()) {
    for (const frame of frames.filter(frame=>frame.owned)) {
      frame.boundPhrases=frames.filter(peer=>peer.owned && peer.family===frame.family && peer.act===frame.act)
        .flatMap(peer=>peer.parts.filter(part=>part.key!==ownerPart).flatMap(part=>part.bank ?? []))
        .map(([words])=>words).filter(words=>words.length>1);
    }
  }
  return index;
}

export function sequencePacket(ts,worlds) {
  const packets=[];
  let stop=ts.length;
  while (stop && ['.','!','?'].includes(ts[stop-1][0])) stop--;
  if (!stop) return packets;
  for (let i=0;i<stop;i++) for (const f of worlds.argumentSequences?.get(ts[i][0]) ?? []) {
    if (!matchesAt(ts,i,f.prefix)) continue;
    const start=i+f.prefix.length;
    if (start>=stop) continue;
    if (f.owned) {
      if (!worlds.literalGrammar.licenses(f.family,f.act) || ts[stop]?.[0]==='?' ||
          !admittedLead(ts,i,worlds)) continue;
    } else if (!f.prefix.some((_,a)=>f.prefix.slice(a).some((_,b)=>
      worlds.lookup(f.prefix.slice(a,a+b+1).join(' ')).some(([role,act,family,mode])=>
        role==='target' && act===f.act && family===f.family && mode===f.mode)))) continue;
    const literals=new Set(f.parts.flatMap(p=>p.literal ?? []));
    const protectedPositions=new Set();
    for (const words of f.boundPhrases ?? []) {
      for (let from=start;from+words.length<=stop;from++) {
        if (!matchesAt(ts,from,words)) continue;
        for (let at=from;at<from+words.length;at++) protectedPositions.add(at);
      }
    }
    const input=ts.slice(start,stop).map(([word,,a,b],j)=>{
      const protectedWord=protectedPositions.has(start+j) || literals.has(word) ||
        worlds.negatives.has(word) || worlds.scopeGrammar.conditionals.has(word) ||
        Boolean(worlds.joiners[word]) || worlds.scopeGrammar.auxiliary.has(word) ||
        worlds.lookup(word).some(([role])=>role==='marker') ||
        !/^[\p{L}\p{M}\p{N}_]+$/u.test(word) && !(word==='-' && ts[start+j-1]?.[3]===a && ts[start+j+1]?.[2]===b);
      return [word,a,b,!protectedWord];
    });
    const endings=[stop];
    for (let end=start+1;end<stop;end++) {
      if (f.tails.some(words=>end+words.length<=stop && matchesAt(ts,end,words))) endings.push(end);
    }
    for (const end of endings) {
      if (end-start>32) continue;
      const packet={family:f.family,act:f.act,mode:f.mode,parts:f.parts,input:input.slice(0,end-start),
        anchor:ts[i][2],start:ts[start][2],end:ts[end-1][3]};
      if (f.owned) {
        const boundary=f.prefix.findLastIndex(word=>[',',':'].includes(word));
        packet.owned={ownerKey:f.ownerKey ?? '',ownerValue:f.ownerValue ?? '',
          predicateStart:ts[i+boundary+1][2],predicateEnd:ts[start-1][3],utteranceEnd:ts[stop-1][3]};
      }
      packets.push(packet);
    }
  }
  return packets;
}

export function sequenceReading(text,candidate,proof) {
  if (proof.owned) return;
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

export function sequenceFrameReading(text,proof,extraBindings=[]) {
  if (!proof.owned) return;
  const chars=Array.from(text), span=(start,end)=>chars.slice(start,end).join('');
  const {ownerKey,ownerValue,predicateStart,predicateEnd,utteranceEnd}=proof.owned;
  const owner=proof.bindings.find(([key])=>key===ownerPart);
  if (!owner) return;
  const [, ,start,end]=owner, noun=span(start,end);
  const lines=[
    '@r1 w.request.request act='+encode(proof.act)+' mood=do predicate='+encode(span(predicateStart,predicateEnd))+
      ' words='+encode(text),
    '@r1.t w.request.target request=$r1 family='+encode(proof.family)+' mode='+proof.mode+
      (proof.mode==='existing' ? ' fill=description description='+encode(noun) : ' determiner=indefinite family_words='+encode(noun)),
  ];
  if (proof.mode==='existing') lines.push('@r1.l w.request.lookup request=$r1 target=$r1.t key=thing from=page');
  const bindings=proof.bindings.flatMap(binding=>binding===owner ?
    (ownerKey ? [[ownerKey,ownerValue,start,end]] : []) : binding[0]===unreadPart ? [] : [binding]);
  for (const [i,[key,canonical,a,b]] of [...bindings,...extraBindings].entries()) {
    const words=span(a,b),value=canonical || words;
    lines.push('@r1.arg'+i+' w.request.constraint request=$r1 on=attribute attribute='+encode(key)+
      ' value='+(canonical && atom.test(canonical) ? canonical : encode(value))+
      (words===value ? '' : ' words='+encode(words))+' operator=eq phase=result');
  }
  const lead=span(0,predicateStart).trim();
  if (lead) lines.push('@f1 w.request.filler text='+encode(lead.replace(/,\s*$/u,'')));
  const remainder=span(proof.end,utteranceEnd).replace(/^\s*,?\s*/u,'');
  const unread=proof.bindings.filter(([key])=>key===unreadPart).map(([, ,a,b])=>span(a,b));
  if (remainder) unread.push(remainder);
  for (const [i,raw] of unread.entries()) lines.push('@r1.u'+i+' w.request.unread request=$r1 text='+encode(raw));
  return {sop:lines.join('\n'),source:'argument-frame',status:unread.length ? 'partial' : 'matched'};
}
