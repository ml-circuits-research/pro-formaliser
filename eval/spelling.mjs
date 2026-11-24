import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { loadCorpus, splitCorpus } from '../src/corpus.mjs';
import { SPELL_DICTIONARY, loadSpellingContext, spellcheck, spellcheckTokens, spellingNeighbors } from '../src/spell.mjs';

const allChanges = process.argv.includes('--all-changes');
let context = process.argv.includes('--no-context') ? null : loadSpellingContext();
if (context && process.argv.includes('--legacy-context')) {
  const { revision, counts, pairs, total, protectedWords } = context;
  context = { revision, counts, pairs, total, protectedWords };
}
const dictionary = new Set(readFileSync(SPELL_DICTIONARY, 'utf8').toLowerCase().trim().split('\n'));
const corpus = loadCorpus();
const { heldOut } = splitCorpus(corpus.rows);
const operations = ['deletion', 'insertion', 'substitution'];
const realWordOperations = [...operations, 'transposition'];

function caseLike(word, original) {
  return /^[A-Z]/.test(original) ? word[0].toUpperCase() + word.slice(1) : word;
}

function* realWordEdits(original) {
  const word = original.toLowerCase();
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  for (let index = 0; index <= word.length; index++) {
    const before = word.slice(0, index);
    const after = word.slice(index + 1);
    if (index < word.length) yield [before + after, 'deletion'];
    if (index + 1 < word.length && word[index] !== word[index + 1]) {
      yield [before + word[index + 1] + word[index] + word.slice(index + 2), 'transposition'];
    }
    for (const letter of letters) {
      yield [before + letter + word.slice(index), 'insertion'];
      if (index < word.length && letter !== word[index]) {
        yield [before + letter + after, 'substitution'];
      }
    }
  }
}

function injectRealWord(row) {
  const candidates = new Map();
  for (const { 0: original, index: start } of spellcheckTokens(row.text)) {
    if (original.length < 4 || !dictionary.has(original.toLowerCase())) continue;
    for (const [edit, operation] of realWordEdits(original)) {
      if (!dictionary.has(edit)) continue;
      const typo = caseLike(edit, original);
      candidates.set(start + ':' + typo, { original, typo, start, operation });
    }
  }
  if (!candidates.size) return null;
  const hash = createHash('sha256').update(`real-word\0${row.source}:${row.row}\0${row.text}`).digest();
  const edit = [...candidates.values()][hash.readUInt32BE(0) % candidates.size];
  return {
    ...row,
    ...edit,
    text: row.text.slice(0, edit.start) + edit.typo + row.text.slice(edit.start + edit.original.length),
    realWord: true,
  };
}

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

function missingSpaceChallenge(rows) {
  const edited=[];
  for (const row of rows) {
    const pairs=[...spellingNeighbors(row.text)].filter(([a,b])=>
      row.text.slice(a.index+a[0].length,b.index)===' ' &&
      dictionary.has(a[0].toLowerCase()) && dictionary.has(b[0].toLowerCase()));
    if (!pairs.length) continue;
    const hash=createHash('sha256').update('join-space\0'+row.source+':'+row.row).digest();
    const [left,right]=pairs[hash.readUInt32BE(0)%pairs.length];
    const at=right.index-1;
    edited.push({...row,text:row.text.slice(0,at)+row.text.slice(at+1),
      start:left.index,original:left[0]+' '+right[0]});
  }
  let restored=0,wrong=0;
  for (const {row,corrections} of evaluateBatch(edited)) {
    const replacement=corrections.find(edit=>edit.start===row.start)?.replacement;
    if (replacement===row.original) restored++;
    else if (replacement) wrong++;
  }
  return {injected:edited.length,restored,wrong,unchanged:edited.length-restored-wrong};
}

const clean = evaluateBatch(heldOut);
const corrupted = evaluateBatch(heldOut.map(inject).filter(Boolean));
const cleanTokens = heldOut.reduce((count, row) => count + spellcheckTokens(row.text).length, 0);
const cleanChanges = clean.flatMap(({ row, corrections }) => corrections.map(
  ({ original, replacement, start }) => ({ source: row.source, row: row.row, text: row.text, start, original, replacement })));
function evaluateRealWordEdits(rows) {
  const byOperation = Object.fromEntries(realWordOperations.map(operation =>
    [operation, { injected: 0, restored: 0, wrong: 0 }]));
  const wrongChanges = [];
  let restored = 0;
  for (const { row, corrections } of rows) {
    byOperation[row.operation].injected++;
    const change = corrections.find(item => item.start === row.start);
    if (!change) continue;
    if (change.replacement === row.original) {
      restored++;
      byOperation[row.operation].restored++;
    } else {
      byOperation[row.operation].wrong++;
      wrongChanges.push({
        source: row.source, row: row.row, text: row.text, original: row.original,
        typo: row.typo, operation: row.operation, replacement: change.replacement,
      });
    }
  }
  return {
    injected: rows.length,
    restored,
    wrong: wrongChanges.length,
    retained: rows.length - restored - wrongChanges.length,
    byOperation,
    wrongReplacementSamples: allChanges ? wrongChanges : wrongChanges.slice(0, 10),
  };
}

const realWordChallenge = evaluateRealWordEdits(evaluateBatch(heldOut.map(injectRealWord).filter(Boolean)));
const restored = { deletion: 0, insertion: 0, substitution: 0 };
const injected = { deletion: 0, insertion: 0, substitution: 0 };
const wrongChanges = [];
const retained = { ambiguous: 0, realWord: 0, noCandidate: 0 };
let realWordTypos = 0, realWordRestorations = 0, realWordWrongReplacements = 0;
let collateralChanges = 0, newCollateralChanges = 0;
const cleanCorrections = new Map(clean.map(({ row, corrections }) =>
  [row.source + ':' + row.row, new Set(corrections.map(item => item.start + ':' + item.replacement))]
));
for (const { row, corrections, ambiguities } of corrupted) {
  injected[row.operation]++;
  if (row.realWord) realWordTypos++;
  const prior = cleanCorrections.get(row.source + ':' + row.row);
  for (const item of corrections) {
    if (item.start === row.start) continue;
    collateralChanges++;
    const start = item.start > row.start ? item.start + row.original.length - row.typo.length : item.start;
    if (!prior?.has(start + ':' + item.replacement)) newCollateralChanges++;
  }
  const change = corrections.find(item => item.start === row.start);
  if (change?.replacement === row.original) {
    restored[row.operation]++;
    if (row.realWord) realWordRestorations++;
  } else if (change) {
    if (row.realWord) realWordWrongReplacements++;
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
  missingSpaceChallenge: missingSpaceChallenge(heldOut),
  injectedTypos: corrupted.length,
  realWordTypos,
  realWordRestorations,
  realWordWrongReplacements,
  realWordChallenge,
  collateralChanges,
  newCollateralChanges,
  restoredTypos: restoredCount,
  restorationRate: restoredCount / corrupted.length,
  wrongReplacements: wrongChanges.length,
  retained,
  byOperation: Object.fromEntries(operations.map(operation =>
    [operation, { injected: injected[operation], restored: restored[operation] }])),
  cleanChangeSamples: allChanges ? cleanChanges : cleanChanges.slice(0, 10),
  wrongReplacementSamples: allChanges ? wrongChanges : wrongChanges.slice(0, 10),
}, null, 2));
