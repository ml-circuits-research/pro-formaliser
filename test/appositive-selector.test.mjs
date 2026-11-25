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
  assert.deepEqual(catalogIssues(parse(reading.sop),worlds),[]);
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
    '@mode w.request.key family=sensor name=sensor.mode head=class value=quiet value=bright',
    '@filter w.request.key family=sensor name=sensor.filter head=span',
    '@shade w.lab.accessory name="mesh cover" class=filter',
    '@app pro.reader.appositive_selector family=sensor attribute=sensor.filter text=fitted item_type=w.lab.accessory item_field=class item_value=filter',
    '@pred pro.reader.topic_command family=sensor act=change attribute=sensor.mode predicate=runs',
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
  assert.deepEqual(catalogIssues(parse(reading.sop),worlds),[]);
});

const placementLexicon={
  man:[['target','place','drawn','existing','man',10]],
  girl:[['target','place','drawn','existing','girl',10]],
  boy:[['target','place','drawn','existing','boy',10]],
  cat:[['target','make','drawn','new','cat',10]],
};

test('keeps adjacent attire on the selected person and an independently written location on the action',async t=>{
  const model={version:1,examples:[],templates:[],lexicon:placementLexicon};
  const worlds=loadWorlds();
  const reader=createReader(model,worlds);
  t.after(()=>reader.close());
  for (const [text,attribute,result] of [
    ['put the man in the blue shirt near the house','drawn.relation','near'],
    ['move the girl in a red hat on the left','drawn.at','left'],
  ]) {
    const {candidates}=await reader.propose(text,{evidence:true});
    const reading=candidates.find(candidate=>candidate.source==='adjacent-selector' && candidate.status==='matched');
    assert.ok(reading,text);
    assert.ok(validate(reading.sop,worlds));
    assert.deepEqual(reading.catalog.issues,[]);
    assert.equal(reading.evidence.counts.uncovered ?? 0,0);
    assert.equal(reading.evidence.missing.length,0);
    const wires=parse(reading.sop);
    assert.deepEqual(wires.filter(wire=>wire.attrs.attribute?.[0]==='drawn.wear').map(wire=>wire.attrs.phase[0]),['selector']);
    assert.equal(wires.find(wire=>wire.attrs.attribute?.[0]===attribute).attrs.value[0],result);
    assert.ok(!wires.some(wire=>wire.attrs.value?.[0]==='in'));
  }
});

test('keeps coordinated attire and the full unresolved destination in a sequence',async t=>{
  const worlds=loadWorlds();
  const reader=createReader({version:1,examples:[],templates:[],lexicon:placementLexicon},worlds);
  t.after(()=>reader.close());
  const move='bring the man in the yellow shirt and orange hat all the way to the right end of the line';
  const text='Draw a cat, then '+move+', and the rest stay exactly where they are';
  const {candidates}=await reader.propose(text,{evidence:true});
  const reading=candidates.find(candidate=>candidate.sop.includes('attribute=drawn.wear') &&
    candidate.sop.includes('value=place') && candidate.sop.includes('sort=cat'));
  assert.ok(reading);
  assert.ok(validate(reading.sop,worlds));
  assert.equal(reading.evidence.missing.length,0);
  assert.deepEqual(reading.catalog.issues,[]);
  const wires=parse(reading.sop);
  const owner='$'+wires.find(wire=>wire.attrs.predicate?.[0]==='bring').id;
  const local=wires.filter(wire=>wire.attrs.request?.[0]===owner);
  assert.deepEqual(local.filter(wire=>wire.type==='w.request.constraint').map(wire=>wire.attrs.value[0]),
    ['"the yellow shirt"','"orange hat"']);
  assert.equal(local.find(wire=>wire.type==='w.request.unread').attrs.text[0],'"all the way to the right end of the line"');
  for (const query of [
    'move the cup in the red hat near the house',
    'move the man in the red tent near the house',
    'move the man in the red hat near the house if ready',
    'move the man in the red hat and remove the house',
  ]) {
    const {candidates}=await reader.propose(query);
    assert.ok(!candidates.some(candidate=>candidate.source==='adjacent-selector'),query);
  }
});

