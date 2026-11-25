// Recover a literal qualifier adjacent to an existing target's typed noun.
import { literalRanges, sortRanges } from './evidence.mjs';
import { tokens } from './lexicon.mjs';
import { quotedSpans } from './literal-roles.mjs';
import { consumeUnread } from './nominal-evidence.mjs';
import { parse } from './schema.mjs';
import { serialize } from '../.cache/knowledge/tools/sopworld/sopworld.mjs';

const value = (wire,key) => {
  const raw = wire?.attrs[key]?.[0];
  return raw?.startsWith('"') ? JSON.parse(raw) : raw;
};
const proper = /^(?:\p{Lu}[\p{L}\p{N}_'’-]*|\p{L}+[0-9][\p{L}\p{N}_-]*)$/u;
const number = /^\d+$/u;
const gap = /^\s+$/u;

function followsPlaceMarker(text, at, worlds) {
  const tail = tokens(text.slice(at)).slice(0, 4).map(([key])=>key);
  return tail.some((_, index)=>worlds.lookup(tail.slice(0,index+1).join(' '))
    .some(([role,,kind])=>role==='marker' && ['place','spatial'].includes(kind)));
}

export function namedTargetReading(text, candidate, worlds) {
  if (candidate.source !== 'lexicon' || !candidate.sop.includes('w.request.unread')) return;
  const wires=parse(candidate.sop);
  const targets=wires.filter(w=>w.type==='w.request.target');
  if (targets.length!==1) return;
  const [target]=targets;
  if (value(target,'mode')!=='existing' || target.attrs.name || target.attrs.ids) return;
  const head=value(target,'sort_words') ?? value(target,'family_words') ?? value(target,'sort');
  if (!head) return;
  const prior=value(target,'description');
  if (prior && !sortRanges(prior,head).some(([a,b])=>b===prior.length &&
      (!a || Object.hasOwn(worlds.determiners,prior.slice(0,a).trim().toLowerCase())))) return;
  const ref=value(target,'request');
  const request=wires.find(w=>'$'+w.id===ref && w.type==='w.request.request');
  const scope=value(request,'words') ?? text;
  const bounds=literalRanges(text,scope);
  if (!request || bounds.length!==1) return;
  const [[start,stop]]=bounds;
  const chars=Array.from(text);
  const quotes=quotedSpans(text).map(({start,end})=>
    [chars.slice(0,start).join('').length,chars.slice(0,end).join('').length]);
  const unquoted=(a,b)=>!quotes.some(([left,right])=>a<right && left<b);
  const heads=sortRanges(text,head,start,stop).filter(([a,b])=>unquoted(a,b));
  const unread=wires.filter(w=>w.type==='w.request.unread' && value(w,'request')===ref);
  const matches=[];
  for (const wire of unread) {
    const raw=value(wire,'text');
    if (!raw) continue;
    const ranges=literalRanges(text,raw);
    if (ranges.length!==1) continue;
    const [[from,to]]=ranges;
    if (from<start || to>stop || !unquoted(from,to)) continue;
    const words=raw.trim().split(/\s+/u);
    if (Object.hasOwn(worlds.determiners,words[0].toLowerCase())) words.shift();
    if (!words.length) continue;
    const key=words.join(' ').toLowerCase();
    if (worlds.lookup(key).some(([role])=>role==='constraint' ||
        role==='act' && text.trimStart().toLowerCase().startsWith(key+' '))) continue;
    const properName=words.every(w=>proper.test(w) && !worlds.evidenceVocabulary.grammar.has(w.toLowerCase()));
    const numeric=words.length===1 && number.test(words[0]);
    if (!properName && !numeric) continue;
    for (const [a,b] of heads) {
      if (properName && to<a && gap.test(text.slice(to,a))) {
        matches.push({wire,from,to,headStart:a,description:text.slice(from,b),name:words.join(' ')});
      }
      if (b<from && gap.test(text.slice(b,from)) &&
          (properName || followsPlaceMarker(text.slice(0,stop),to,worlds))) {
        matches.push({wire,from,to,headStart:a,description:text.slice(a,to),name:properName ? words.join(' ') : undefined});
      }
    }
  }
  if (matches.length!==1) return;
  const [{wire,from,to,headStart,description,name}]=matches;
  if (headStart!==heads[0][0]) return;
  const attributes=name && unread.length===1 ? {fill:['written'],name:[JSON.stringify(name)]} :
    {fill:['description'],description:[JSON.stringify(description)]};
  const revised={...target,attrs:{...target.attrs,...attributes}};
  if (attributes.name) delete revised.attrs.description;
  const retained=consumeUnread(wires,text,from,to,w=>w===wire);
  return {...candidate,sop:serialize(retained.map(w=>w===target ? revised : w)),source:'named-target',status:'partial'};
}
