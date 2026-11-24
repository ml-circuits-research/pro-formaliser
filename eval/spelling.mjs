import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { loadCorpus, splitCorpus } from '../src/corpus.mjs';
import { SPELL_DICTIONARY, loadSpellingContext, spellcheck, spellcheckTokens } from '../src/spell.mjs';

const allChanges = process.argv.includes('--all-changes');
const context = process.argv.includes('--no-context') ? null : loadSpellingContext();
const dictionary = new Set(readFileSync(SPELL_DICTIONARY, 'utf8').toLowerCase().trim().split('\n'));
const corpus = loadCorpus();
const { heldOut } = splitCorpus(corpus.rows);
const operations = ['deletion', 'insertion', 'substitution'];

function inject(row) {
  const eligible = spellcheckTokens(row.text).filter(([word]) => word.length >= 4 &&
    dictionary.has(word.toLowerCase()));
  if (!eligible.length) return null;

  const hash = createHash('sha256').update(`${row.source}:${row.row}\0${row.text}`).digest();
  const { 0: original, index: start } = eligible[hash.readUInt32BE(0) % eligible.length];
  const operation = operations[hash[4] % operations.length];
  const first = /^[A-Z]/.test(original) ? 1 : 0;
  const positions = original.length - first + Number(operation === 'insertion');
  const position = first + hash[5] % positions;
  let letter = String.fromCharCode(97 + hash[6] % 26);
  if (operation === 'substitution' && letter === original[position]) {
    letter = letter === 'z' ? 'a' : String.fromCharCode(letter.charCodeAt(0) + 1);
  }
  const before = original.slice(0, position);
  const after = original.slice(position + Number(operation !== 'insertion'));
  const typo = before + (operation === 'deletion' ? '' : letter) + after;
  return {
    ...row,
    text: row.text.slice(0, start) + typo + row.text.slice(start + original.length),
    original, typo, start, operation,
    realWord: dictionary.has(typo.toLowerCase()),
  };
}

function evaluateBatch(rows) {
  const chunks = [];
  const indexed = [];
  let start = 0;
  for (const row of rows) {
    indexed.push({ row, start, corrections: [], ambiguities: [] });
    chunks.push(row.text);
    start += row.text.length + 2;
  }
  const result = spellcheck(chunks.join('\n\n'), { context });
  for (const field of ['corrections', 'ambiguities']) {
    let index = 0;
    for (const change of result[field]) {
      while (index + 1 < indexed.length && indexed[index + 1].start <= change.start) index++;
      const target = indexed[index];
      target[field].push({ ...change, start: change.start - target.start });
    }
  }
  return indexed;
}

const clean = evaluateBatch(heldOut);
const corrupted = evaluateBatch(heldOut.map(inject).filter(Boolean));
const cleanTokens = heldOut.reduce((count, row) => count + spellcheckTokens(row.text).length, 0);
const cleanChanges = clean.flatMap(({ row, corrections }) => corrections.map(
  ({ original, replacement }) => ({ source: row.source, row: row.row, text: row.text, original, replacement })));
const restored = { deletion: 0, insertion: 0, substitution: 0 };
const injected = { deletion: 0, insertion: 0, substitution: 0 };
const wrongChanges = [];
const retained = { ambiguous: 0, realWord: 0, noCandidate: 0 };
let realWordTypos = 0;
for (const { row, corrections, ambiguities } of corrupted) {
  injected[row.operation]++;
  if (row.realWord) realWordTypos++;
  const change = corrections.find(item => item.start === row.start);
  if (change?.replacement === row.original) {
    restored[row.operation]++;
  } else if (change) {
    const { source, text, original, typo, operation } = row;
    wrongChanges.push({ source, row: row.row, text, original, typo, operation, replacement: change.replacement });
  } else if (row.realWord) {
    retained.realWord++;
  } else if (ambiguities.some(item => item.start === row.start)) {
    retained.ambiguous++;
  } else {
    retained.noCandidate++;
  }
}

const restoredCount = Object.values(restored).reduce((sum, count) => sum + count, 0);
console.log(JSON.stringify({
  revision: corpus.revision,
  contextTrainingRevision: context?.revision ?? null,
  heldOutRows: heldOut.length,
  spellcheckableCleanTokens: cleanTokens,
  cleanChanges: cleanChanges.length,
  cleanTokenChangeRate: cleanChanges.length / cleanTokens,
  injectedTypos: corrupted.length,
  realWordTypos,
  restoredTypos: restoredCount,
  restorationRate: restoredCount / corrupted.length,
  wrongReplacements: wrongChanges.length,
  retained,
  byOperation: Object.fromEntries(operations.map(operation =>
    [operation, { injected: injected[operation], restored: restored[operation] }])),
  cleanChangeSamples: allChanges ? cleanChanges : cleanChanges.slice(0, 10),
  wrongReplacementSamples: allChanges ? wrongChanges : wrongChanges.slice(0, 10),
}, null, 2));
