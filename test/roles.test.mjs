import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createReader } from '../src/runtime.mjs';
import { parse } from '../src/schema.mjs';
import { createRelationKeyResolver } from '../src/relation-keys.mjs';
import { loadWorlds } from '../src/worlds.mjs';

function fields(sop, type) {
  return parse(sop).filter(wire => wire.type === 'w.request.' + type).map(wire =>
    Object.fromEntries(Object.entries(wire.attrs).map(([key, [value]]) =>
      [key, value.startsWith('"') ? JSON.parse(value) : value])));
}

test('attaches nominal modifiers and resultative complements to separate phases', async () => {
  const reader = createReader();
  try {
    const change = await reader.formalise('make the red object blue', {});
    assert.equal(fields(change.sop, 'request')[0].act, 'change');
    const [target] = fields(change.sop, 'target');
    assert.equal(target.mode, 'existing');
    assert.equal(target.determiner, 'definite');
    assert.deepEqual(fields(change.sop, 'constraint').map(({ attribute, phase, value }) =>
      [attribute, phase, value]), [
      ['drawn.colour', 'selector', 'red'],
      ['drawn.colour', 'result', 'blue'],
    ]);

    const create = await reader.formalise('make a red object', {});
    assert.equal(fields(create.sop, 'target')[0].mode, 'new');
    assert.equal(fields(create.sop, 'constraint')[0].phase, 'result');
  } finally {
    await reader.close();
  }
});

test('anchors have their own lookup and their modifiers stay off the direct target', async () => {
  const reader = createReader();
  try {
    const options = {};
    const move = await reader.formalise('move the red object near the blue object', options);
    assert.equal(fields(move.sop, 'target').length, 1);
    const constraints = fields(move.sop, 'constraint');
    const relation = constraints.find(row => row.attribute === 'drawn.relation');
    const anchor = constraints.find(row => row.attribute === 'drawn.anchor');
    assert.equal(relation.phase, 'result');
    assert.equal(relation.value, 'near');
    assert.equal(anchor.value, 'the blue object');
    assert.equal(anchor.phase, 'selector');
    const anchorWire = parse(move.sop).find(wire => wire.attrs.attribute?.[0] === 'drawn.anchor');
    assert.ok(fields(move.sop, 'lookup').some(row => row.constraint === '$' + anchorWire.id && row.key === 'thing'));
    assert.deepEqual(constraints.filter(row => row.attribute === 'drawn.colour').map(row => [row.value, row.phase]),
      [['red', 'selector']]);
    assert.ok(move.alternatives.some(candidate => fields(candidate.sop, 'constraint').some(row =>
      row.attribute === 'drawn.relation' && row.value === 'near' && row.phase === 'selector')));

    const remove = await reader.formalise('delete the red object near the blue object', options);
    assert.equal(fields(remove.sop, 'constraint').find(row => row.attribute === 'drawn.relation').phase, 'selector');

    const noDirect = await reader.formalise('move it near the blue object');
    assert.deepEqual(fields(noDirect.sop, 'target'), []);
    assert.equal(fields(noDirect.sop, 'request')[0].refers, 'thing');
    assert.ok(fields(noDirect.sop, 'unread').some(row => row.text === 'near the blue object'));
    assert.ok(fields(noDirect.sop, 'constraint').every(row => row.operator !== 'relation'));
  } finally {
    await reader.close();
  }
});

test('an object pronoun cannot ground a learned nominal sort', async () => {
  const text = 'move it near the blue object';
  const unsupported = '@r w.request.request act=place predicate=move\n' +
    '@t w.request.target request=$r family=drawn mode=existing sort=roof sort_words=it';
  const reader = createReader({
    version: 1,
    examples: [{ text, sop: unsupported, count: 20 }],
    templates: [],
    lexicon: {
      move: [['act', 'undo', 'do', 20]],
      it: [['target', 'place', 'drawn', 'existing', 'roof', 20]],
      object: [['target', 'undo', 'drawn', 'existing', '', 20]],
    },
  });
  try {
    const result = await reader.formalise(text);
    for (const candidate of [result, ...result.alternatives]) {
      assert.ok(fields(candidate.sop, 'target').every(target => target.sort !== 'roof'));
    }
    assert.equal(fields(result.sop, 'request')[0].refers, 'thing');
    assert.deepEqual(fields(result.sop, 'target'), []);
    assert.ok(fields(result.sop, 'unread').some(row => row.text === 'near the blue object'));

    const named = await reader.formalise('move this red object near the blue object', {});
    assert.equal(fields(named.sop, 'target')[0].determiner, 'demonstrative');
    assert.notEqual(fields(named.sop, 'request')[0].refers, 'thing');
  } finally {
    await reader.close();
  }
});

