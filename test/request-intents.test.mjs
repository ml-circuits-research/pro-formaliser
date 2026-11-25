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

for (const {text, destination, expectedIntents} of [
  {
    text: 'Calculate total revenue for the board appendix, to go on the summary slide of the deck.',
    destination: 'to go on the summary slide of the deck',
    expectedIntents: [['purpose', 'the board appendix', 'for the board appendix', 'yes']],
  },
  {
    text: 'Calculate total revenue to go on the summary slide.',
    destination: 'to go on the summary slide',
    expectedIntents: [],
  },
]) {
  test(`keeps the result destination unread in "${text}"`, async t => {
    const reader = createReader();
    t.after(() => reader.close());
    const { candidates } = await reader.propose(text, { evidence: true });
    const readings = candidates.map(candidate => ({candidate, wires: parse(candidate.sop)}));
    const swallowed = readings.flatMap(({wires}) => intents(wires))
      .filter(wire => read(wire, 'value')?.includes(destination));
    assert.deepEqual(swallowed, []);
    const reading = readings.find(({wires}) => {
      const request = wires.find(wire => wire.type === 'w.request.request' &&
        read(wire, 'act') === 'ask' && read(wire, 'predicate') === 'Calculate' &&
        read(wire, 'question') === 'total' && read(wire, 'asked_words') === 'total revenue');
      if (!request) return false;
      const unread = wires.filter(wire => wire.type === 'w.request.unread' && owns(wire, request));
      const relations = intents(wires);
      return unread.length === 1 && read(unread[0], 'text') === destination &&
        relations.length === expectedIntents.length && relations.every((wire, index) =>
          owns(wire, request) && intentFields(wire).every((field, slot) => field === expectedIntents[index][slot]));
    });
    assert.ok(reading, text);
    assert.equal(reading.candidate.status, 'partial');
    assert.deepEqual(reading.candidate.catalog.issues, []);
    assert.deepEqual(reading.candidate.evidence.missing, []);
  });
}

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

test('keeps a counted noun phrase as purpose and a standalone quantity unread', async t => {
  const reader = createReader();
  t.after(() => reader.close());
  for (const value of ['the client briefing', 'two client briefings', '24 project reviews']) {
    const { candidates } = await reader.propose(`Calculate total revenue for ${value}.`, { evidence: true });
    const candidate = candidates.find(candidate => {
      const wires = parse(candidate.sop);
      const request = wires.find(wire => read(wire, 'asked_words') === 'total revenue');
      return request && intents(wires).some(wire => owns(wire, request) &&
        read(wire, 'value') === value && read(wire, 'words') === `for ${value}`);
    });
    assert.ok(candidate, value);
    assert.equal(candidate.status, 'matched');
    assert.deepEqual(candidate.catalog.issues, []);
    assert.deepEqual(candidate.evidence.missing, []);
  }
  for (const [text, adjunct] of [
    ['Create a meeting for 1.', 'for 1'],
    ['Add a meeting for two hours.', 'for two hours'],
    ['Calculate total revenue for 2.5.', 'for 2.5'],
  ]) {
    const { candidates } = await reader.propose(text, { evidence: true });
    const candidate = candidates.find(candidate => {
      const wires = parse(candidate.sop);
      const request = wires.find(wire => wire.type === 'w.request.request');
      return request && wires.some(wire => wire.type === 'w.request.unread' && owns(wire, request) &&
        read(wire, 'text') === adjunct && read(wire, 'note') === 'unresolved quantity');
    });
    assert.ok(candidate, text);
    assert.equal(candidate.status, 'partial');
    assert.deepEqual(candidate.evidence.missing, []);
    assert.ok(candidates.every(candidate => !intents(parse(candidate.sop)).some(wire =>
      read(wire, 'words') === adjunct)), text);
  }
});

test('distinguishes declared coordinate assignments from a purpose clause', async t => {
  const reader = createReader();
  t.after(() => reader.close());
  const placement = 'uh push the node named Valid? to position x=340, y=110';
  const { candidates } = await reader.propose(placement);
  assert.ok(candidates.some(candidate => parse(candidate.sop).some(wire =>
    wire.type === 'w.request.target' && read(wire, 'family') === 'node')));
  assert.ok(candidates.every(candidate => !intents(parse(candidate.sop)).length));

  const purpose = await reader.propose('Move the node to position the chart on the page.');
  assert.ok(purpose.candidates.some(candidate => intents(parse(candidate.sop)).some(wire =>
    read(wire, 'value') === 'position the chart on the page')));

  const both = await reader.propose('Move the node to position x=-340, y=+110 for the talk.');
  const values = both.candidates.flatMap(candidate => intents(parse(candidate.sop)))
    .map(wire => read(wire, 'value'));
  assert.deepEqual(new Set(values), new Set(['the talk']));
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

test('uses an installed result-destination boundary without a comma', async t => {
  const overlay = await mkdtemp(join(tmpdir(), 'request-intents-'));
  await writeFile(join(overlay, 'intents.sop'),
    '@intent.test pro.reader.request_intent_frame text="slated for" role=destination form=nominal owner=answer want=yes resolution=unresolved\n');
  const reader = createReader(undefined, loadWorlds({ paths: [overlay] }));
  t.after(async () => { await reader.close(); await rm(overlay, {recursive: true}); });
  const text = 'Compute total refunds for the audit slated for the front page.';
  const { candidates } = await reader.propose(text, { evidence: true });
  assert.ok(candidates.some(candidate => {
    const wires = parse(candidate.sop);
    const request = wires.find(wire => wire.type === 'w.request.request' &&
      read(wire, 'predicate') === 'Compute' && read(wire, 'asked_words') === 'total refunds');
    return candidate.status === 'partial' && request &&
      intents(wires).some(wire => owns(wire, request) && read(wire, 'value') === 'the audit') &&
      wires.some(wire => wire.type === 'w.request.unread' && owns(wire, request) &&
        read(wire, 'text') === 'slated for the front page') &&
      !candidate.evidence.missing.length;
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
