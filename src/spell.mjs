import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadWorlds } from './worlds.mjs';

const swipl = fileURLToPath(new URL('../tools/swipl', import.meta.url));
const program = fileURLToPath(new URL('../prolog/spell.pl', import.meta.url));
export const SPELL_DICTIONARY = fileURLToPath(new URL('../.cache/spell/english.txt', import.meta.url));
export const SPELL_CONTEXT = fileURLToPath(new URL('../.cache/spell/context.json', import.meta.url));
const frequencies = fileURLToPath(new URL('../.cache/spell/frequency-en.txt', import.meta.url));
const minimumOdds = 3;
const tokenPattern = /\b(?:https?:\/\/|www\.)[^\s<>]+|[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}|[\p{L}\p{M}\p{N}_]+(?:['’\p{Pd}][\p{L}\p{M}\p{N}_]+)*/giu;
const correctable = /^[a-z]+$|^[A-Z][a-z]+$/;
const contextWord = /^[a-z]+$|^[A-Z][a-z]*$/;
let cachedContext;

export function loadSpellingContext() {
  if (!existsSync(SPELL_CONTEXT)) return null;
  return cachedContext ??= JSON.parse(readFileSync(SPELL_CONTEXT, 'utf8'));
}

export function* spellingNeighbors(text) {
  const tokens = [...text.matchAll(tokenPattern)];
  for (let index = 0; index + 1 < tokens.length; index++) {
    const first = tokens[index], second = tokens[index + 1];
    const gap = text.slice(first.index + first[0].length, second.index);
    if (contextWord.test(first[0]) && contextWord.test(second[0]) && /^[ \t]+$/.test(gap)) {
      yield [first, second];
    }
  }
}

function contextualRank(matches, neighbors, context) {
  if (!neighbors || matches.length < 2) return matches;
  const { counts, pairs, total } = context;
  const count = word => Object.hasOwn(counts, word) ? counts[word] : 0;
  function association(first, second) {
    // Compare a pair's observed count with its expected count under
    // independence, with equal pseudocounts to temper sparse evidence.
    const expected = count(first) * count(second) / total;
    const observed = pairs[first + ' ' + second] ?? 0;
    return (observed + 5) / (expected + 5);
  }
  return matches.map(({ word, score }) => {
    const [left, right] = neighbors;
    const leftWeight = left ? association(left, word) : 1;
    const rightWeight = right ? association(word, right) : 1;
    return { word, score: score * Math.sqrt(leftWeight * rightWeight) };
  }).sort((a, b) => b.score - a.score);
}

export function spellcheckTokens(text) {
  return [...text.matchAll(tokenPattern)]
    .filter(([token]) => token.length >= 3 && token.length <= 64 && correctable.test(token));
}

/**
 * Correct unknown words when the leading one-edit candidate clears the
 * runner-up margin. Offsets refer to the original text and use UTF-16 indexing.
 */
export function spellcheck(text, { knownWords = [], context = loadSpellingContext() } = {}) {
  const protectedWords = new Set(context?.protectedWords);
  const tokens = spellcheckTokens(text).filter(([word]) => !protectedWords.has(word.toLowerCase()));
  const words = [...new Set(tokens.map(([token]) => token.toLowerCase()))];
  const corrections = [];
  const ambiguities = [];
  if (!words.length) return { text, changed: false, corrections, ambiguities };

  if (!existsSync(SPELL_DICTIONARY) || !existsSync(frequencies)) {
    throw new Error('English spelling resources missing. Run tools/setup.');
  }
  const extras = [...new Set([...loadWorlds().knownWords, ...knownWords]
    .map(word => word.toLowerCase())
    .filter(word => /^[a-z]+$/.test(word)))];
  const result = spawnSync(swipl, ['-q', '-f', program, '--', SPELL_DICTIONARY, frequencies], {
    encoding: 'utf8',
    input: JSON.stringify({ words, knownWords: extras }),
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `Spellchecker exited with status ${result.status}`);
  }
  const scored = JSON.parse(result.stdout);
  const suggestions = new Map(words.map((word, index) => [word, scored[index]]));
  const neighbors = new Map();
  if (context) {
    for (const [left, right] of spellingNeighbors(text)) {
      if (!neighbors.has(left.index)) neighbors.set(left.index, []);
      if (!neighbors.has(right.index)) neighbors.set(right.index, []);
      neighbors.get(left.index)[1] = right[0].toLowerCase();
      neighbors.get(right.index)[0] = left[0].toLowerCase();
    }
  }

  let output = '';
  let cursor = 0;
  for (const { 0: original, index: start } of tokens) {
    const lower = original.toLowerCase();
    const matches = context
      ? contextualRank(suggestions.get(lower), neighbors.get(start), context)
      : suggestions.get(lower);
    if (!matches.length) continue;

    const candidates = matches.map(({ word }) =>
      original === lower ? word : word[0].toUpperCase() + word.slice(1));
    const end = start + original.length;
    if (matches[1] && matches[0].score < minimumOdds * matches[1].score) {
      ambiguities.push({ original, start, end, candidates });
      continue;
    }

    const [replacement] = candidates;
    corrections.push({ original, replacement, start, end, candidates });
    output += text.slice(cursor, start) + replacement;
    cursor = end;
  }
  return {
    text: output + text.slice(cursor),
    changed: corrections.length > 0,
    corrections,
    ambiguities,
  };
}
