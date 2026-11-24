import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { loadCorpus, splitCorpus } from '../src/corpus.mjs';
import { SPELL_CONTEXT, SPELL_DICTIONARY, spellingNeighbors } from '../src/spell.mjs';
import { learnSpellingProtection } from '../src/spelling-training.mjs';

const dictionary = new Set(readFileSync(SPELL_DICTIONARY, 'utf8').toLowerCase().trim().split('\n'));
const corpus = loadCorpus();
const { training } = splitCorpus(corpus.rows);
const counts = Object.create(null), pairs = Object.create(null);
let total = 0;

for (const { text } of training) {
  for (const [left, right] of spellingNeighbors(text)) {
    const first = left[0].toLowerCase(), second = right[0].toLowerCase();
    if (!dictionary.has(first) || !dictionary.has(second)) continue;
    const key = first + ' ' + second;
    pairs[key] = (pairs[key] ?? 0) + 1;
    counts[first] = (counts[first] ?? 0) + 1;
    counts[second] = (counts[second] ?? 0) + 1;
    total += 2;
  }
}

for (const key of Object.keys(pairs)) {
  if (pairs[key] < 2) delete pairs[key];
}
const protectedWords = learnSpellingProtection(training, dictionary);
const staging = SPELL_CONTEXT + '.' + process.pid;
writeFileSync(staging, JSON.stringify({
  revision: corpus.revision, rows: training.length, total, counts, pairs, protectedWords,
}) + '\n');
renameSync(staging, SPELL_CONTEXT);
console.log(`Learned ${Object.keys(pairs).length} spelling bigrams from ${training.length} training rows at ${corpus.revision}`);
console.log(`Protected ${protectedWords.length} corroborated words outside the English dictionary`);
