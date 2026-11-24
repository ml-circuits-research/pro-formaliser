import {nativeInventory} from './native-inventory.mjs';
import { tokens } from './lexicon.mjs';
import { parse } from './schema.mjs';

const form = text => tokens(text).map(([key])=>key).join(' ');
const quote = JSON.stringify;
const word = /^[\p{L}\p{M}\p{N}_]+$/u;
const decoded = value => value?.startsWith('"') ? JSON.parse(value) : value;
const atom = /^[\p{L}_][\p{L}\p{M}\p{N}_.-]*$/u;

const valuesOf=(wire,key)=>(wire.attrs[key] ?? []).map(decoded);
const identity=(family,key)=>JSON.stringify([family,key]);

export function compileOwnerPropertyOperands(facts,requestKeys,words) {
  const slots=facts('core.slot');
  const slotsByField=new Map();
  for (const slot of slots) {
    const id=identity(valuesOf(slot,'of')[0],valuesOf(slot,'key')[0]);
    const group=slotsByField.get(id) ?? [];
    group.push(slot);
    slotsByField.set(id,group);
  }
  const openString=slot=>{
    const kinds=valuesOf(slot,'kind');
    return kinds.length===1 && kinds[0]==='string' &&
      !['enum','ref','type','by','prefix','min','max','step','range','match','excludes','unique','id','to']
        .some(key=>slot.attrs[key]?.length);
  };
  const validBackings=new Set(slots.filter(slot=>openString(slot) &&
    slotsByField.get(identity(valuesOf(slot,'of')[0],valuesOf(slot,'key')[0])).every(openString))
    .map(slot=>slot.id));
  const groups=new Map();
  for (const key of requestKeys) {
    const groupKey=identity(key.family,key.name), group=groups.get(groupKey) ?? [];
    group.push(key);
    groups.set(groupKey,group);
  }
  const ownerPropertyOpen=new Set([...groups].filter(([,keys])=>keys.every(key=>
    !key.values.length && key.head.split('+').includes('candidate') &&
      validBackings.has(key.means))).map(([id])=>id));

  const ownerInventory=new Map(), cache=new Map();
  for (const binding of facts('pro.reader.owner_inventory')) {
    const [tab,family,act,provider]=['tab','family','act','provider'].map(key=>valuesOf(binding,key)[0]);
    if (!tab || !family || !act || !provider || !requestKeys.some(key=>key.tab===tab && key.family===family)) continue;
    if (!cache.has(provider)) cache.set(provider,nativeInventory(facts,provider,words));
    for (const [surface,sorts] of cache.get(provider)) {
      const lookup=identity(act,surface), entries=ownerInventory.get(lookup) ?? [];
      for (const sort of sorts) entries.push({family,sort});
      ownerInventory.set(lookup,entries);
    }
  }
  return {ownerPropertyOpen,ownerInventory};
}

function catalogProperty(worlds,family,surface) {
  const aliases = worlds.ownerPropertyLabels?.get(JSON.stringify([surface,family])) ?? [];
  const attributes = new Set(aliases.map(({attribute})=>attribute));
  if (attributes.size!==1) return;
  const [attribute]=attributes;
  const keys=worlds.requestKeys.filter(k=>k.family===family && k.name===attribute);
  if (!keys.length || keys.some(k=>k.head!==keys[0].head ||
      k.values.length!==keys[0].values.length || k.values.some(v=>!keys[0].values.includes(v)))) return;
  return keys[0];
}

function closedValue(worlds,key,surface) {
  const values = new Set(key.values.filter(value=>form(value.replaceAll('_',' '))===surface ||
    form(value)===surface));
  for (const [body] of worlds.ownerPropertyValues?.get(JSON.stringify([key.family,surface])) ?? []) {
    const attrs=parse('@value w.request.constraint '+body)[0].attrs;
    const value=decoded(attrs.value?.[0]);
    if (decoded(attrs.attribute?.[0])===key.name && key.values.includes(value)) values.add(value);
  }
  return values.size===1 ? [...values][0] : undefined;
}

