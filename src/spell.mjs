import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const swipl = fileURLToPath(new URL('../tools/swipl', import.meta.url));
const program = fileURLToPath(new URL('../prolog/spell.pl', import.meta.url));
export const SPELL_DICTIONARY = fileURLToPath(new URL('../.cache/spell/english.txt', import.meta.url));
const tokenPattern = /\b(?:https?:\/\/|www\.)[^\s<>]+|[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}|[\p{L}\p{M}\p{N}_]+(?:['’\p{Pd}][\p{L}\p{M}\p{N}_]+)*/giu;
const correctable = /^[a-z]+$|^[A-Z][a-z]+$/;

export function spellcheckTokens(text) {
  return [...text.matchAll(tokenPattern)]
    .filter(([token]) => token.length >= 3 && token.length <= 64 && correctable.test(token));
}

/**
 * Correct an unknown word when one spelling ranks above all other one-edit
 * candidates. Offsets refer to the original text and use UTF-16 indexing.
 */
export function spellcheck(text, { knownWords = [] } = {}) {
  const tokens = spellcheckTokens(text);
  const words = [...new Set(tokens.map(([token]) => token.toLowerCase()))];
  const corrections = [];
  const ambiguities = [];
  if (!words.length) return { text, changed: false, corrections, ambiguities };

  const extras = [...new Set([...knownWords]
    .map(word => word.toLowerCase())
    .filter(word => /^[a-z]+$/.test(word)))];
  if (!existsSync(SPELL_DICTIONARY)) throw new Error('English dictionary missing. Run tools/setup.');
  const result = spawnSync(swipl, ['-q', '-f', program, '--', SPELL_DICTIONARY], {
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

  let output = '';
  let cursor = 0;
  for (const { 0: original, index: start } of tokens) {
    const lower = original.toLowerCase();
    const matches = suggestions.get(lower);
    if (!matches.length) continue;

    const candidates = matches.map(({ word }) =>
      original === lower ? word : word[0].toUpperCase() + word.slice(1));
    const end = start + original.length;
    if (matches[0].score === matches[1]?.score) {
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
