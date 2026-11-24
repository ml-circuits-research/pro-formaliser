import assert from 'node:assert/strict';
import test from 'node:test';
import { tokenize, train } from '../src/model.mjs';

test('tokenization preserves Unicode spelling, punctuation and source offsets', () => {
  assert.deepEqual(tokenize('🧪 Élan_2!'), [
    { raw: '🧪', key: '🧪', start: 0, end: 2 },
    { raw: 'Élan_2', key: 'élan_2', start: 3, end: 9 },
    { raw: '!', key: '!', start: 9, end: 10 },
  ]);
});

test('induction copies a changing number into evidence and a standalone value', () => {
  const row = value => ({
    text: `move it to ${value}`,
    sop: `@r1 w.request.request predicate=move words="move it to ${value}"\n@r1.c1 w.request.constraint request=$r1 attribute=test.position value="${value}"`,
  });
  const model = train([row(10), row(40), row(10)]);
  assert.deepEqual(model.examples, []);
  assert.deepEqual(model.templates, [{
    pattern: ['move', 'it', 'to', { slot: 0, kind: 'number', min: 1, max: 4 }],
    parts: [
      '@r1 w.request.request predicate=move words="move it to ',
      { slot: 0, quote: 'escape' },
      '"\n@r1.c1 w.request.constraint request=$r1 attribute=test.position value=',
      { slot: 0, quote: 'always' },
    ],
    count: 3,
  }]);
});

test('stable values remain literal while an observed name can change', () => {
  const row = name => ({
    text: `label 10 as ${name}`,
    sop: `@r1 w.request.target name=${name}\n@r1.c1 w.request.constraint value=10`,
  });
  const { templates } = train([row('Apple'), row('Pear')]);
  assert.deepEqual(templates, [{
    pattern: ['label', '10', 'as', { slot: 0, min: 1, max: 12 }],
    parts: ['@r1 w.request.target name=', { slot: 0, quote: 'auto' },
      '\n@r1.c1 w.request.constraint value=10'],
    count: 2,
  }]);
});

test('arbitrary enum values and unproven captures remain exact examples', () => {
  const rows = [
    { text: 'paint it green', sop: '@r1.c1 w.request.constraint value=green' },
    { text: 'paint it blue', sop: '@r1.c1 w.request.constraint value=blue' },
    { text: 'label as Apple', sop: '@r1 w.request.target name=Apple' },
    { text: 'label as Apple', sop: '@r1 w.request.target name=Apple' },
  ];
  const { examples, templates } = train(rows);
  assert.deepEqual(templates, []);
  assert.deepEqual(examples, [
    { ...rows[0], count: 1 },
    { ...rows[1], count: 1 },
    { ...rows[2], count: 2 },
  ]);
});

test('a changing full request cannot replace the predicate and its arguments', () => {
  const row = enabled => ({
    text: `please switch ${enabled}.`,
    sop: `@r1 w.request.request predicate=switch\n@r1.c1 w.request.constraint value="switch ${enabled}" open_value=true`,
  });
  const { templates } = train([row('on'), row('off')]);
  assert.deepEqual(templates, []);
});

test('ambiguous observed circuits remain available even with a matching template', () => {
  const row = value => ({
    text: `move by ${value}`,
    sop: `@r1.c1 w.request.constraint attribute=test.offset value="${value}"`,
  });
  const alternative = { text: row(2).text, sop: '@r1 w.request.unread text="move by 2"' };
  const { examples, templates } = train([row(1), row(2), alternative]);
  assert.equal(templates.length, 1);
  assert.deepEqual(examples, [{ ...row(2), count: 1 }, { ...alternative, count: 1 }]);
});

test('generic connectors retain observed title width for both open operands', () => {
  const row = (first,second) => ({
    text: first+' for '+second,
    sop: '@a w.request.target name='+first+'\n@b w.request.target name='+second,
  });
  const {templates}=train([row('Aspen','Larch'),row('Hazel','Cedar')]);
  assert.equal(templates.length,1);
  assert.deepEqual(templates[0].pattern.map(part=>part.titleWidth ?? part),[1,'for',1]);
});
