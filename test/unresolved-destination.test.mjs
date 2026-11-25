import assert from 'node:assert/strict';
import test from 'node:test';
import { createReader } from '../src/reader.mjs';
import { parse } from '../src/schema.mjs';

function read(wire, key) {
  const value = wire.attrs[key]?.[0];
  return value?.startsWith('"') ? JSON.parse(value) : value;
}

test('records the written copy destination and leaves the source operand unresolved', async t => {
  const reader = await createReader({ worldsOnly: true, evidence: true });
  t.after(() => reader.close());

  for (const [predicate, source, marker, destination] of [
    ['copy', 'the same grid lines treatment', 'over to', 'the sales chart'],
    ['Duplicate', 'the same heading treatment', 'on', 'the revenue chart'],
    ['Copy', 'the same heading change', 'across to', 'the draft document'],
    ['copy', 'the same settings', 'to', 'the diagram'],
    ['Copy', 'the same settings', 'to', 'the "Sales and Orders" chart'],
  ]) {
    const words = `${marker} ${destination}`;
    const text = `${predicate} ${source} ${words}`;
    const result = await reader.propose(text);
    assert.equal(result.error, null, text);
    const readings = result.candidates.filter(candidate => candidate.source === 'unresolved-destination');
    assert.ok(readings.length, text);

    for (const candidate of readings) {
      assert.equal(candidate.status, 'partial', text);
      assert.deepEqual(candidate.catalog.issues, [], text);
      assert.deepEqual(candidate.evidence.missing, [], text);

      const wires = parse(candidate.sop);
      assert.deepEqual(wires.map(wire => wire.type).sort(),
        ['w.request.intent', 'w.request.request', 'w.request.unread'], text);
      const request = wires.find(wire => wire.type === 'w.request.request');
      const intent = wires.find(wire => wire.type === 'w.request.intent');
      const unread = wires.find(wire => wire.type === 'w.request.unread');
      assert.equal(read(request, 'act'), 'copy', text);
      assert.equal(read(request, 'predicate'), predicate, text);
      assert.equal(read(intent, 'request'), '$' + request.id, text);
      assert.equal(read(intent, 'role'), 'destination', text);
      assert.equal(read(intent, 'value'), destination, text);
      assert.equal(read(intent, 'words'), words, text);
      assert.equal(read(unread, 'request'), '$' + request.id, text);
      assert.equal(read(unread, 'text'), source, text);
    }
  }
});

test('does not apply the unresolved copy destination reading to competing constructions', async t => {
  const reader = await createReader({ worldsOnly: true, evidence: true });
  t.after(() => reader.close());

  for (const text of [
    'Copy "the same settings" to the diagram',
    'Did you copy the same settings to the diagram?',
    'Do not copy the same settings to the diagram',
    'Copy the same settings to the diagram if it is ready',
    'Copy the same settings to the diagram and the chart',
    'Copy the same settings to the diagram on the slide',
    'Copy the same settings to the "Sales or Orders chart',
    'Copy the chart to the document',
  ]) {
    const result = await reader.propose(text);
    assert.equal(result.error, null, text);
    assert.ok(result.candidates.every(candidate => candidate.source !== 'unresolved-destination'), text);
  }
});
