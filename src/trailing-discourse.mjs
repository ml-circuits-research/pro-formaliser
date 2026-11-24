import { tokens } from './lexicon.mjs';
import { quotedSpans } from './literal-roles.mjs';

const sentence=new Set(['.','?','!','。','？','！']);
const courtesyEnd=new Set(['.','!','。','！']);
const word=/^[\p{L}\p{N}\p{M}_]+$/u;
const decode=value=>value?.startsWith('"') ? JSON.parse(value) : value;
const keyOf=key=>key==='’' ? "'" : key;

export function compileTrailingDiscourse(facts) {
  const index=new Map();
  for (const wire of facts('pro.reader.trailing_discourse')) {
    for (const raw of wire.attrs.text ?? []) {
      const surface=tokens(decode(raw)).map(([key])=>keyOf(key));
      if (!surface.length || !surface.every((key,i)=>word.test(key) ||
          [",","'"].includes(key) && word.test(surface[i-1] ?? '') && word.test(surface[i+1] ?? ''))) continue;
      const head=surface.at(-1);
      const entries=index.get(head) ?? new Map();
      if (!index.has(head)) index.set(head,entries);
      entries.set(surface.join(' '),surface);
    }
  }
  return new Map([...index].map(([head,entries])=>[head,[...entries.values()]]));
}

export function discourseBody(text,index) {
  if (!index?.size) return;
  const chars=Array.from(text), quotes=quotedSpans(text);
  const ts=tokens(text).map(([key,,start,end])=>({
    key:keyOf(key),start,end,hidden:quotes.some(q=>q.start<end && q.end>start),
  }));
  if (ts.some(({key,start,end,hidden})=>!hidden &&
    (/^["“”‘]$/u.test(key) || key==="'" && !(word.test(chars[start-1] ?? '') && word.test(chars[end] ?? ''))))) return;
  let cursor=ts.length, omitted;
  while (cursor>1) {
    const last=ts[cursor-1];
    const end=courtesyEnd.has(last.key) && !last.hidden ? cursor-1 : cursor;
    const matches=(index.get(ts[end-1]?.key) ?? []).flatMap(surface=>{
      const start=end-surface.length;
      const boundary=ts[start-1], first=ts[start];
      if (!boundary || !first || boundary.hidden || !sentence.has(boundary.key) ||
          boundary.end===first.start || !surface.every((key,i)=>ts[start+i].key===key && !ts[start+i].hidden)) return [];
      return [start];
    });
    if (matches.length!==1) break;
    [omitted]=matches;
    cursor=omitted;
  }
  if (omitted===undefined || !ts.slice(0,cursor).some(({key,hidden})=>!hidden && word.test(key))) return;
  const start=chars.slice(0,ts[0].start).join('').length;
  const end=chars.slice(0,ts[cursor-1].end).join('').length;
  return {text:text.slice(start,end),start,end,suffix:text.slice(end).trim()};
}
