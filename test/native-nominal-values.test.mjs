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
  assert.deepEqual({...replacement.attrs,value:replacement.attrs.value.slice(0,original.attrs.value.length)},original.attrs);
  const worlds=loadWorlds({paths:[pilot]});
  assert.ok(worlds.nominalPositions.get('drawn').get('kneeling')
    .some(entry=>entry[1]==='drawn.pose' && entry[2]==='kneeling'));
});

test('an independently declared node value attaches to its local nominal with verbatim evidence',async t=>{
  const dir=mkdtempSync(join(fileURLToPath(new URL('../.cache/',import.meta.url)),'nominal-value-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const file=join(dir,'surface.sop');
  writeFileSync(file,`
@fixture.node.phase w.request.key tab=diagram family=node name=node.fixturePhase head=class value=ready
@fixture.node.surface pro.reader.nominal_value tab=diagram family=node key=node.fixturePhase value=ready text="standing by"
@fixture.node.absent pro.reader.nominal_value tab=diagram family=node key=node.fixturePhase value=missing text=idle
@fixture.node.wrong_tab pro.reader.nominal_value tab=drawing family=node key=node.fixturePhase value=ready text=attentive
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