test('collapses duplicate nominal paths through a long anchor description', async () => {
  const reader = createReader();
  try {
    const anchor = 'the ' + 'blue '.repeat(12) + 'object';
    const result = await reader.formalise('move the red object near ' + anchor, {});
    const constraints = fields(result.sop, 'constraint');
    const relation = constraints.find(row => row.attribute === 'drawn.relation');
    assert.equal(constraints.find(row => row.attribute === 'drawn.anchor').value, anchor);
    assert.equal(relation.phase, 'result');
  } finally {
    await reader.close();
  }
});

test('resolves relation and anchor keys from matching family declarations', () => {
  const keys = [
    { family: 'beacon', name: 'beacon.position', head: 'class', values: ['near'] },
    { family: 'beacon', name: 'beacon.relation', head: 'candidate', values: [] },
    { family: 'beacon', name: 'beacon.anchor', head: 'fill+span', values: [] },
  ];
  const input = [
    '@r w.request.request act=place predicate=move',
    '@t w.request.target request=$r family=beacon mode=existing',
    '@c w.request.constraint request=$r on=place operator=relation phase=result relation="near" value="Base 3" words="close beside Base 3"',
    '@l w.request.lookup request=$r constraint=$c key=thing from=page',
  ].join('\n');
  const placement = {family:'beacon',relationKey:'beacon.position',anchorKey:'beacon.anchor'};
  assert.deepEqual(fields(createRelationKeyResolver({requestKeys:keys})(input),'constraint'),[]);
  const resolved = createRelationKeyResolver({ requestKeys: keys, spatialBindings:[placement] })(input);
  assert.deepEqual(fields(resolved, 'constraint').map(row =>
    [row.attribute, row.value, row.words]), [
    ['beacon.position', 'near', 'close beside'],
    ['beacon.anchor', 'Base 3', undefined],
  ]);
  assert.equal(fields(resolved, 'lookup')[0].constraint, '$c.anchor');

  const conflicting = { ...keys[1], head: 'class', values: ['near'] };
  const ambiguous = createRelationKeyResolver({ requestKeys: [...keys, conflicting],
    spatialBindings:[placement,{...placement,relationKey:'beacon.relation'}] })(input);
  assert.deepEqual(fields(ambiguous, 'constraint'), []);
  assert.deepEqual(fields(ambiguous, 'lookup'), []);
  assert.equal(fields(ambiguous, 'unread')[0].text, 'close beside Base 3');
});

