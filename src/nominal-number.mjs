import { consumeUnread } from './nominal-evidence.mjs';
import { tokenize } from './model.mjs';
import { parse } from './schema.mjs';

const first = (wire,key) => {
  const raw=wire.attrs[key]?.[0];
  return raw?.startsWith('"') ? JSON.parse(raw) : raw;
};

export function nominalNumberReading(text,candidate,numbers,quotes=[],modifiers={}) {
  const input=tokenize(text);
  const numberOf = token => token && (numbers.get(token.key) ??
    (/^\d{1,8}$/u.test(token.key) ? {kind:'cardinal',value:token.key} : undefined));
  if (!input.some(numberOf)) return;
  const wires=parse(candidate.sop);
  const targets=wires.filter(w=>w.type==='w.request.target');
  if (targets.length!==1 || wires.filter(w=>w.type==='w.request.request').length!==1) return;
  const [target]=targets;
  if (['ordinal','count','quantity','quantifier'].some(k=>target.attrs[k])) return;
  const head=first(target,'sort_words') ?? first(target,'family_words') ?? first(target,'sort');
  if (!head || !/\p{L}/u.test(head)) return;
  const keys=tokenize(head).map(t=>t.key);
  const positions=input.flatMap((_,i)=>keys.every((key,j)=>input[i+j]?.key===key) ? [i] : []);
  if (positions.length!==1) return;
  let after=positions[0];
  while (after>0 && Object.hasOwn(modifiers,JSON.stringify([first(target,'family'),input[after-1].key]))) after--;
  let i=after-1, number=numberOf(input[i]);
  // Match a declared multi-token numeral as a whole, including internal hyphens.
  for (let start=Math.max(0,after-8);start<after-1;start++) {
    const entry=numbers.get(input.slice(start,after).map(t=>t.key).join(' '));
    if (entry) { i=start;number=entry;break; }
  }
  const token=input[i];
  const surface=token && text.slice(token.start,input[after-1].end);
  if (!number || numberOf(input[i-1]) || ['.',',','-','+','/'].includes(input[i-1]?.key) &&
      (numberOf(input[i-2]) || ['-','+'].includes(input[i-1].key))) return;
  // A qualifier inside a quoted label belongs to its payload.
  const offset=Array.from(text.slice(0,token.start)).length;
  if (quotes.some(q=>offset>=q.start && offset<q.end)) return;
  const holder=wires.find(w=>w.type==='w.request.request');
  if (first(holder,'words') && !first(holder,'words').includes(text.slice(token.start,input[positions[0]].end))) return;
  if (wires.some(w=>w.type==='w.request.constraint' && ['on','words','value'].some(k=>
    (k==='on' && first(w,k)==='count') || first(w,k)===surface))) return;
  const additions=number.kind==='ordinal' ? {ordinal:[JSON.stringify(surface)]}
    : {count:[String(number.value)],quantity:[JSON.stringify(surface)],count_words:[JSON.stringify(surface)]};
  const lines=[];
  for (const wire of consumeUnread(wires,text,token.start,input[after-1].end)) {
    const attrs=wire===target ? {...wire.attrs,...additions} : wire.attrs;
    lines.push(['@'+wire.id,wire.type,...Object.entries(attrs).flatMap(([k,vs])=>vs.map(v=>k+'='+v))].join(' '));
  }
  return {sop:lines.join('\n'),source:'nominal-number',status:candidate.status};
}
