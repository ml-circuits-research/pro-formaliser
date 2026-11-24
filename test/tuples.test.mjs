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
  const drawing = await reader.formalise('put the object at 260,180',{tab:'drawing'});
  assert.deepEqual(pairs(drawing),[['drawn.x','260','result'],['drawn.y','180','result']]);
});

test('leaves numeric lists or quoted coordinates outside the tuple reading', async t => {
  const reader = createReader();
  t.after(() => reader.close());
  for (const text of [
    'put the object at 1, 2, 3',
    'put the object at (1,2), (3,4)',
    'put the object at 1, 2 and 3',
    'put the object at "1, 2"',
  ]) {
    const proposal = await reader.propose(text);
    assert.ok(proposal.candidates.every(candidate => pairs(candidate).length === 0),text);
  }
});

test('binds an arbitrary pair and cue only to the declared act and keys', async t => {
  const cache = fileURLToPath(new URL('../.cache/',import.meta.url));
  const dir = mkdtempSync(join(cache,'tuple-test-'));
  t.after(() => rmSync(dir,{recursive:true,force:true}));
  const file = join(dir,'overlay.sop');
  writeFileSync(file,`
@calibrand pro.reader.target family=calibrand tab=workbench act=place sort=specimen text=specimen
@rise w.request.key tab=workbench family=calibrand name=calibrand.rise head=number
@span w.request.key tab=workbench family=calibrand name=calibrand.arc head=number
@position pro.reader.tuple tab=workbench family=calibrand first_key=calibrand.rise second_key=calibrand.arc act=place text="at fixed offsets"
`);
  const reader = createReader(undefined,loadWorlds({paths:[file]}));
  t.after(() => reader.close());
  assert.deepEqual(pairs(await reader.formalise('put the specimen at fixed offsets -9,10')), [
    ['calibrand.rise','-9','result'],['calibrand.arc','10','result'],
  ]);
  assert.deepEqual(pairs(await reader.formalise('put the specimen at -9,10')), []);
});
