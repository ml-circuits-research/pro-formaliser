import assert from 'node:assert/strict';
import test from 'node:test';
import { learnConstraints } from '../src/constraints.mjs';

function row(text, fields, family = 'group', act = 'change') {
  return {
    text,
    sop: `@r1 w.request.request act=${act} mood=do predicate=make\n` +
      `@r1.t w.request.target request=$r1 family=${family} mode=existing\n` +
      `@r1.c1 w.request.constraint request=$r1 on=attribute ${fields}`,
  };
}

test('learns a grounded span, including a sourced alias for a closed value', () => {
  const fields = 'attribute=group.colour value=cyan words=aqua operator=eq phase=result key_words=colour';
  const model = learnConstraints([
    row('make the group colour aqua', fields),
    row('for the other group, make the colour aqua', fields),
  ]);
  assert.deepEqual(model, {
    'colour aqua': [['constraint', 'change', 'group',
      'on=attribute attribute=group.colour value=cyan words=aqua operator=eq phase=result key_words=colour', 2]],
  });
});

test('keeps repeated values when all list entries are present in the span', () => {
  const fields = 'attribute=group.colour value=blue value=cyan operator=eq phase=result key_words=colour';
  const model = learnConstraints([
    row('make the group colour blue and cyan', fields),
    row('for the other group, make the colour blue and cyan', fields),
  ]);
  assert.deepEqual(model['colour blue and cyan'], [['constraint', 'change', 'group',
    'on=attribute attribute=group.colour value=blue value=cyan operator=eq phase=result key_words=colour', 2]]);
});

test('omits unsupported units, negation, selector, open and disconnected spans', () => {
  const color = 'attribute=group.colour value=blue operator=eq';
  const samples = [
    ['colour blue meters', color + ' phase=result key_words=colour unit=metre'],
    ['not colour blue', color + ' phase=result key_words=colour'],
    ['colour blue', color + ' phase=result key_words=colour want=no'],
    ['colour blue', color + ' phase=selector key_words=colour'],
    ['colour blue', color + ' phase=result key_words=colour open_value=true'],
    ['colour some unrelated content blue', color + ' phase=result key_words=colour'],
    ['colour blue', color + ' phase=result key_words=paint'],
  ];
  for (const [phrase, fields] of samples) {
    const model = learnConstraints([row('make the group ' + phrase, fields), row('make the other group ' + phrase, fields)]);
    assert.deepEqual(model, {}, phrase + ': ' + fields);
  }
});

test('requires distinct requests and agreement for a single act and family', () => {
  const blue = 'attribute=group.colour value=blue words=bright operator=eq phase=result key_words=colour';
  const cyan = blue.replace('value=blue', 'value=cyan');
  const examples = [
    row('make the group colour bright', blue),
    row('make the other group colour bright', blue),
    row('make the second group colour bright', cyan),
  ];
  assert.deepEqual(learnConstraints([examples[0], examples[0]]), {});
  assert.deepEqual(learnConstraints(examples), {});
});

test('learns a bare value with a unique attribute in the pinned key bank', () => {
  const fields = 'attribute=group.colour value=blue operator=eq phase=result';
  const model = learnConstraints([
    row('make group blue', fields),
    row('make the second group blue', fields),
  ]);
  assert.deepEqual(model, { blue: [['constraint', 'change', 'group',
    'on=attribute attribute=group.colour value=blue operator=eq phase=result', 2]] });
});

test('requires stronger observed support for a declared candidate key without a value list', () => {
  const fields = 'attribute=drawn.colour value=blue operator=eq phase=result';
  const examples = ['box', 'circle', 'pentagon', 'kite', 'line'].map(noun => row('make ' + noun + ' blue', fields, 'drawn'));
  assert.deepEqual(learnConstraints(examples.slice(0, 4)), {});
  assert.deepEqual(learnConstraints(examples), { blue: [['constraint', 'change', 'drawn',
    'on=attribute attribute=drawn.colour value=blue operator=eq phase=result', 5]] });
});

test('keeps bare values out when another attribute has the same unqualified evidence', () => {
  const colour = 'attribute=drawn.colour value=blue operator=eq phase=result';
  const outline = colour.replace('drawn.colour', 'drawn.outline');
  const examples = ['box', 'circle', 'pentagon', 'kite', 'line'].map(noun => row('make ' + noun + ' blue', colour, 'drawn'));
  assert.equal(learnConstraints([...examples, row('make tab blue', outline, 'drawn')]).blue, undefined);
  assert.equal(learnConstraints([...examples,
    row('make tab outline blue', outline + ' key_words=outline', 'drawn')]).blue.length, 1);
});
