import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { spellcheck } from '../src/spell.mjs';

test('English misspellings ranked without adding evaluation words to the dictionary', t => {
  const examples = [
    ['acommodate', 'accommodate'],
    ['embarass', 'embarrass'],
    ['langauge', 'language'],
    ['seperately', 'separately'],
    ['tommorow', 'tomorrow'],
    ['ocurrence', 'occurrence'],
    ['pronounciation', 'pronunciation'],
    ['Febuary', 'February'],
    ['acheive', 'achieve'],
    ['collegue', 'colleague'],
    ['wich', 'which'],
    ['infromation', 'information'],
    ['speling', 'spelling'],
    ['wher', 'where'],
  ];
  const source = examples.map(([wrong]) => wrong).join(' ');
  const result = spellcheck(source);
  const words = result.text.split(' ');
  const correct = words.filter((word, index) => word === examples[index][1]).length;
  const wrong = result.corrections.length - correct;
  const unchanged = examples.length - result.corrections.length;

  t.diagnostic(`${correct}/${examples.length} corrected, ${unchanged} retained, ${wrong} incorrect replacements`);
  assert.equal(correct, 9);
  assert.equal(wrong, 0);
  assert.equal(unchanged, 5);
  assert.deepEqual(result.ambiguities.find(item => item.original === 'collegue')?.candidates,
    ['colleague', 'college']);
  assert.deepEqual(result.corrections.find(item => item.original === 'speling')?.candidates,
    ['spelling', 'spewing', 'spieling']);
});

test('keeps clean English, mixed-case identifiers, links and addresses verbatim', t => {
  const examples = [
    "The colour of O’Neill’s résumé was well-known.",
    'She wrote a letter to a colleague on Wednesday.',
    'Move the center of the square five meters to the north.',
    'The children were already running toward the playground.',
    'Open https://speling.example/writting and contact billing@speling.example.',
    'Drag API and CruxQ beside item_12 and R2D2.',
    "🧪 Don’t touch the café's sign. It'll dry overnight.",
    'Where are the library’s closing hours listed?',
  ];
  const source = examples.join('\n');
  const result = spellcheck(source);
  assert.deepEqual(result, { text: source, changed: false, corrections: [], ambiguities: [] });
  t.diagnostic(`0/${examples.length} clean passages altered`);
});

test('retains case and separators and reports undoable original offsets', () => {
  const source = '🧪  Teh\trecieve!\n';
  const result = spellcheck(source);
  assert.equal(result.text, '🧪  The\treceive!\n');
  assert.deepEqual(result.corrections.map(({ start, end, original, replacement }) => {
    assert.equal(source.slice(start, end), original);
    return [start, end, replacement];
  }), [[4, 7, 'The'], [8, 15, 'receive']]);
});

test('honors supplied domain vocabulary and lets it serve as a candidate', () => {
  const result = spellcheck('calender varzulo varzlo', { knownWords: new Set(['Calender', 'varzulo']) });
  assert.equal(result.text, 'calender varzulo varzulo');
  assert.equal(result.corrections.length, 1);
});

test('standalone CLI accepts stdin and returns JSON with ranked alternatives', () => {
  const cli = fileURLToPath(new URL('../bin/spell.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [cli, '--json'], { input: 'Teh speling.\n', encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), spellcheck('Teh speling.\n'));
});