test('reads a novel spatial family with explicitly declared non-conventional keys', async t => {
  const cache = fileURLToPath(new URL('../.cache/', import.meta.url));
  const directory = mkdtempSync(join(cache, 'spatial-test-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const file = join(directory, 'observatory.sop');
  writeFileSync(file, `@observatory std.schema.world name=w.observatory
@beacon std.schema.kind of=w.observatory.beacon world=w.observatory acts=make
@beacon_word core.word text=retroscope means=w.observatory.beacon
@heading w.request.key family=beacon name=beacon.heading head=class value=near
@landmark w.request.key family=beacon name=beacon.landmark head="fill+span"
@spatial pro.reader.spatial family=beacon relation_key=beacon.heading anchor_key=beacon.landmark
`);
  const reader = createReader(undefined, loadWorlds({ paths: [file] }));
  try {
    const result = await reader.formalise('create a retroscope near the retroscope');
    const constraints = fields(result.sop, 'constraint');
    assert.deepEqual(constraints.map(({ attribute, phase, value }) => [attribute, phase, value]), [
      ['beacon.heading', 'result', 'near'],
      ['beacon.landmark', 'selector', 'the retroscope'],
    ]);
    const unsupported = await reader.formalise('create a retroscope behind the retroscope');
    assert.deepEqual(fields(unsupported.sop, 'constraint'), []);
    assert.ok(fields(unsupported.sop, 'unread').some(wire => wire.text === 'behind the retroscope'));
  } finally {
    await reader.close();
  }
});

test('context reorders the same unbound spatial family hypotheses', async () => {
  const reader = createReader();
  try {
    const text = 'move it near the blue object';
    const textOnly = await reader.formalise(text);
    assert.equal(fields(textOnly.sop, 'request')[0].refers, 'thing');
    assert.deepEqual(fields(textOnly.sop, 'target'), []);
    const original = [textOnly, ...textOnly.alternatives];
    const typed = original.filter(candidate => fields(candidate.sop, 'target').length);
    assert.deepEqual([...new Set(typed.map(candidate => fields(candidate.sop, 'target')[0].family))].sort(),
      ['drawn', 'node']);
    for (const candidate of typed) {
      const [target] = fields(candidate.sop, 'target');
      assert.equal(fields(candidate.sop, 'request')[0].refers, 'thing');
      assert.equal(target.fill, 'context');
      assert.equal(target.mode, 'existing');
      assert.ok(!target.name && !target.sort && !target.ids);
      const targetWire = parse(candidate.sop).find(wire => wire.type === 'w.request.target');
      assert.ok(fields(candidate.sop, 'lookup').some(row =>
        row.target === '$' + targetWire.id && row.key === 'thing' && row.from === 'any'));
    }
    const {candidates}=await reader.propose(text);
    assert.deepEqual(new Set(candidates.map(candidate=>candidate.sop)),new Set(original.map(candidate=>candidate.sop)));
  } finally {
    await reader.close();
  }
});

test('written nouns keep demonstratives nominal even if the action lacks a target binding', async t => {
  const reader = createReader();
  t.after(() => reader.close());
  for (const [text, act, object] of [
    ['Copy that tree','copy','that tree'],
    ['Copy those trees','copy','those trees'],
    ['Copy that red tree','copy','that red tree'],
    ['Save that chart','save','that chart'],
  ]) {
    const { candidates } = await reader.propose(text);
    const actions = candidates.filter(({sop}) => fields(sop, 'request').some(r => r.act === act));
    assert.ok(actions.length,text);
    assert.ok(actions.every(({sop}) => fields(sop, 'request').every(r => !r.refers)),text);
    assert.ok(actions.some(({sop}) => fields(sop, 'unread').some(r => r.text === object)),text);
  }
  for (const [text, pronoun] of [['Copy it','it'],['Copy that again','that'],['Copy that back','that']]) {
    const { candidates } = await reader.propose(text);
    const reference = candidates.find(({sop}) => fields(sop, 'request').some(r => r.act === 'copy' && r.refers));
    assert.ok(reference,text);
    assert.ok(fields(reference.sop,'lookup').some(r => r.words === pronoun && r.from !== 'previous'),text);
  }
});

test('a native copy applicability and noun inventory keeps the written object as its source',async t => {
  const worlds = loadWorlds({paths:['sop-worlds/copy-target-pilot']});
  const reader = createReader(undefined,worlds);
  t.after(() => reader.close());
  for (const [text, object] of [
    ['Copy that tree','tree'],['Copy the boat','boat'],['Make a copy of that house','house'],
  ]) {
    const { candidates } = await reader.propose(text,{evidence:true});
    const reading = candidates.find(({sop}) =>
      fields(sop,'request').some(r => r.act === 'copy') &&
      fields(sop,'target').some(r => r.family === 'drawn' && r.sort === object && r.mode === 'existing'));
    assert.ok(reading,text);
    assert.deepEqual(fields(reading.sop,'unread'),[],text);
    assert.deepEqual(reading.catalog.issues,[],text);
    assert.deepEqual(reading.evidence.missing,[],text);
  }
});
