import { normalizeText } from './corpus.mjs';
import { parse } from './schema.mjs';
import { spellcheckTokens } from './spell.mjs';

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
