import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { catalogIssues } from '../src/catalog.mjs';
import { createAppositiveSelectorReader } from '../src/appositive-selector.mjs';
import { evidenceInText } from '../src/grounding.mjs';
import { createReader } from '../src/runtime.mjs';
import { parse, validate } from '../src/schema.mjs';
import { loadWorlds } from '../src/worlds.mjs';

const text='the tall boy, the one in the red hat, faces left';
const q=JSON.stringify;
const circuit=({family='drawn',sort='boy',predicate='faces',effect='drawn.facing',result='left',selector='drawn.wear',item,tall=false})=>[
  '@r w.request.request act=change mood=do predicate='+q(predicate),
  '@t w.request.target request=$r family='+family+' mode=existing determiner=definite fill=description sort='+q(sort),
  '@f w.request.constraint request=$r on=attribute attribute='+effect+' value='+q(result)+' operator=eq phase=result',
  ...(item ? ['@c w.request.constraint request=$r on=attribute attribute='+selector+' value='+q(item)+' operator=eq phase=result'] : []),
  ...(tall ? ['@s w.request.constraint request=$r on=size attribute=drawn.size value=tall operator=degree phase=selector'] : []),
].join('\n');

const examples=[
  ['boy','left'],['girl','right'],['bear','left'],['cat','right'],['duck','right'],['boy','right'],
].map(([sort,result])=>({text:'the '+sort+' faces '+result,sop:circuit({sort,result}),count:1}));

test('rephases only the typed appositive and keeps the written selection and finite outcome',async t=>{
  const worlds=loadWorlds();
  const base=circuit({item:'the red hat',tall:true});
  const model={version:1,examples:[{text,sop:base,count:1},...examples],templates:[]};
  const reader=createReader(model,worlds);
  t.after(()=>reader.close());
  const {candidates}=await reader.propose(text);
  const reading=candidates.find(candidate=>candidate.source==='appositive-selector');
  assert.ok(reading);
  assert.ok(validate(reading.sop,worlds));
  assert.ok(evidenceInText(text,reading.sop,worlds));
  assert.deepEqual(catalogIssues(parse(reading.sop),worlds,'drawing'),[]);
  const wires=parse(reading.sop);
  assert.equal(wires.find(wire=>wire.id==='t').attrs.description[0],'"the tall boy, the one in the red hat"');
  assert.equal(wires.find(wire=>wire.id==='c').attrs.phase[0],'selector');
  assert.equal(wires.find(wire=>wire.id==='c').attrs.value[0],'"the red hat"');
  assert.equal(wires.find(wire=>wire.id==='f').attrs.phase[0],'result');
  assert.equal(wires.find(wire=>wire.id==='s').attrs.phase[0],'selector');
});

test('does not absorb another target, scope, polarity, or untyped appositive',()=>{
  const worlds=loadWorlds();
  const read=createAppositiveSelectorReader({examples},worlds);
  const base=circuit({item:'the red hat',tall:true});
  for (const query of [
    'the tall boy, the boy in the red hat, faces left',
    'the tall boy, the one holding the red hat, faces left',
    'the tall boy, the one without the red hat, faces left',
    'the tall boy, the one in the red hat, does not face left',
    'the tall boy, the one in the red hat, faces left if ready',
    'the tall boy, the one in the red hat, faces left?',
    'the tall boy, "the one in the red hat", faces left',
    'the tall boy, the one in the red hat faces left',
  ]) assert.equal(read(query,{sop:base},()=>true),undefined,query);
  const unrelated='the tall boy, the one in the red tent, faces left';
  assert.equal(read(unrelated,{sop:circuit({item:'the red tent'})},()=>true),undefined);
  assert.equal(read(text,{sop:base.replace('value="left"','value="right" words="left"')},()=>true),undefined);
  assert.equal(read(text,{sop:base.replace('mode=existing','mode=new')},()=>true),undefined);
  const noTraining=createAppositiveSelectorReader({examples:[examples[0]]},worlds);
  assert.equal(noTraining(text,{sop:base},()=>true),undefined);
});

test('supports a separately declared owner family, appositive, and finite action',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'appositive-selector-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  writeFileSync(join(dir,'sensor.sop'),[
    '@lab std.schema.world name=w.lab',
    '@sensor std.schema.kind of=w.lab.sensor world=w.lab acts=change',
    '@mode w.request.key tab=lab family=sensor name=sensor.mode head=class value=quiet value=bright',
    '@filter w.request.key tab=lab family=sensor name=sensor.filter head=span',
    '@shade w.lab.accessory name="mesh cover" class=filter',
    '@app pro.reader.appositive_selector tab=lab family=sensor attribute=sensor.filter text=fitted item_type=w.lab.accessory item_field=class item_value=filter',
    '@pred pro.reader.topic_command tab=lab family=sensor act=change attribute=sensor.mode predicate=runs',
  ].join('\n'));
  const worlds=loadWorlds({paths:[dir]});
  const text='the sensor, the one fitted the mesh cover, runs quiet';
  const sop=circuit({family:'sensor',sort:'sensor',predicate:'runs',effect:'sensor.mode',result:'quiet',
    selector:'sensor.filter',item:'the mesh cover'});
  const reader=createReader({version:1,examples:[{text,sop,count:1}],templates:[]},worlds);
  t.after(()=>reader.close());
  const {candidates}=await reader.propose(text);
  const reading=candidates.find(candidate=>candidate.source==='appositive-selector');
  assert.ok(reading);
  assert.ok(validate(reading.sop,worlds));
  assert.ok(evidenceInText(text,reading.sop,worlds));
  assert.deepEqual(catalogIssues(parse(reading.sop),worlds,'lab'),[]);
});
