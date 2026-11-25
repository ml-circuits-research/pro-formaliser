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
    'Move the woman in the green room back',
    'Do not move the woman in green back',
  ]) {
    const {candidates}=await reader.propose(text);
    assert.ok(!candidates.some(c=>c.source==='directional-result'),text);
  }
});

test('keeps each written qualifier on its target and direction on the result',async t=>{
  const reader=createReader();
  t.after(()=>reader.close());
  const text='Push the man in blue backwards, then nudge the green boat left';
  const {candidates}=await reader.propose(text,{evidence:true});
  const reading=candidates.find(c=>facts(c.sop,'constraint').filter(x=>x.attribute==='drawn.direction').length===2 &&
    facts(c.sop,'constraint').filter(x=>x.attribute==='drawn.colour' && x.phase==='selector').length===2);
  assert.ok(reading);
  assert.deepEqual(reading.evidence.missing,[]);
  assert.equal(reading.evidence.counts.unread,undefined);
  assert.deepEqual(facts(reading.sop,'target').map(x=>[x.sort,x.description]),
    [['man','the man in blue'],['boat','the green boat']]);
  const owners=facts(reading.sop,'target').map(x=>x.request);
  assert.deepEqual(facts(reading.sop,'constraint').map(x=>[owners.indexOf(x.request),x.attribute,x.value,x.phase,x.key_words]),[
    [0,'drawn.colour','blue','selector','in'],[0,'drawn.direction','backward','result',undefined],
    [1,'drawn.colour','green','selector',undefined],[1,'drawn.direction','left','result',undefined],
  ]);
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
@finish w.request.key tab=workbench family=device name=device.finish head=class value=striped
@motion pro.reader.motion tab=workbench family=device act=change direction_key=device.deflection
@w.workbench.instrument core.type of=w.workbench.instrument
@scanner.kind w.workbench.instrument name="optical scanner"
@filter pro.reader.nominal_selector tab=workbench family=device key=device.finish position=after marker="with finish" value_type=k.values.fill head_type=w.workbench.instrument
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
  const {candidates:qualified}=await reader.propose('Shift the optical scanner with finish striped rightward');
  const filtered=qualified.find(c=>c.source==='directional-result' && facts(c.sop,'target')[0].family==='device');
  assert.ok(filtered);
  assert.deepEqual(facts(filtered.sop,'constraint').map(c=>[c.attribute,c.value,c.phase,c.key_words]),[
    ['device.finish','striped','selector','with finish'],['device.deflection','right','result',undefined],
  ]);
});