test('an installed item provider can extend the adjacent selector vocabulary',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'adjacent-selector-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  writeFileSync(join(dir,'accessory.sop'),[
    '@visor w.lab.accessory name=visorplate',
    '@adjacent pro.reader.appositive_selector family=drawn attribute=drawn.wear text=fitted subject_type=k.people.kind item_type=w.lab.accessory',
  ].join('\n'));
  const worlds=loadWorlds({paths:[dir]});
  const reader=createReader({version:1,examples:[],templates:[],lexicon:placementLexicon},worlds);
  t.after(()=>reader.close());
  const {candidates}=await reader.propose('move the girl fitted a visorplate near the house',{evidence:true});
  const reading=candidates.find(candidate=>candidate.source==='adjacent-selector' && candidate.status==='matched');
  assert.ok(reading);
  assert.deepEqual(reading.catalog.issues,[]);
  assert.deepEqual(reading.evidence.missing,[]);
  assert.ok(reading.sop.includes('attribute=drawn.wear value="a visorplate" operator=eq phase=selector'));
});

test('keeps independently scoped subjects and a same-kind landmark with coordinated qualifiers',async t=>{
  const worlds=loadWorlds();
  const reader=createReader({version:1,examples:[],templates:[],lexicon:placementLexicon},worlds);
  t.after(()=>reader.close());
  const first='Could you place the boy in a white shirt and a blue cap near the middle of the line';
  const second='move the boy in a grey shirt next to the boy in a white shirt and a blue cap';
  const text=first+', then '+second+'?';
  const {candidates}=await reader.propose(text,{evidence:true});
  const candidate=candidates.find(candidate=>candidate.sop.includes('description="the boy in a grey shirt"') &&
    candidate.sop.includes('description="the boy in a white shirt and a blue cap"') &&
    candidate.sop.includes('attribute=drawn.anchor value="the boy in a white shirt and a blue cap"'));
  assert.ok(candidate);
  assert.equal(candidate.status,'partial');
  assert.deepEqual(candidate.catalog.issues,[]);
  assert.equal(candidate.evidence.counts.uncovered ?? 0,0);
  assert.deepEqual(candidate.evidence.missing,[]);
  const wires=parse(candidate.sop);
  const [place,move]=wires.filter(wire=>wire.type==='w.request.request');
  const owned=request=>wires.filter(wire=>wire.attrs.request?.[0]==='$'+request.id);
  assert.equal(place.attrs.words[0],q(first));
  assert.equal(owned(place).find(wire=>wire.type==='w.request.unread').attrs.text[0],q('near the middle of the line'));
  assert.deepEqual(owned(move).filter(wire=>wire.attrs.attribute?.[0]==='drawn.wear').map(wire=>wire.attrs.value[0]),
    [q('a grey shirt')]);
  assert.equal(owned(move).find(wire=>wire.attrs.attribute?.[0]==='drawn.relation').attrs.words[0],q('next to'));

  const destination='off the far right to next to the boy in a white shirt and a blue cap, on the right side';
  const qualified=await reader.propose(first+', then place the boy in a grey shirt and a blue cap '+destination);
  const repaired=qualified.candidates.find(candidate=>candidate.sop.includes('description="the boy in a grey shirt and a blue cap"') &&
    candidate.sop.includes('description="the boy in a white shirt and a blue cap"'));
  assert.ok(repaired);
  const clauses=parse(repaired.sop);
  const [left,right]=clauses.filter(wire=>wire.type==='w.request.request');
  assert.notEqual(left.id,right.id);
  const moved=clauses.filter(wire=>wire.attrs.request?.[0]==='$'+right.id);
  assert.equal(moved.find(wire=>wire.type==='w.request.unread').attrs.text[0],q(destination));
  assert.ok(!moved.some(wire=>wire.attrs.on?.[0]==='place'));
  for (const query of [
    'Could I place the boy in a white shirt near the house?',
    'Could you place the boy in a white shirt near the house if selected?',
    'Did you place the boy in a white shirt near the house?',
    'Could you place the boy in a white shirt near the house and remove the boy in a red hat?',
  ]) {
    const {candidates}=await reader.propose(query);
    assert.ok(!candidates.some(candidate=>candidate.source==='adjacent-selector' &&
      candidate.sop.includes('description="the boy in a white shirt"')),query);
  }
});
