import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { createReader } from '../src/runtime.mjs';
import { parse } from '../src/schema.mjs';
import { loadWorlds } from '../src/worlds.mjs';

const pilot=fileURLToPath(new URL('../sop-worlds/pose-pilot/poses.sop',import.meta.url));
const decode=value=>value?.startsWith('"') ? JSON.parse(value) : value;
const field=(wire,key)=>decode(wire.attrs[key]?.[0]);

test('the pose pilot appends values to the pinned catalog without replacing its other attributes', ()=>{
  const original=parse(readFileSync(new URL('../.cache/knowledge/docs/worlds/w.request/shards/keys.sop',import.meta.url),'utf8'))
    .find(w=>w.id==='w.request.key.drawing.drawn.pose');
  const replacement=parse(readFileSync(pilot,'utf8')).find(w=>w.id===original.id);
  const {tab: _retiredMetadata,...semanticAttributes}=original.attrs;
  assert.deepEqual({...replacement.attrs,value:replacement.attrs.value.slice(0,original.attrs.value.length)},semanticAttributes);
  const worlds=loadWorlds({paths:[pilot]});
  assert.ok(worlds.nominalPositions.get('drawn').get('kneeling')
    .some(entry=>entry[1]==='drawn.pose' && entry[2]==='kneeling'));
});

test('an independently declared node value attaches to its local nominal with verbatim evidence',async t=>{
  const dir=mkdtempSync(join(fileURLToPath(new URL('../.cache/',import.meta.url)),'nominal-value-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const file=join(dir,'surface.sop');
  writeFileSync(file,`
@fixture.node.phase w.request.key family=node name=node.fixturePhase head=class value=ready
@fixture.node.surface pro.reader.nominal_value family=node key=node.fixturePhase value=ready text="standing by"
@fixture.node.absent pro.reader.nominal_value family=node key=node.fixturePhase value=missing text=idle
@fixture.node.wrong_owner pro.reader.nominal_value family=chart key=node.fixturePhase value=ready text=attentive
`);
  const worlds=loadWorlds({paths:[file]});
  const model={version:1,examples:[],templates:[],lexicon:{}};
  const reader=createReader(model,worlds);
  t.after(()=>reader.close());
  async function interpretations(text) {
    return (await reader.propose(text)).candidates.flatMap(candidate=>parse(candidate.sop))
      .filter(w=>w.type==='w.request.constraint' && field(w,'attribute')==='node.fixturePhase');
  }
  const values=await interpretations('Add a node Standing By.');
  assert.ok(values.some(w=>field(w,'value')==='ready' && field(w,'words')==='Standing By' && field(w,'phase')==='result'));
  for (const input of [
    'Add a node "standing by".',
    'Do not add a node standing by.',
    'Add a node standing by the door.',
    'Add a node idle.',
    'Add a node attentive.',
    'Change the node standing by.',
    'Draw a girl standing by.',
  ]) assert.deepEqual(await interpretations(input),[],input);
});

test('a postnominal frame reads current members of an independently installed finite bank',async t=>{
  const dir=mkdtempSync(join(fileURLToPath(new URL('../.cache/',import.meta.url)),'finite-nominal-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const file=join(dir,'pattern.sop');
  writeFileSync(file,[
    '@fixture.state w.request.key family=node name=node.fixtureState head=class value=active value=idle',
    '@fixture.frame pro.reader.nominal_pattern family=node key=node.fixtureState pattern="with an {value} indicator"',
  ].join('\n'));
  const reader=createReader(undefined,loadWorlds({paths:[file]}));
  t.after(()=>reader.close());
  for (const value of ['active','idle','unlisted']) {
    const result=await reader.propose('Add a node with an '+value+' indicator');
    const hit=result.candidates.flatMap(c=>parse(c.sop)).some(w=>
      field(w,'attribute')==='node.fixtureState' && field(w,'value')===value &&
      field(w,'words')==='with an '+value+' indicator');
    assert.equal(hit,value!=='unlisted',value);
  }
});

test('a declared heading supplies a property of the following single creation',async t=>{
  const dir=mkdtempSync(join(fileURLToPath(new URL('../.cache/',import.meta.url)),'nominal-heading-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const file=join(dir,'heading.sop');
  writeFileSync(file,[
    '@fixture.heading.state w.request.key family=node name=node.fixtureState head=class value=active value=idle',
    '@fixture.heading.frame pro.reader.nominal_pattern family=node key=node.fixtureState pattern="status {value}" heading=true',
  ].join('\n'));
  const inventory=fileURLToPath(new URL('../sop-worlds/drawable-inventory-pilot/',import.meta.url));
  const reader=createReader(undefined,loadWorlds({paths:[file,inventory]}));
  t.after(()=>reader.close());
  const headings=async text=>(await reader.propose(text)).candidates
    .filter(candidate=>candidate.source==='nominal-heading').map(candidate=>parse(candidate.sop));

  const boat=await headings('Facing right: a small boat on the left');
  assert.ok(boat.some(wires=>{
    const target=wires.find(w=>w.type==='w.request.target');
    const owns=(key,value)=>wires.some(w=>field(w,'request')===field(target,'request') &&
      field(w,'attribute')===key && field(w,'value')===value);
    return field(target,'sort')==='boat' && owns('drawn.facing','right') &&
      owns('drawn.size','small') && owns('drawn.at','left');
  }));
  const planes=await headings('Facing left: a plane in the sky');
  assert.ok(planes.some(wires=>wires.some(w=>field(w,'attribute')==='drawn.anchor' &&
    field(w,'value')==='the sky') && wires.some(w=>field(w,'attribute')==='drawn.facing' &&
    field(w,'words')==='Facing left')));
  const nodes=await headings('Status idle: a node');
  assert.ok(nodes.some(wires=>wires.some(w=>field(w,'attribute')==='node.fixtureState' &&
    field(w,'value')==='idle' && field(w,'words')==='Status idle')));
  for (const text of [
    'Status idle, a node',
    'Status unlisted: a node',
    'Status idle: a boat',
    '"Facing left": a plane in the sky',
    'Facing left: a plane in the sky?',
    'Facing left: move it into the sky',
    'Facing left: a plane in the sky; add a balloon',
    'Facing left: a plane and a balloon',
  ]) assert.deepEqual(await headings(text),[],text);
});

test('uses the installed person inventory for postnominal poses',async t=>{
  const inventory=fileURLToPath(new URL('../sop-worlds/drawable-inventory-pilot/',import.meta.url));
  const standard=createReader(undefined,loadWorlds({paths:[inventory]}));
  const extended=createReader(undefined,loadWorlds({paths:[inventory,pilot]}));
  t.after(()=>Promise.all([standard.close(),extended.close()]));
  const values=({candidates})=>candidates.flatMap(candidate=>parse(candidate.sop)
    .filter(wire=>field(wire,'attribute')==='drawn.pose'));
  const kick=values(await standard.propose('Draw a boy mid kick'));
  assert.ok(kick.some(wire=>field(wire,'value')==='kicking' && field(wire,'words')==='mid kick'));
  assert.deepEqual(values(await standard.propose('Draw a house mid kick')),[]);
  assert.deepEqual(values(await standard.propose('Draw a girl kneeling')),[]);
  const kneel=values(await extended.propose('Draw a girl kneeling'));
  assert.ok(kneel.some(wire=>field(wire,'value')==='kneeling'));
  assert.deepEqual(values(await extended.propose('Draw a house kneeling')),[]);
  assert.deepEqual(values(await extended.propose('Draw a dog kneeling')),[]);
  assert.deepEqual(values(await extended.propose('Draw a girl "kneeling"')),[]);
});
