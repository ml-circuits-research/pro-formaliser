// A written name adjoining a recognized noun can identify an existing target.
// Keep the unspecialized reading as an alternative when capitalization is ambiguous.
import { literalRanges } from './evidence.mjs';
import { parse } from './schema.mjs';

const value = (wire,key) => {
  const raw = wire?.attrs[key]?.[0];
  return raw?.startsWith('"') ? JSON.parse(raw) : raw;
};
const proper = /^(?:\p{Lu}[\p{L}\p{N}_'’-]*|\p{L}+[0-9][\p{L}\p{N}_-]*)$/u;

export function namedTargetReading(text, candidate, worlds) {
  if (candidate.source !== 'lexicon' || !candidate.sop.includes('w.request.unread')) return;
  const wires=parse(candidate.sop);
  const targets=wires.filter(w=>w.type==='w.request.target');
  if (targets.length!==1) return;
  const target=targets[0];
  if (value(target,'mode')!=='existing' || target.attrs.name || target.attrs.ids) return;
  const head=value(target,'sort_words') ?? value(target,'family_words') ?? value(target,'sort');
  if (!head) return;
  const unread=wires.filter(w=>w.type==='w.request.unread');
  if (unread.length!==1 || value(unread[0],'request')!==value(target,'request')) return;
  const raw=value(unread[0],'text');
  if (!raw) return;
  const words=raw.trim().split(/\s+/u);
  if (Object.hasOwn(worlds.determiners,words[0].toLowerCase())) words.shift();
  if (!words.length || !words.every(w=>proper.test(w) && !worlds.evidenceVocabulary.grammar.has(w.toLowerCase()))) return;
  const name=words.join(' ');
  const nameKey = name.toLowerCase();
  if (worlds.lookup(nameKey).some(e=>e[0]==='constraint' ||
      (e[0]==='act' && text.trimStart().toLowerCase().startsWith(nameKey+' ')))) return;
  const surface=text.toLowerCase().replace(/\s+/gu,' ');
  const adjacent=[name+' '+head,head+' '+name].some(s=>literalRanges(surface,s.toLowerCase()).length);
  if (!adjacent) return;
  const sop=wires.filter(w=>w!==unread[0]).map(w=>{
    const attrs={...w.attrs};
    if (w===target) {
      attrs.fill=['written'];
      attrs.name=[JSON.stringify(name)];
      delete attrs.description;
    }
    return ['@'+w.id,w.type,...Object.entries(attrs).flatMap(([k,vs])=>vs.map(v=>k+'='+v))].join(' ');
  }).join('\n');
  return {...candidate,sop,source:'named-target',status:'partial'};
}
