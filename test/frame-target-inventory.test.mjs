import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createReader } from '../src/reader.mjs';
import { parse } from '../src/schema.mjs';

const values = (wire, key) => (wire.attrs[key] ?? []).map(raw =>
  raw.startsWith('"') ? JSON.parse(raw) : raw);
const inventoryCandidates = result => result.candidates.filter(candidate =>
  candidate.source === 'frame-target-inventory');

test('declared action frames ground existing drawable sorts with written noun evidence', async t => {
  const reader = await createReader({ worldsOnly: true, evidence: true });
  t.after(() => reader.close());

  for (const [text, act, predicate, sort, sortWords] of [
    ['Remove the grass', 'remove', 'Remove', 'grass'],
    ['Remove this puppy', 'remove', 'Remove', 'dog', 'puppy'],
    ['Select the daffodils', 'pick', 'Select', 'daffodil', 'daffodils'],
  ]) {
    const result = await reader.propose(text);
    assert.equal(result.engine, 'prolog', text);
    assert.equal(result.error, null, text);
    const candidates = inventoryCandidates(result);
    assert.ok(candidates.length, text);

    for (const candidate of candidates) {
      const wires = parse(candidate.sop);
      const requests = wires.filter(wire => wire.type === 'w.request.request');
      const targets = wires.filter(wire => wire.type === 'w.request.target');
      assert.equal(requests.length, 1, text);
      assert.equal(targets.length, 1, text);
      const [request] = requests;
      const [target] = targets;
      assert.deepEqual(values(request, 'act'), [act], text);
      assert.deepEqual(values(request, 'predicate'), [predicate], text);
      assert.deepEqual(values(target, 'request'), ['$' + request.id], text);
      assert.deepEqual(values(target, 'family'), ['drawn'], text);
      assert.deepEqual(values(target, 'mode'), ['existing'], text);
      assert.deepEqual(values(target, 'sort'), [sort], text);
      if (sortWords) assert.deepEqual(values(target, 'sort_words'), [sortWords], text);
      assert.equal(candidate.status, 'matched', text);
      assert.deepEqual(candidate.catalog.issues, [], text);
      assert.deepEqual(candidate.evidence.missing, [], text);
      assert.equal(candidate.evidence.counts.unread ?? 0, 0, text);
      assert.equal(candidate.evidence.counts.uncovered ?? 0, 0, text);
    }
  }
});

test('native existing targets require a standalone affirmative action with a licensed noun role', async t => {
  const reader = await createReader({ worldsOnly: true, evidence: true });
  t.after(() => reader.close());

  for (const text of [
    'Save the grass',
    'Copy the grass',
    'Remove it',
    'Remove "the grass"',
    'Is there grass?',
    'Do not remove grass',
    'Remove grass if approved',
    'Draw a daffodil',
  ]) {
    const result = await reader.propose(text);
    assert.equal(result.error, null, text);
    assert.deepEqual(inventoryCandidates(result), [], text);
  }
});
