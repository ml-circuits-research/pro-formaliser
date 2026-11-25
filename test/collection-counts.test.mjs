import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createReader } from '../src/reader.mjs';
import { parse } from '../src/schema.mjs';

function field(wire, key) {
  const raw = wire?.attrs[key]?.[0];
  return raw?.startsWith('"') ? JSON.parse(raw) : raw;
}

async function propose(reader, text) {
  const result = await reader.propose(text);
  assert.equal(result.engine, 'prolog');
  assert.equal(result.error, null, text);
  return result.candidates.filter(candidate => candidate.source === 'prefix-set-query');
}

function assertCount(candidate, text, { sort, noun, colour, scope, tail }) {
  const wires = parse(candidate.sop);
  const byType = type => wires.filter(wire => wire.type === 'w.request.' + type);
  const requests = byType('request');
  const targets = byType('target');
  assert.equal(requests.length, 1, text);
  assert.equal(targets.length, 1, text);
  const [request] = requests;
  const [target] = targets;
  assert.deepEqual(['act', 'mood', 'question'].map(key => field(request, key)),
    ['ask', 'ask', 'count'], text);
  assert.deepEqual(['request', 'family', 'mode', 'fill', 'quantifier'].map(key => field(target, key)),
    ['$' + request.id, 'drawn', 'existing', 'all', 'all'], text);
  if (sort) assert.equal(field(target, 'sort'), sort, text);
  assert.equal(field(target, 'sort_words') ?? field(target, 'family_words'), noun, text);
  assert.equal(field(target, 'count'), undefined, text);
  if (scope) assert.ok(field(target, 'description')?.includes(scope), text);

  const constraints = byType('constraint');
  assert.deepEqual(constraints.map(wire =>
    [...['request', 'attribute', 'phase', 'value'].map(key => field(wire, key)),
      field(wire, 'words') ?? field(wire, 'value')]),
    colour ? [['$' + request.id, 'drawn.colour', 'selector', colour, colour]] : [], text);
  assert.deepEqual(byType('unread').map(wire => [field(wire, 'request'), field(wire, 'text')]),
    tail ? [['$' + request.id, tail]] : [], text);
  assert.equal(candidate.status, tail ? 'partial' : 'matched', text);
  assert.deepEqual(candidate.catalog.issues, [], text);
  assert.deepEqual(candidate.evidence.missing, [], text);
  assert.equal(candidate.evidence.counts.uncovered ?? 0, 0, text);
}

test('asks for the count of an existing collection with its written selectors and scope', async t => {
  const reader = await createReader({ worldsOnly: true, evidence: true });
  t.after(() => reader.close());
  for (const [text, expected] of [
    ['Tell me how many trees there are.', { sort: 'tree', noun: 'trees' }],
    ['i wanna know how many trees there are', { sort: 'tree', noun: 'trees' }],
    ['How many red balloons are there?', { sort: 'balloon', noun: 'balloons', colour: 'red' }],
    ['number of trees in the picture', { sort: 'tree', noun: 'trees', scope: 'in the picture' }],
    ['How many things are in my picture?', { noun: 'things', scope: 'in my picture' }],
    ['how many red balloons do i have', {
      sort: 'balloon', noun: 'balloons', colour: 'red', tail: 'do i have',
    }],
  ]) {
    const candidates = await propose(reader, text);
    const candidate = candidates.find(({ sop }) => parse(sop).some(wire =>
      wire.type === 'w.request.target' && field(wire, 'family') === 'drawn' &&
      (!expected.sort || field(wire, 'sort') === expected.sort)));
    assert.ok(candidate, text);
    assertCount(candidate, text, expected);
  }
});

test('does not match collection counts through unsupported nouns, qualifiers or clauses', async t => {
  const reader = await createReader({ worldsOnly: true });
  t.after(() => reader.close());
  for (const text of [
    'How many quorvaxes are there?',
    'How many allegedly rare trees are there?',
    'How many trees are there if the picture is finished?',
    'Write "How many trees are there?"',
    'How many trees are there and move the house?',
  ]) {
    assert.deepEqual(await propose(reader, text), [], text);
  }
});
