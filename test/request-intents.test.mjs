import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createReader } from '../src/runtime.mjs';
import { parse } from '../src/schema.mjs';
import { loadWorlds } from '../src/worlds.mjs';

function read(wire, key) {
  const value = wire.attrs[key]?.[0];
  return value?.startsWith('"') ? JSON.parse(value) : value;
}

function owns(wire, request) {
  return read(wire, 'request') === '$' + request.id;
}

function intents(wires) {
  return wires.filter(wire => wire.type === 'w.request.intent');
}

function intentFields(wire) {
  return ['role', 'value', 'words', 'want'].map(key =>
    read(wire, key) ?? (key === 'want' ? 'yes' : undefined));
}

test('delivers purpose and destination on the independent analytical request', async t => {
  const reader = createReader();
  t.after(() => reader.close());
  const text = 'Create a sales chart, then calculate total revenue to explain the change to the board and put that answer on the summary slide';
  const { candidates } = await reader.propose(text, { evidence: true });
  const expected = [
    ['purpose', 'explain the change to the board', 'to explain the change to the board', 'yes'],
    ['destination', 'the summary slide', 'and put that answer on the summary slide', 'yes'],
  ];
  const candidate = candidates.find(candidate => {
    const wires = parse(candidate.sop);
    const requests = wires.filter(wire => wire.type === 'w.request.request');
    const chart = requests.find(wire => read(wire, 'predicate')?.toLowerCase() === 'create');
    const analysis = requests.find(wire => read(wire, 'predicate')?.toLowerCase() === 'calculate');
    if (requests.length !== 2 || !chart || !analysis || read(analysis, 'question') !== 'total' ||
        read(analysis, 'asked_words') !== 'total revenue') return false;
    if (!wires.some(wire => wire.type === 'w.request.target' &&
      owns(wire, chart) && read(wire, 'family') === 'chart')) return false;
    const relations = intents(wires);
    return relations.length === expected.length && relations.every(wire => owns(wire, analysis)) &&
      expected.every(fields => relations.some(wire =>
        intentFields(wire).every((field, index) => field === fields[index])));
  });
  assert.ok(candidate, text);
  assert.deepEqual(candidate.catalog.issues, []);
  assert.deepEqual(candidate.evidence.missing, []);
});

test('keeps independent owners and excludes quantification from purpose', async t => {
  const reader = createReader();
  t.after(() => reader.close());
  const text = 'Create a chart for the board, then compute total refunds to compare the regions.';
  const { candidates } = await reader.propose(text, { evidence: true });
  assert.ok(candidates.some(candidate => {
    const wires = parse(candidate.sop);
    const chart = wires.find(wire => read(wire, 'predicate') === 'Create');
    const result = wires.find(wire => read(wire, 'predicate') === 'compute');
    return chart && result && intents(wires).some(wire => owns(wire, chart) && read(wire, 'value') === 'the board') &&
      intents(wires).some(wire => owns(wire, result) && read(wire, 'value') === 'compare the regions') &&
      !candidate.evidence.counts.unread && !candidate.evidence.counts.uncovered;
  }));
  const quantified = await reader.propose('Create a chart for each district.');
  assert.ok(quantified.candidates.every(candidate => !intents(parse(candidate.sop)).length));
});

test('uses an installed role frame and preserves negative delivery with written evidence', async t => {
  const overlay = await mkdtemp(join(tmpdir(), 'request-intents-'));
  await writeFile(join(overlay, 'intents.sop'),
    '@intent.test pro.reader.request_intent_frame text="with the aim to" role=purpose form=verbal owner=request want=yes\n');
  const reader = createReader(undefined, loadWorlds({ paths: [overlay] }));
  t.after(async () => { await reader.close(); await rm(overlay, {recursive: true}); });
  const text = 'Compute total refunds with the aim to compare the regions and do not put the result in the appendix.';
  const { candidates } = await reader.propose(text, { evidence: true });
  assert.ok(candidates.some(candidate => {
    const wires = parse(candidate.sop);
    const owner = wires.find(wire => read(wire, 'predicate') === 'Compute');
    const relations = intents(wires);
    return owner && relations.length === 2 && relations.every(wire => owns(wire, owner)) &&
      relations.some(wire => read(wire, 'words') === 'with the aim to compare the regions') &&
      relations.some(wire => read(wire, 'value') === 'the appendix' && read(wire, 'want') === 'no') &&
      !candidate.evidence.counts.unread && !candidate.evidence.counts.uncovered;
  }), text);
});

test('grounds a negated purpose on an affirmative creation request', async t => {
  const reader = createReader();
  t.after(() => reader.close());
  const text = 'Make a bar chart of revenue by region, not for social media.';
  const { candidates } = await reader.propose(text, { evidence: true });
  const candidate = candidates.find(candidate => {
    const wires = parse(candidate.sop);
    const request = wires.find(wire => wire.type === 'w.request.request' && read(wire, 'act') === 'make');
    if (!request || !wires.some(wire => wire.type === 'w.request.target' &&
      owns(wire, request) && read(wire, 'family') === 'chart')) return false;
    const relations = intents(wires);
    return relations.length === 1 && owns(relations[0], request) &&
      read(relations[0], 'role') === 'purpose' &&
      read(relations[0], 'value') === 'social media' &&
      read(relations[0], 'words') === 'not for social media' &&
      read(relations[0], 'want') === 'no';
  });
  assert.ok(candidate, text);
  assert.deepEqual(candidate.catalog.issues, []);
  assert.deepEqual(candidate.evidence.missing, []);
});
