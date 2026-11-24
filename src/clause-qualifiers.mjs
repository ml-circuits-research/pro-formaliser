import { parse, serialize } from '../.cache/knowledge/tools/sopworld/sopworld.mjs';
import { literalRanges } from './evidence.mjs';
import { tokens } from './lexicon.mjs';
import { quotedSpans } from './literal-roles.mjs';
import { modifierReading } from './nominal-modifiers.mjs';
import { nominalPhraseReadings } from './nominal-phrases.mjs';
import { nominalNumberReading } from './nominal-number.mjs';

const field=(wire,key)=>{
  const raw=wire.attrs[key]?.[0];
  return raw?.startsWith('"') ? JSON.parse(raw) : raw;
};

// A whole-sentence template can get the later action right while missing a
// modifier on an earlier noun. Bind against the words owned by that request.
export function clauseQualifiers(text, worlds, model, permit) {
  const cache=new Map();
  return candidate=>{
    const wires=parse(candidate.sop);
    const requests=wires.filter(w=>w.type==='w.request.request');
    if (requests.length<2) return;
    const replacements=new Map(), added=[];
    const ids=new Set(wires.map(w=>w.id));
    let changed=false;
    for (const request of requests) {
      const words=field(request,'words');
      if (!words || literalRanges(text,words).length!==1) continue;
      const original=wires.filter(w=>w===request || field(w,'request')==='$'+request.id);
      const packet=serialize(original);
      if (!cache.has(packet)) {
        const ts=tokens(words),quotes=quotedSpans(words);
        let result={sop:packet};
        if (permit(words,quotes)) {
          if (model.modifiers) result=modifierReading(words,ts,quotes,result,model.modifiers) ?? result;
          result=nominalNumberReading(words,result,worlds.nominalNumbers,quotes,model.modifiers) ?? result;
          result=nominalPhraseReadings(words,ts,quotes,result,model.nominalPhrases,worlds)[0] ?? result;
        }
        cache.set(packet,result.sop===packet ? null : parse(result.sop));
      }
      const revised=cache.get(packet);
      if (!revised) continue;
      const oldIds=new Set(original.map(w=>w.id));
      const extras=revised.filter(w=>!oldIds.has(w.id));
      if (extras.some(w=>ids.has(w.id))) continue;
      const byId=new Map(revised.map(w=>[w.id,w]));
      for (const w of original) replacements.set(w.id,byId.get(w.id));
      for (const w of extras) { ids.add(w.id);added.push(w); }
      changed=true;
    }
    if (changed) return {sop:serialize([...wires.map(w=>replacements.has(w.id) ? replacements.get(w.id) : w).filter(Boolean),...added]),
      source:'clause-qualifiers',status:'partial'};
  };
}
