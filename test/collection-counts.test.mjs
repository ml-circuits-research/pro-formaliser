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

test('reads existence and listing questions about explicitly written collections', async t => {
  const reader = await createReader({ worldsOnly: true, evidence: true });
  t.after(() => reader.close());
  for (const [text, question, family, description, sort, colour] of [
    ['Does my picture have a house?', 'exists', 'drawn', 'my picture have a house', 'house'],
    ['Got a house in the drawing?', 'exists', 'drawn', 'a house in the drawing', 'house'],
    ['Are there any blue flowers on the canvas?', 'exists', 'drawn', 'any blue flowers on the canvas', 'flower', 'blue'],
    ['Does the document contain a paragraph?', 'exists', 'paragraph', 'the document contain a paragraph'],
    ['What can u see in my picture?', 'list', 'drawn', 'in my picture'],
    ["What's in the picture right now?", 'list', 'drawn', 'in the picture right now'],
    ['List the blue flowers on the canvas.', 'list', 'drawn', 'the blue flowers on the canvas', 'flower', 'blue'],
    ["Explain what's on the page.", 'describe', 'drawn', 'on the page'],
  ]) {
    const result = await reader.propose(text);
    assert.equal(result.error, null, text);
    const candidate = result.candidates.find(({ source, sop }) => source === 'collection-question' && parse(sop).some(wire =>
      wire.type === 'w.request.target' && field(wire, 'family') === family &&
      field(wire, 'sort') === sort));
    assert.ok(candidate, text);
    const wires = parse(candidate.sop);
    const [request, target] = wires;
    assert.deepEqual(['act', 'mood', 'question', 'words'].map(key => field(request, key)),
      ['ask', 'ask', question, text], text);
    assert.deepEqual(['request', 'mode', 'description', 'quantifier'].map(key => field(target, key)),
      ['$' + request.id, 'existing', description, question === 'exists' ? undefined : 'all'], text);
    const constraints = wires.filter(wire => wire.type === 'w.request.constraint');
    assert.deepEqual(constraints.map(wire => ['request', 'attribute', 'phase', 'value'].map(key => field(wire, key))),
      colour ? [['$' + request.id, 'drawn.colour', 'selector', colour]] : [], text);
    assert.equal(wires.length, 2 + constraints.length, text);
    assert.equal(candidate.status, 'matched', text);
    assert.deepEqual(candidate.catalog.issues, [], text);
    assert.deepEqual(candidate.evidence.missing, [], text);
    assert.equal(candidate.evidence.counts.uncovered ?? 0, 0, text);
  }
});

test('requires a licensed noun or population and rejects other speech constructions', async t => {
  const reader = await createReader({ worldsOnly: true });
  t.after(() => reader.close());
  for (const text of [
    'Can I have a fresh sheet of paper?',
    'Do I have a house?',
    'Got a house in the drawing.',
    'Is there a house in the garden?',
    'Are there many houses in the drawing?',
    'What is in the document?',
    'What is on the page if it rains?',
    'What can you see?',
    'List a tree in the picture.',
    'List the items in the picture and move the house.',
    'Write "What is on the canvas?"',
  ]) {
    const result = await reader.propose(text);
    assert.equal(result.error, null, text);
    assert.ok(!result.candidates.some(({ source }) => source === 'collection-question'), text);
  }
});
