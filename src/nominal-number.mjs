import { consumeUnread } from './nominal-evidence.mjs';
import { literalRanges } from './evidence.mjs';
import { tokenize } from './model.mjs';
import { parse } from './schema.mjs';

const first = (wire,key) => {
  const raw=wire.attrs[key]?.[0];
  return raw?.startsWith('"') ? JSON.parse(raw) : raw;
};

function qualifierBefore(text,input,position,numbers,numberOf,modifiers,family) {
  let after=position;
  while (after>0 && Object.hasOwn(modifiers,JSON.stringify([family,input[after-1].key]))) after--;
  let i=after-1, number=numberOf(input[i]);
  // Match a declared multi-token numeral as a whole, including internal hyphens.
  for (let start=Math.max(0,after-8);start<after-1;start++) {
    const entry=numbers.get(input.slice(start,after).map(t=>t.key).join(' '));
    if (entry) { i=start;number=entry;break; }
  }
  if (!number || numberOf(input[i-1]) || ['.',',','-','+','/'].includes(input[i-1]?.key) &&
      (numberOf(input[i-2]) || ['-','+'].includes(input[i-1].key))) return;
  const start=input[i].start, end=input[after-1].end;
  return {start,end,surface:text.slice(start,end),number,position};
}

export function nominalNumberReading(text,candidate,numbers,quotes=[],modifiers={}) {
  const input=tokenize(text);
  const numberOf = token => token && (numbers.get(token.key) ??
    (/^\d{1,8}$/u.test(token.key) ? {kind:'cardinal',value:token.key} : undefined));
  if (!input.some(numberOf)) return;
  const wires=parse(candidate.sop);
  const targets=wires.filter(w=>w.type==='w.request.target'), requests=wires.filter(w=>w.type==='w.request.request');
  if (targets.length!==1 || requests.length!==1) return;
  const [target]=targets, [holder]=requests;
  if (['ordinal','count','quantity','quantifier'].some(k=>target.attrs[k])) return;
  const head=first(target,'sort_words') ?? first(target,'family_words') ?? first(target,'sort');
  if (!head || !/\p{L}/u.test(head)) return;
  const keys=tokenize(head).map(t=>t.key);
  const words=first(holder,'words');
  const scopes=words ? literalRanges(text,words) : [[0,text.length]];
  if (scopes.length!==1) return;
  const [[left,right]]=scopes;
  const quoteRanges=quotes.map(q=>[q.start,q.end].map(offset=>Array.from(text).slice(0,offset).join('').length));
  const inQuotes=(start,end)=>quoteRanges.some(([a,b])=>a<end && b>start);
  const headEnd=position=>input[position+keys.length-1].end;
  let positions=input.flatMap(({start},i)=>start>=left && keys.every((key,j)=>input[i+j]?.key===key) &&
    headEnd(i)<=right && !inQuotes(start,headEnd(i)) ? [i] : []);
  if (positions.length>1) {
    // A uniquely grounded result can repeat the target noun as its payload.
    const payloads=wires.filter(w=>w.type==='w.request.constraint' && first(w,'request')==='$'+holder.id &&
      (first(w,'phase') ?? 'result')==='result').flatMap(w=>['words','value'].flatMap(key=>{
        const ranges=literalRanges(text,first(w,key),left,right);
        return ranges.length===1 ? ranges : [];
      }));
    positions=positions.filter(i=>!payloads.some(([a,b])=>a<=input[i].start && headEnd(i)<=b));
  }
  const qualified=positions.map(i=>qualifierBefore(text,input,i,numbers,numberOf,modifiers,first(target,'family')))
    .filter(q=>q && q.start>=left && !inQuotes(q.start,headEnd(q.position)));
  // A later number may belong to a payload or a second object. An earlier
  // plausible head or another qualified occurrence leaves the binding open.
  if (qualified.length!==1 || qualified[0].position!==positions[0]) return;
  const [{start,end,surface,number}]=qualified;
  if (wires.some(w=>w.type==='w.request.constraint' && ['on','words','value'].some(k=>
    (k==='on' && first(w,k)==='count') || first(w,k)===surface))) return;
  const additions=number.kind==='ordinal' ? {ordinal:[JSON.stringify(surface)]}
    : {count:[String(number.value)],quantity:[JSON.stringify(surface)],count_words:[JSON.stringify(surface)]};
  const lines=[];
  for (const wire of consumeUnread(wires,text,start,end)) {
    const attrs=wire===target ? {...wire.attrs,...additions} : wire.attrs;
    lines.push(['@'+wire.id,wire.type,...Object.entries(attrs).flatMap(([k,vs])=>vs.map(v=>k+'='+v))].join(' '));
  }
  return {sop:lines.join('\n'),source:'nominal-number',status:candidate.status};
}
