import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createReader } from '../src/reader.mjs';
import { parse } from '../src/schema.mjs';

function field(wire, key) {
  const raw = wire.attrs[key]?.[0];
  return raw?.startsWith('"') ? JSON.parse(raw) : raw;
}

test('polite and indefinite colour nominals propose a new drawn object with written evidence', async t => {
  const reader = await createReader({ worldsOnly: true });
  t.after(() => reader.close());

  const examples = [
    { text: 'red house pls', sort: 'house', noun: 'house', colour: 'red', adjective: 'red' },
    { text: 'a blue boat', sort: 'boat', noun: 'boat', colour: 'blue', adjective: 'blue' },
    { text: 'Please, a Green Tree.', sort: 'tree', noun: 'Tree', colour: 'green', adjective: 'Green' },
  ];
  for (const { text, sort, noun, colour, adjective } of examples) {
    const result = await reader.propose(text);
    assert.equal(result.error, null, text);
    const reading = result.candidates.find(candidate => candidate.source === 'elliptical-nominal');
    assert.ok(reading, text);
    const wires = parse(reading.sop);
    const request = wires.find(wire => wire.type === 'w.request.request');
    const target = wires.find(wire => wire.type === 'w.request.target');
    const constraint = wires.find(wire => wire.type === 'w.request.constraint' && field(wire, 'attribute') === 'drawn.colour');
    assert.ok(request && target && constraint, text);
    assert.equal(field(request, 'act'), 'make', text);
    assert.equal(field(request, 'words'), text, text);
    assert.equal(field(request, 'predicate'), undefined, text);
    assert.equal(field(target, 'request'), '$' + request.id, text);
    assert.equal(field(target, 'family'), 'drawn', text);
    assert.equal(field(target, 'mode'), 'new', text);
    assert.equal(field(target, 'sort'), sort, text);
    assert.equal(field(target, 'sort_words'), noun, text);
    assert.equal(field(constraint, 'request'), '$' + request.id, text);
    assert.equal(field(constraint, 'value'), colour, text);
    assert.equal(field(constraint, 'words'), adjective, text);
    assert.equal(field(constraint, 'phase'), 'result', text);
    assert.ok(!wires.some(wire => wire.type === 'w.request.unread'), text);
  }
});

test('elliptical creation requires a grounded nominal and a creation cue', async t => {
  const reader = await createReader({ worldsOnly: true });
  t.after(() => reader.close());

  for (const text of [
    'the red house please',
    'red house',
    'A blue boat?',
    'Is that a blue boat?',
    'red quibblo pls',
    'red pls',
    'a blue',
    '"a blue boat"',
    '"red house" please',
  ]) {
    const result = await reader.propose(text);
    assert.equal(result.error, null, text);
    assert.ok(!result.candidates.some(candidate => candidate.source === 'elliptical-nominal'), text);
  }
});
