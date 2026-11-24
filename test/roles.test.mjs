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
    const change = await reader.formalise('make the red object blue', { tab: 'drawing' });
    assert.equal(fields(change.sop, 'request')[0].act, 'change');
    const [target] = fields(change.sop, 'target');
    assert.equal(target.mode, 'existing');
    assert.equal(target.determiner, 'definite');
    assert.deepEqual(fields(change.sop, 'constraint').map(({ attribute, phase, value }) =>
      [attribute, phase, value]), [
      ['drawn.colour', 'selector', 'red'],
      ['drawn.colour', 'result', 'blue'],
    ]);

    const create = await reader.formalise('make a red object', { tab: 'drawing' });
    assert.equal(fields(create.sop, 'target')[0].mode, 'new');
    assert.equal(fields(create.sop, 'constraint')[0].phase, 'result');
  } finally {
    await reader.close();
  }
});

test('anchors have their own lookup and their modifiers stay off the direct target', async () => {
  const reader = createReader();
  try {
    const options = { tab: 'drawing' };
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

    const named = await reader.formalise('move this red object near the blue object', { tab: 'drawing' });
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
    const result = await reader.formalise('move the red object near ' + anchor, { tab: 'drawing' });
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
    { tab: 'demo', family: 'beacon', name: 'beacon.position', head: 'class', values: ['near'] },
    { tab: 'demo', family: 'beacon', name: 'beacon.relation', head: 'candidate', values: [] },
    { tab: 'demo', family: 'beacon', name: 'beacon.anchor', head: 'fill+span', values: [] },
  ];
  const input = [
    '@r w.request.request act=place predicate=move',
    '@t w.request.target request=$r family=beacon mode=existing',
    '@c w.request.constraint request=$r on=place operator=relation phase=result relation="near" value="Base 3" words="close beside Base 3"',
    '@l w.request.lookup request=$r constraint=$c key=thing from=page',
  ].join('\n');
  const placement = {tab:'demo',family:'beacon',relationKey:'beacon.position',anchorKey:'beacon.anchor'};
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
@heading w.request.key tab=observatory family=beacon name=beacon.heading head=class value=near
@landmark w.request.key tab=observatory family=beacon name=beacon.landmark head="fill+span"
@spatial pro.reader.spatial tab=observatory family=beacon relation_key=beacon.heading anchor_key=beacon.landmark
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
    for (const [context, family] of [
      [{ tab: 'drawing' }, 'drawn'],
      [{ tab: 'diagram' }, 'node'],
      [{ entities: [{ id: 'selected-node', family: 'node', selected: true }] }, 'node'],
    ]) {
      const ranked = await reader.formalise(text, { context });
      assert.equal(fields(ranked.sop, 'target')[0].family, family);
      assert.deepEqual([ranked, ...ranked.alternatives].sort((a, b) => a.generatorIndex - b.generatorIndex)
        .map(candidate => candidate.sop), original.map(candidate => candidate.sop));
    }
  } finally {
    await reader.close();
  }
});
