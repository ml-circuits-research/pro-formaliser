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
  return matches.map(match => {
    const { word, score } = match;
    const [left, right] = neighbors;
    const leftWeight = left ? association(left, word) : 1;
    const rightWeight = right ? association(word, right) : 1;
    const evidence = context.allPairs && context.triples ? phraseEvidence(word, neighbors, context) : 0;
    return { ...match, score: score * Math.sqrt(leftWeight * rightWeight) * (1 + evidence) ** 1.3 };
  }).sort((a, b) => b.score - a.score);
}

function phraseEvidence(word, neighbors, context) {
  const [left, right] = neighbors;
  const before = left ? context.allPairs[left + ' ' + word] ?? 0 : 0;
  const after = right ? context.allPairs[word + ' ' + right] ?? 0 : 0;
  const exact = left && right ? context.triples[left + ' ' + word + ' ' + right] ?? 0 : 0;
  return left && right ? exact + Math.min(before, after) / 4 : before + after;
}

function observedCount(counts, word) {
  return Object.hasOwn(counts, word) ? counts[word] : 0;
}

function realWordRank(matches, original, neighbors, context) {
  const evidence = phraseEvidence(original, neighbors, context);
  const prevalence = observedCount(context.wordCounts, original);
  const ranked = matches.map(match => ({
    word: match.word,
    score: phraseEvidence(match.word, neighbors, context) * Math.sqrt(match.weight),
  })).filter(match => match.score > 0).sort((a, b) => b.score - a.score);
  // A dictionary entry carries a strong prior that it was typed as intended.
  if (ranked[0]?.score >= 15 * (evidence + 1) * (1 + Math.sqrt(prevalence / 12))) return ranked;
  return [];
}

function supportedSplit(splits,original,neighbors,context,matches) {
  if (!splits?.length || !neighbors || original!==original.toLowerCase() ||
      observedCount(context.wordCounts,original)) return;
  const [before,after]=neighbors;
  const eligible=splits.filter(([left,right])=>{
    const pair=left+' '+right;
    const support=(before ? context.triples[before+' '+pair] ?? 0 : 0)+
      (after ? context.triples[pair+' '+after] ?? 0 : 0);
    return (context.allPairs[pair] ?? 0)>=3 && support>=2 &&
      matches.every(({word})=>phraseEvidence(word,neighbors,context)<support);
  });
  if (eligible.length===1) return eligible[0].join(' ');
}

function preservesUnknown(original, observed, matches, neighbors, context) {
  const lower = original.toLowerCase();
  const evidence = neighbors ? phraseEvidence(lower, neighbors, context) : 0;
  const alternative = neighbors ? phraseEvidence(matches[0].word, neighbors, context) : 0;
  // Corpus and general usage both supply evidence for forms that the
  // dictionary omits. Let a well-supported replacement overcome that prior.
  const prevalence = observedCount(context.wordCounts, lower);
  const candidatePrevalence = observedCount(context.wordCounts, matches[0].word);
  if (observed < 50 && matches[0].weight > 1 && candidatePrevalence > 15 * prevalence) return false;
  if (evidence >= 3 && alternative < 6 * evidence) return true;
  if (prevalence >= 8 && candidatePrevalence < 200 * prevalence && alternative < 12) return true;
  if (observed >= 50 && alternative < 12) return true;
  if (prevalence >= 8 && !neighbors?.[1] && candidatePrevalence < 4000 * prevalence) return true;
  if (prevalence >= 2 && candidatePrevalence < 20 && alternative < 2) return true;
  return false;
}

export function spellcheckTokens(text) {
  return [...text.matchAll(tokenPattern)]
    .filter(([token]) => token.length >= 3 && token.length <= 64 && correctable.test(token));
}

/**
 * Correct a word when the leading one-edit candidate clears the
 * runner-up margin and has sufficient evidence. Offsets into the original
 * text use UTF-16 indexing.
 */
export function spellcheck(text, { knownWords = [], context = loadSpellingContext() } = {}) {
  const supplied = [...knownWords].map(word => word.toLowerCase());
  const protectedWords = new Set([...(context?.protectedWords ?? []), ...supplied]);
  const contextual = Boolean(context?.allPairs && context?.triples && context?.wordCounts);
  const tokens = spellcheckTokens(text).filter(([word]) => !protectedWords.has(word.toLowerCase()));
  const words = [...new Set(tokens.map(([token]) => token.toLowerCase()))];
  const corrections = [];
  const ambiguities = [];
  if (!words.length) return { text, changed: false, corrections, ambiguities };

  if (!existsSync(SPELL_DICTIONARY) || !existsSync(frequencies)) {
    throw new Error('English spelling resources missing. Run tools/setup.');
  }
  const worlds = loadWorlds();
  const extras = [...new Set([...worlds.knownWords, ...supplied]
    .map(word => word.toLowerCase())
    .filter(word => /^[a-z]+$/.test(word)))];
  const result = spawnSync(swipl, ['-q', '-f', program, '--', SPELL_DICTIONARY, frequencies], {
    encoding: 'utf8',
    input: JSON.stringify({ words, knownWords: extras, contextual }),
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
    const { known, count, matches: candidatesForWord, splits } = suggestions.get(lower);
    const adjacent = neighbors.get(start);
    const split = contextual && supportedSplit(splits,original,adjacent,context,candidatesForWord);
    if (!split && !candidatesForWord.length) continue;
    let matches;
    if (split) {
      matches = [{word:split}];
    } else if (known) {
      // Require both sides of the phrase and protect title-case words in
      // that position, where the user may be referring to a specific name.
      if (!contextual || !adjacent?.[0] || !adjacent?.[1] || original !== lower) continue;
      if (worlds.joiners[adjacent[0]] && context.predicatePairs?.[lower + ' ' + adjacent[1]]) continue;
      matches = realWordRank(candidatesForWord, lower, adjacent, context);
    } else {
      matches = context ? contextualRank(candidatesForWord, adjacent, context) : candidatesForWord;
      if (contextual && preservesUnknown(original, count, matches, adjacent, context)) continue;
    }
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
