import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createReader } from '../src/reader.mjs';
import { parse } from '../src/schema.mjs';

function field(wire, key) {
  const raw = wire.attrs[key]?.[0];
  return raw?.startsWith('"') ? JSON.parse(raw) : raw;
}

async function propose(reader, text) {
  const result = await reader.propose(text);
  assert.equal(result.error, null, text);
  assert.equal(result.engine, 'prolog', text);
  assert.equal(result.text, text);
  return result.candidates.filter(candidate => candidate.source === 'elliptical-property');
}

function onlyWire(wires, type, text) {
  const selected = wires.filter(wire => wire.type === `w.request.${type}`);
  assert.equal(selected.length, 1, `${text}: ${type}`);
  return selected[0];
}

test('elliptical properties retain distinct declared readings with exact written evidence', async t => {
  const reader = await createReader({ worldsOnly: true, evidence: true });
  t.after(() => reader.close());

  for (const { text, attributes, value, words, keyWords } of [
    { text: 'night time pls', attributes: ['page.time'], value: 'night', words: 'night', keyWords: 'time' },
    { text: 'sunset pls', attributes: ['page.filter', 'page.time'], value: 'sunset', words: 'sunset' },
    { text: 'sunset filter please', attributes: ['page.filter'], value: 'sunset', words: 'sunset', keyWords: 'filter' },
  ]) {
    const readings = await propose(reader, text);
    const actual = [];
    for (const reading of readings) {
      const wires = parse(reading.sop);
      const request = onlyWire(wires, 'request', text);
      const target = onlyWire(wires, 'target', text);
      const constraint = onlyWire(wires, 'constraint', text);

      assert.equal(field(request, 'act'), 'change', text);
      assert.equal(field(request, 'words'), text);
      assert.equal(field(request, 'predicate'), undefined, text);
      assert.equal(field(target, 'request'), `$${request.id}`, text);
      assert.equal(field(target, 'family'), 'page', text);
      assert.equal(field(target, 'mode'), 'existing', text);
      assert.equal(field(target, 'fill'), 'context', text);
      for (const key of ['ids', 'description', 'sort', 'name', 'family_words']) {
        assert.equal(field(target, key), undefined, text);
      }
      assert.equal(field(constraint, 'request'), `$${request.id}`, text);
      assert.equal(field(constraint, 'on'), 'attribute', text);
      assert.equal(field(constraint, 'phase'), 'result', text);
      assert.equal(field(constraint, 'value'), value, text);
      assert.equal(field(constraint, 'words'), words, text);
      assert.equal(field(constraint, 'key_words'), keyWords, text);
      assert.ok(wires.every(wire => !['w.request.history', 'w.request.previous', 'w.request.unread'].includes(wire.type) &&
        field(wire, 'from') !== 'previous'), text);
      assert.deepEqual(reading.catalog.issues, [], text);
      assert.deepEqual(reading.evidence.missing, [], text);
      const spans = reading.evidence.spans.filter(span => span.wire === constraint.id);
      const expectedSpans = [['words', words], ...(keyWords ? [['key_words', keyWords]] : [])];
      for (const [slot, phrase] of expectedSpans) {
        const start = text.indexOf(phrase);
        assert.deepEqual(spans.find(span => span.slot === slot)?.ranges, [[start, start + phrase.length]], text);
      }
      actual.push(field(constraint, 'attribute'));
    }
    assert.deepEqual(actual.sort(), attributes, text);
  }
});

test('elliptical properties reject unlicensed or non-request fragments', async t => {
  const reader = await createReader({ worldsOnly: true });
  t.after(() => reader.close());

  for (const text of [
    'quibblo pls',
    'sunset quibblo pls',
    'sepia time please',
    'sunset?',
    'sunset filter please?',
    '"sunset filter" please',
    'not sunset filter please',
    'sunset',
  ]) {
    assert.deepEqual(await propose(reader, text), [], text);
  }
});
