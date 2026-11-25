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

test('grounds a written prohibition only when the complete direction is independently resolved',async t=>{
  const reader=createReader();
  t.after(()=>reader.close());
  for (const [text,word,canonical,description] of [
    ["don't move it left",'left','left',undefined],
    ['Do not push the boat upwards','upwards','up','the boat'],
    ['Don’t shift the cloud backward','backward','backward','the cloud'],
    ['Please do not move the boat left','left','left','the boat'],
  ]) {
    const {candidates}=await reader.propose(text,{evidence:true});
    const reading=candidates.find(c=>c.source==='directional-prohibition');
    assert.ok(reading,text);
    const [direction]=facts(reading.sop,'constraint');
    assert.deepEqual([direction.attribute,direction.value,direction.want,direction.words],
      ['drawn.direction',canonical,'no',word]);
    assert.equal(facts(reading.sop,'target')[0].description,description);
    assert.deepEqual(reading.catalog.issues,[]);
    assert.deepEqual(reading.evidence.missing,[]);
    assert.ok(!reading.evidence.counts.uncovered && !reading.evidence.counts.unread);
  }
  for (const text of [
    'Do not just move it left','Do you not move it left?',"Don't move it left?",
    "Don't move it left if needed", "Don't move it left too far", 'Do not move it slightly left',
    'Do not move it three pixels left', 'Do not move it left or right',
    'Do not move it right of the dock', 'Draw "do not move it left"',
  ]) {
    assert.ok((await reader.propose(text)).candidates.every(c=>c.source!=='directional-prohibition'),text);
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
@scanner pro.reader.target family=device sort=optical_scanner text="optical scanner" act=change mode=existing
@deflection w.request.key family=device name=device.deflection head=class value=right
@finish w.request.key family=device name=device.finish head=class value=striped
@motion pro.reader.motion family=device act=change direction_key=device.deflection
@w.workbench.instrument core.type of=w.workbench.instrument
@scanner.kind w.workbench.instrument name="optical scanner"
@filter pro.reader.nominal_selector family=device key=device.finish position=after marker="with finish" value_type=k.values.fill head_type=w.workbench.instrument
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

test('keeps a qualified singular target and its scalar movement distinct',async t=>{
  const reader=createReader({version:1,examples:[],templates:[],lexicon:{
    block:[['target','change','drawn','existing','block',5]],
    blocks:[['target','change','drawn','existing','block',5]],
  }});
  t.after(()=>reader.close());
  const text='Could you shift the 11 block upwards a little?';
  const {candidates}=await reader.propose(text,{evidence:true});
  const completed=candidates.find(c=>c.source==='directional-result');
  assert.ok(completed);
  assert.deepEqual(facts(completed.sop,'target').map(x=>[x.sort,x.description,x.ids,x.count]),
    [['block','the 11 block',undefined,undefined]]);
  assert.deepEqual(facts(completed.sop,'constraint').map(x=>[x.attribute,x.value,x.words]),
    [['drawn.direction','up','upwards'],['drawn.distanceGrade','a little',undefined]]);
  assert.deepEqual(completed.evidence.missing,[]);
  assert.equal(completed.evidence.counts.uncovered ?? 0,0);
  for (const text of ['Shift the 11 blocks upwards', 'Shift 11 blocks up', 'Shift the boat 11 right']) {
    const {candidates}=await reader.propose(text);
    assert.ok(candidates.every(c=>c.source!=='directional-result'),text);
  }
});

test('keeps a combined direction and stopping condition under their written request owners',async t=>{
  const reader=createReader({version:1,examples:[],templates:[],lexicon:{
    block:[['target','change','drawn','existing','block',5]],
  }});
  t.after(()=>reader.close());
  const first='Could you shift the 11 block slightly up and right';
  const second='shift the 11 block down and slightly left until it lines up beside the 12 block';
  const {candidates}=await reader.propose(first+', then '+second,{evidence:true});
  const reading=candidates.find(c=>facts(c.sop,'target').filter(x=>x.description==='the 11 block').length===2 &&
    facts(c.sop,'unread').length===3 && !facts(c.sop,'constraint').some(x=>x.phase==='result'));
  assert.ok(reading);
  assert.equal(reading.status,'partial');
  assert.deepEqual(reading.catalog.issues,[]);
  assert.deepEqual(reading.evidence.missing,[]);
  assert.equal(reading.evidence.counts.uncovered ?? 0,0);
  assert.deepEqual(facts(reading.sop,'request').map(x=>[x.predicate,x.words]),[['shift',first],['shift',second]]);
  const owners=facts(reading.sop,'target').map(x=>x.request);
  assert.deepEqual(facts(reading.sop,'unread').map(x=>[owners.indexOf(x.request),x.text]),[
    [0,'slightly up and right'],
    [1,'down and slightly left'],
    [1,'until it lines up beside the 12 block'],
  ]);
  for (const text of [
    'Move the boat up and down',
    'Move the boat up or right',
    'Move the boat up and paint the dock',
    'Do not move the boat up and right',
    'Did you move the boat up and right?',
    'Move the boat left and right until tomorrow',
  ]) {
    const {candidates}=await reader.propose(text);
    assert.ok(candidates.every(c=>c.source!=='directional-incomplete'),text);
  }
});
