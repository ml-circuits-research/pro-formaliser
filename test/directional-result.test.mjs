import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createReader } from '../src/runtime.mjs';
import { loadWorlds } from '../src/worlds.mjs';
import { parse } from '../src/schema.mjs';

function facts(sop,type) {
  return parse(sop).filter(wire=>wire.type==='w.request.'+type).map(wire=>Object.fromEntries(
    Object.entries(wire.attrs).map(([key,[value]])=>[key,value.startsWith('"') ? JSON.parse(value) : value])));
}

test('grounds direction with a written object or unresolved reference and preserves qualitative distance',async t=>{
  const reader=createReader();
  t.after(()=>reader.close());
  for (const [text,fill,sort,value,direction,degree] of [
    ['move it slightly right','context',undefined,'right','right','slightly'],
    ['nudge the cloud a touch downward','description','cloud','down','downward','a touch'],
    ['Could you push the boat upwards a little?','description','boat','up','upwards','a little'],
    ['Shift the house left','description','house','left','left',undefined],
    ['Shift the house LEFT','description','house','left','LEFT',undefined],
  ]) {
    const {candidates}=await reader.propose(text);
    const candidate=candidates.find(c=>c.source==='directional-result');
    assert.ok(candidate,text);
    const [target]=facts(candidate.sop,'target');
    assert.deepEqual([target.fill,target.sort],[fill,sort]);
    assert.deepEqual(facts(candidate.sop,'constraint').map(c=>[c.attribute,c.value,c.words,c.phase]),
      [['drawn.direction',value,direction===value ? undefined : direction,'result'],
        ...(degree ? [['drawn.distanceGrade',degree,undefined,'result']] : [])]);
    assert.deepEqual(facts(candidate.sop,'unread'),[]);
  }
});

test('leaves anchor relations, numeric measurements and different scopes to other readers',async t=>{
  const reader=createReader();
  t.after(()=>reader.close());
  for (const text of [
    'Move the boat to the right of the dock',
    'Move the boat three pixels left',
    'Move the boat left and up',
    'Did you move the boat left?',
    'If ready, move the boat left',
    'Do not move the boat left',
    'Print "move the boat left"',
    'Move the vacant quilloscope left',
  ]) {
    const {candidates}=await reader.propose(text);
    assert.ok(!candidates.some(c=>c.source==='directional-result'),text);
  }
});

test('offers an independent directional result for an installed family and catalog key',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'sop-directional-result-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const path=join(dir,'overlay.sop');
  writeFileSync(path,`
@bench std.schema.world name=w.workbench
@device std.schema.kind of=w.workbench.device world=w.workbench acts=change
@scanner pro.reader.target family=device sort=optical_scanner text="optical scanner" act=change tab=workbench mode=existing
@deflection w.request.key tab=workbench family=device name=device.deflection head=class value=right
@motion pro.reader.motion tab=workbench family=device act=change direction_key=device.deflection
`);
  const reader=createReader(undefined,loadWorlds({paths:[path]}));
  t.after(()=>reader.close());
  const {candidates}=await reader.propose('Shift the optical scanner a bit rightward');
  const installed=candidates.find(c=>c.source==='directional-result' &&
    facts(c.sop,'target')[0].family==='device');
  assert.ok(installed);
  assert.deepEqual(facts(installed.sop,'constraint').map(c=>[c.attribute,c.value,c.words]),
    [['device.deflection','right','rightward']]);
  assert.deepEqual(facts(installed.sop,'unread').map(c=>c.text),['a bit']);
});
