import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createReader } from '../src/reader.mjs';
import { createReader as createRuntimeReader } from '../src/runtime.mjs';
import { parse } from '../src/schema.mjs';
import { loadWorlds } from '../src/worlds.mjs';
import { numericAssignmentRoles } from '../src/owner-property.mjs';

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

test('shape inventory uses complete modifiers in the target family',async t=>{
  const path=fileURLToPath(new URL('../sop-worlds/shape-target-pilot',import.meta.url));
  const worlds=loadWorlds({paths:[path]});
  const reader=createRuntimeReader(undefined,worlds);
  t.after(()=>reader.close());
  const geometry=candidates=>candidates.filter(candidate=>parse(candidate.sop).some(wire=>
    wire.type==='w.request.target' && ['cube','cuboid'].some(sort=>values(wire,'sort').includes(sort))));
  for (const [text,source] of [
    ['Remove the red cube.','frame-target-inventory'],
    ['Take the red block out.','split-target-frame'],
    ['Change the colour of the red cube to blue.','native-property-frame'],
  ]) {
    const {candidates}=await reader.propose(text,{evidence:true});
    const reading=geometry(candidates).find(candidate=>candidate.source===source);
    assert.ok(reading,text);
    assert.deepEqual(reading.catalog.issues,[],text);
    assert.deepEqual(reading.evidence.missing,[],text);
    assert.equal(reading.evidence.counts.unread ?? 0,0,text);
  }
  for (const text of ['Remove the code block.', 'Take the text block out.', 'Remove the city block.',
    'Change the colour of the code block to red.', 'Change the colour of the text block to red.',
    'Block the view.', 'Is this a block?']) {
    const {candidates}=await reader.propose(text);
    assert.equal(geometry(candidates).length,0,text);
  }
  assert.ok(!numericAssignmentRoles('Set the width of the code block to 180.',worlds)?.known?.includes('drawn'));
  const {candidates}=await reader.propose('Set the width of all the rectangles to 180.',{evidence:true});
  for (const family of ['drawn','node']) {
    assert.ok(candidates.some(candidate=>{
      const wires=parse(candidate.sop);
      return wires.some(wire=>wire.type==='w.request.target' && values(wire,'family').includes(family) &&
        values(wire,'sort').includes('rectangle') && values(wire,'fill').includes('all')) &&
        wires.some(wire=>wire.type==='w.request.constraint' && values(wire,'attribute').includes(family+'.width') &&
          values(wire,'value').includes('180')) && !wires.some(wire=>wire.type==='w.request.unread');
    }),family);
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