export function ownerPropertyReadings(text,ts,quotes,worlds) {
  if (!worlds.ownerPropertyFrames?.length || !ts.length) return [];
  const chars=Array.from(text), keys=ts.map(t=>t[0]);
  const span=(a,b)=>chars.slice(ts[a][2],ts[b-1][3]).join('');
  const before=(a,b)=>keys.slice(a,b).join(' ');
  const quoted=i=>quotes.some(q=>q.start<ts[i][3] && ts[i][2]<q.end);
  const plain=(a,b)=>a<b && ts.slice(a,b).every(([key,,start,end],j)=>
    !quoted(a+j) && (word.test(key) || key==='-' && j>0 && a+j+1<b &&
      ts[a+j-1][3]===start && ts[a+j+1][2]===end));
  const matches=(at,phrase)=>before(at,at+phrase.length)===phrase.join(' ') &&
    ts.slice(at,at+phrase.length).every((_,j)=>!quoted(at+j));
  const unsafe=(a,b)=>keys.slice(a,b).some((key,j)=>{
    const i=a+j;
    if (quoted(i)) return false;
    if (worlds.negatives.has(key) || worlds.joiners[key]) return true;
    return [1,2,3,4].some(n=>i+n<=b && (worlds.scopeGrammar.negatives.has(before(i,i+n)) ||
      worlds.scopeGrammar.conditionals.has(before(i,i+n))));
  });
  const detAt=(a,b)=>{
    for (let stop=Math.min(a+5,b);stop>a;stop--) {
      const mode=worlds.determiners[before(a,stop)];
      if (mode) return {mode,next:stop};
    }
    return {next:a};
  };
  const terminal=['.','?','!'].includes(keys.at(-1)) && !quoted(keys.length-1);
  const end=keys.length-Number(terminal);
  const outputs=new Map();
  for (const frame of worlds.ownerPropertyFrames) {
    const {act}=frame, owner=form(frame.owner ?? '').split(' '), value=form(frame.value ?? '').split(' ');
    if (!owner[0] || !value[0]) continue;
    const overlapsConnector=(a,b)=>keys.slice(a,b).some((_,j)=>
      [owner,value].some(part=>a+j+part.length<=b && matches(a+j,part)));
    for (let verbAt=0;verbAt<Math.min(12,end);verbAt++) {
      const lead=before(0,verbAt);
      if (lead && !worlds.literalGrammar.leads.has(lead) && !worlds.fillerPhrases.has(lead)) continue;
      if (keys.at(-1)==='?' && !lead) continue;
      for (let verbEnd=verbAt+1;verbEnd<Math.min(end,verbAt+8);verbEnd++) {
        const readings=worlds.lookup(before(verbAt,verbEnd));
        if (!readings.some(([role,sense,mood])=>role==='act' && sense===act && (!mood || mood==='do')) ||
            !readings.some(([role,sense,slot])=>role==='frame' && sense===act && slot==='value')) continue;
        const propertyAt=detAt(verbEnd,end).next;
        for (let ownerAt=propertyAt+1;ownerAt<Math.min(propertyAt+9,end);ownerAt++) {
          if (!matches(ownerAt,owner) || !plain(propertyAt,ownerAt)) continue;
          const start=ownerAt+owner.length, det=detAt(start,end);
          if (det.mode && !['definite','demonstrative','possessive'].includes(det.mode)) continue;
          for (let valueAt=det.next+1;valueAt<Math.min(end,det.next+13);valueAt++) {
            if (!matches(valueAt,value) || !plain(start,valueAt) ||
                overlapsConnector(start,valueAt) || unsafe(propertyAt,valueAt)) continue;
            const payload=valueAt+value.length;
            if (payload>=end) continue;
            const quotedValue=quotes.find(q=>q.start===ts[payload][2] && q.end===ts[end-1][3]);
            if (!quotedValue && (!plain(payload,end) || unsafe(payload,end) ||
                overlapsConnector(payload,end))) continue;
            const words=quotedValue?.value ?? span(payload,end);
            if (!words.trim()) continue;
            const nounOptions=[];
            for (let noun=det.next;noun<valueAt;noun++) {
              const surface=before(noun,valueAt);
              const fromInventory=worlds.ownerInventory?.get(identity(act,surface)) ?? [];
              const fromLexicon=worlds.lookup(surface).flatMap(([role,sense,family,mode,sort])=>
                role==='target' && sense===act && mode==='existing' ? [{family,sort}] : []);
              for (const {family,sort} of [...fromInventory,...fromLexicon]) {
                if (!sort && fromInventory.some(item=>item.family===family)) continue;
                const property=catalogProperty(worlds,family,before(propertyAt,ownerAt));
                if (property) nounOptions.push({noun,family,sort,property});
              }
            }
            const firstByFamily=new Map();
            for (const {noun,family} of nounOptions) {
              if (!firstByFamily.has(family)) firstByFamily.set(family,noun);
            }
            for (const {noun,family,sort,property} of nounOptions) {
              if (noun!==firstByFamily.get(family)) continue;
              const resolved=property.values.length ? closedValue(worlds,property,form(words)) :
                (property.head.split('+').includes('span') ||
                  worlds.ownerPropertyOpen?.has(identity(family,property.name))) ? words : undefined;
              if (!resolved || resolved!==words && !atom.test(resolved)) continue;
              const head=span(noun,valueAt);
              const encodedValue=resolved===words ? quote(resolved) : resolved;
              const sop=[
                '@r1 w.request.request act='+quote(act)+' mood=do predicate='+quote(span(verbAt,verbEnd)),
                '@r1.t w.request.target request=$r1 family='+quote(family)+' mode=existing fill=description'+
                  (det.mode ? ' determiner='+det.mode : '')+' description='+quote(span(start,valueAt))+
                  (sort ? ' sort='+quote(sort)+' sort_words='+quote(head) : ' family_words='+quote(head)),
                '@r1.c1 w.request.constraint request=$r1 on=attribute attribute='+quote(property.name)+
                  ' value='+encodedValue+' operator=eq phase=result key_words='+quote(span(propertyAt,ownerAt))+' words='+quote(words)
              ].join('\n');
              const alternatives=outputs.get(family) ?? new Map();
              alternatives.set(sop,{sop,source:'owner-property'});
              outputs.set(family,alternatives);
            }
          }
        }
      }
    }
  }
  return [...outputs.values()].flatMap(readings=>readings.size===1 ? [...readings.values()] : []);
}
