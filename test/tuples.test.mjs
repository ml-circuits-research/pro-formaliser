import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { createReader } from '../src/runtime.mjs';
import { parse } from '../src/schema.mjs';
import { loadWorlds } from '../src/worlds.mjs';

const decode = value => value?.startsWith('"') ? JSON.parse(value) : value;
const pairs = ({sop}) => parse(sop).filter(wire => wire.type === 'w.request.constraint').map(wire =>
  ['attribute','value','phase'].map(field=>decode(wire.attrs[field]?.[0])));

test('reads both signed coordinate components and keeps family alternatives', async t => {
  const reader = createReader();
  t.after(() => reader.close());
  const proposal = await reader.propose('put the object at (-12.5, +44)');
  const preferred = [
    [['drawn.x','-12.5','result'],['drawn.y','+44','result']],
    [['node.x','-12.5','result'],['node.y','+44','result']],
  ];
  for (const tuple of preferred) {
    assert.ok(proposal.candidates.some(candidate => JSON.stringify(pairs(candidate))===JSON.stringify(tuple)));
  }
  const placement = await reader.propose('put the object at 260,180');
  assert.ok(placement.candidates.some(candidate=>
    JSON.stringify(pairs(candidate))===JSON.stringify([['drawn.x','260','result'],['drawn.y','180','result']])));
});

test('leaves numeric lists or quoted coordinates outside the tuple reading', async t => {
  const reader = createReader();
  t.after(() => reader.close());
  for (const text of [
    'put the object at 1, 2, 3',
    'put the object at (1,2), (3,4)',
    'put the object at 1, 2 and 3',
    'put the object at "1, 2"',
    'put the object at x=1, y=2, z=3',
    'put the object at x=1, x=2',
    'put the object at x=1, y=2,+3',
    'put the object at x=1, y=2.5.6',
  ]) {
    const proposal = await reader.propose(text);
    assert.ok(proposal.candidates.every(candidate => pairs(candidate).length === 0),text);
  }
});

test('binds an explicitly assigned x and y in either written order with exact evidence', async t => {
  const reader = createReader();
  t.after(() => reader.close());
  const expected = [['node.x','-340.5','result'],['node.y','+110','result']];
  for (const input of ['Move the node to position y=+110, x=-340.5', 'Move the node at (x=-340.5, y=+110)']) {
    const {candidates} = await reader.propose(input,{evidence:true});
    const complete = candidates.find(candidate => JSON.stringify(pairs(candidate))===JSON.stringify(expected));
    assert.ok(complete,input);
    assert.deepEqual(complete.evidence.missing,[]);
    assert.equal(complete.evidence.counts.unread,undefined);
    assert.equal(complete.evidence.counts.uncovered,undefined);
  }
});

test('keeps punctuation inside an explicitly named coordinate target', async t => {
  const reader = createReader();
  t.after(() => reader.close());
  const expected = [['node.x','340','result'],['node.y','110','result']];
  for (const text of [
    'uh push the node named Valid? to position x=340, y=110',
    'Move the node called "Valid?" at x=340, y=110',
  ]) {
    const {candidates} = await reader.propose(text,{evidence:true});
    const named = candidates.find(candidate => parse(candidate.sop).some(wire =>
      wire.type==='w.request.target' && decode(wire.attrs.name?.[0])==='Valid?') &&
      JSON.stringify(pairs(candidate))===JSON.stringify(expected));
    assert.ok(named,text);
    assert.equal(named.status,'matched');
    assert.deepEqual(named.evidence.missing,[]);
    assert.equal(named.evidence.counts.unread,undefined);
    assert.equal(named.evidence.counts.uncovered,undefined);
  }
  for (const text of [
    'Do not move the node named Valid? to position x=340, y=110',
    'Move the node named Valid if needed to position x=340, y=110',
  ]) {
    const {candidates} = await reader.propose(text);
    assert.ok(candidates.every(candidate => candidate.source!=='named-tuple'),text);
  }
});

test('binds an arbitrary pair and cue only to the declared act and keys', async t => {
  const cache = fileURLToPath(new URL('../.cache/',import.meta.url));
  const dir = mkdtempSync(join(cache,'tuple-test-'));
  t.after(() => rmSync(dir,{recursive:true,force:true}));
  const file = join(dir,'overlay.sop');
  writeFileSync(file,`
@calibrand pro.reader.target family=calibrand act=place sort=specimen text=specimen
@rise w.request.key family=calibrand name=calibrand.rise head=number
@span w.request.key family=calibrand name=calibrand.arc head=number
@position pro.reader.tuple family=calibrand first_key=calibrand.rise second_key=calibrand.arc first_label=up second_label=across act=place text="at fixed offsets"
`);
  const reader = createReader(undefined,loadWorlds({paths:[file]}));
  t.after(() => reader.close());
  assert.deepEqual(pairs(await reader.formalise('put the specimen at fixed offsets -9,10')), [
    ['calibrand.rise','-9','result'],['calibrand.arc','10','result'],
  ]);
  assert.deepEqual(pairs(await reader.formalise('put the specimen at -9,10')), []);
  assert.deepEqual(pairs(await reader.formalise('put the specimen at fixed offsets across=10, up=-9')), [
    ['calibrand.rise','-9','result'],['calibrand.arc','10','result'],
  ]);
});
