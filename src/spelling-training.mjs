import { normalizeText } from './corpus.mjs';
import { parse } from './schema.mjs';
import { spellingNeighbors, spellcheckTokens } from './spell.mjs';

const groundingSlots = new Map([
  ['w.request.target', ['name', 'sort', 'ids']],
  ['w.request.constraint', ['value']],
]);
const minimumUtterances = 3;

export function learnSpellingProtection(rows, dictionary) {
  const evidence = new Map(), occurrenceCounts = new Map(), seen = new Set();
  for (const { text, sop } of rows) {
    const unknown = new Set(spellcheckTokens(text).map(([word]) => word.toLowerCase())
      .filter(word => !dictionary.has(word)));
    if (!unknown.size) continue;

    const utterance = normalizeText(text);
    if (!seen.has(utterance)) {
      seen.add(utterance);
      for (const word of unknown) occurrenceCounts.set(word, (occurrenceCounts.get(word) ?? 0) + 1);
    }
    let wires;
    try { wires = parse(sop); } catch { continue; }
    for (const { type, attrs } of wires) {
      for (const field of groundingSlots.get(type) ?? []) {
        for (const raw of attrs[field] ?? []) {
          const value = raw.startsWith('"') ? JSON.parse(raw) : raw;
          // Whole-utterance text can occupy a value slot. Evidence for a
          // standalone word must refer to the entire value.
          const lower = value.toLowerCase();
          if (!unknown.has(lower)) continue;
          const utterances = evidence.get(lower) ?? new Set();
          utterances.add(utterance);
          evidence.set(lower, utterances);
        }
      }
    }
  }
  return [...evidence].filter(([word, utterances]) =>
    utterances.size >= minimumUtterances && utterances.size > occurrenceCounts.get(word) / 2
  ).map(([word]) => word).sort();
}

// A dictionary word attested as a request verb can be intentional even if a
// much more frequent preposition fits the same adjacent words.
export function learnPredicatePairs(rows,dictionary) {
  const evidence=new Map();
  for (const {text,sop} of rows) {
    if (!sop.includes('predicate=')) continue;
    let wires;
    try { wires=parse(sop); } catch { continue; }
    for (const wire of wires) {
      if (wire.type!=='w.request.request' || !wire.attrs.predicate?.length) continue;
      const get=key=>{
        const raw=wire.attrs[key]?.[0];
        return raw?.startsWith('"') ? JSON.parse(raw) : raw;
      };
      const predicate=get('predicate').toLowerCase(),scope=get('words') ?? text;
      if (!dictionary.has(predicate) || !text.includes(scope)) continue;
      const pairs=[...spellingNeighbors(scope)].filter(([left])=>left[0].toLowerCase()===predicate);
      if (pairs.length!==1) continue;
      const key=predicate+' '+pairs[0][1][0].toLowerCase();
      const witness=normalizeText(scope),prior=evidence.get(key);
      if (!prior) evidence.set(key,witness);
      else if (prior!==witness) evidence.set(key,true);
    }
  }
  return Object.fromEntries([...evidence].filter(([,confirmed])=>confirmed===true).sort());
}
