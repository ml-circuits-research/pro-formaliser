import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { spellcheck } from '../src/spell.mjs';
import { learnPredicatePairs, learnSpellingProtection } from '../src/spelling-training.mjs';

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
  const result = spellcheck(source, { context: null });
  const words = result.text.split(' ');
  const correct = words.filter((word, index) => word === examples[index][1]).length;
  const wrong = result.corrections.length - correct;
  const unchanged = examples.length - result.corrections.length;

  t.diagnostic(`${correct}/${examples.length} corrected, ${unchanged} retained, ${wrong} incorrect replacements`);
  assert.equal(correct, 10);
  assert.equal(wrong, 2);
  assert.equal(unchanged, 2);
  assert.deepEqual(result.corrections.find(item => item.original === 'collegue')?.candidates,
    ['college', 'colleague']);
  assert.ok(result.ambiguities.find(item => item.original === 'wher')?.candidates.includes('where'));
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

test('keeps English terms present in the pinned SOP worlds', () => {
  const source = 'Use cyan and a monospace font.';
  const result = spellcheck(source);
  assert.equal(result.text, source);
  assert.deepEqual(result.ambiguities, []);
});

test('uses local word pair evidence without crossing phrase boundaries', () => {
  const context = {
    counts: { invite: 2000, colleague: 2000, college: 2000 },
    pairs: { 'invite colleague': 1800 },
    total: 100000,
  };
  const result = spellcheck('Invite collegue. Invite, collegue. Invite\ncollegue.', { context });
  assert.equal(result.text, 'Invite colleague. Invite, college. Invite\ncollege.');
  assert.deepEqual(result.corrections[0].candidates, ['colleague', 'college']);
});

test('corrects dictionary words only when the phrase supports the replacement', () => {
  const source = 'Please move the block too the left. The dog wants to play too.\n' +
    'Please dray the red rectangle. The dray carried sacks of potatoes. Please dray, the red rectangle.';
  const result = spellcheck(source);
  assert.equal(result.text, 'Please move the block to the left. The dog wants to play too.\n' +
    'Please draw the red rectangle. The dray carried sacks of potatoes. Please dray, the red rectangle.');
  assert.deepEqual(result.corrections.map(change => [
    source.slice(change.start, change.end), change.replacement, change.candidates[0],
  ]), [['too', 'to', 'to'], ['dray', 'draw', 'draw']]);
  assert.equal(spellcheck(source, { context: null }).text, source);
  assert.equal(spellcheck(source, { knownWords: ['too', 'dray'] }).text, source);
});

test('keeps attested words outside the dictionary, including names and informal usage', () => {
  const source = 'Reposition the hatless woman. Set Calibri at 36 points. ' +
    'That is enough thx. Actually nvm.';
  const result = spellcheck(source);
  assert.equal(result.text, source);
  assert.deepEqual(result.corrections, []);
});

test('protects a name only with matching canonical evidence in distinct utterances', () => {
  const target = name => `@t w.request.target request=$r family=page mode=existing name="${name}"`;
  const rows = [
    { text: 'Open Stormm and returrn', sop: target('Stormm') },
    { text: ' OPEN  STORMM AND RETURRN ', sop: target('Stormm') },
    { text: 'Find Stormm and returrn', sop: target('Stormm') },
    { text: 'Show the Stormm report and returrn', sop: target('Stormm') },
    { text: 'Use Outtpost', sop: target('Outtpost Subsidiary') },
    { text: 'See Outtpost', sop: target('Outtpost Subsidiary') },
    { text: 'Open Outtpost', sop: target('Outtpost Subsidiary') },
    { text: 'Use Flintt', sop: target('Flintt') },
    { text: 'See Flintt', sop: target('Flintt') },
    { text: 'Open Flintt', sop: target('Flintt') },
    { text: 'Find Flintt', sop: target('Flint') },
    { text: 'Move Flintt', sop: target('Flint') },
    { text: 'Drag Flintt', sop: target('Flint') },
  ];
  const dictionary = new Set(['open', 'and', 'find', 'show', 'the', 'report', 'use', 'see']);
  assert.deepEqual(learnSpellingProtection(rows.slice(0, 3), dictionary), []);
  const protectedWords = learnSpellingProtection(rows, dictionary);
  assert.deepEqual(protectedWords, ['stormm']);
  assert.equal(spellcheck('Open Stormm now', { context: null }).text, 'Open Storm now');
  assert.equal(spellcheck('Open Stormm now', { context: {
    counts: {}, pairs: {}, total: 1, protectedWords,
  } }).text, 'Open Stormm now');
});

test('keeps a corroborated verb after a conjunction and still fixes a nearby typo',()=>{
  const source='Bodl the field and ink the words silver';
  const context={
    counts:{},pairs:{},total:1,wordCounts:{},allPairs:{'bold the':2000},triples:{'and in the':1000}
  };
  const rows=['Ink the headline','Ink the caption'].map(text=>({
    text,sop:'@r w.request.request act=change mood=do predicate=ink'
  }));
  const dictionary=new Set(['ink']);
  assert.deepEqual(learnPredicatePairs([rows[0],rows[0]],dictionary),{});
  assert.match(spellcheck(source,{context}).text,/and in the/u);
  const predicatePairs=learnPredicatePairs(rows,dictionary);
  assert.deepEqual(predicatePairs,{'ink the':true});
  assert.equal(spellcheck(source,{context:{...context,predicatePairs}}).text,'Bold the field and ink the words silver');
});

test('standalone CLI accepts stdin and returns JSON with ranked alternatives', () => {
  const cli = fileURLToPath(new URL('../bin/spell.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [cli, '--json'], { input: 'Teh speling.\n', encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), spellcheck('Teh speling.\n'));
});

test('restores a missing space only when neighbouring words corroborate the split',()=>{
  const context={counts:{},pairs:{},total:1,wordCounts:{},allPairs:{'damp soil':8},triples:{'the damp soil':4}};
  const input='🪴 Touch the dampsoil here.';
  const result=spellcheck(input,{context});
  assert.equal(result.text,'🪴 Touch the damp soil here.');
  const edit=result.corrections.find(c=>c.replacement==='damp soil');
  assert.equal(input.slice(edit.start,edit.end),'dampsoil');
  assert.equal(spellcheck('Touch the Dampsoil here.',{context}).corrections.some(c=>c.replacement.includes(' ')),false);
  assert.equal(spellcheck('Touch the dampsoil here.',{context,knownWords:['dampsoil']}).changed,false);
  assert.equal(spellcheck('Touch the dampsoil here.',{context:{...context,triples:{}}}).corrections.some(c=>c.replacement.includes(' ')),false);
});
