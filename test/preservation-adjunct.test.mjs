import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createReader } from '../src/runtime.mjs';
import { loadWorlds } from '../src/worlds.mjs';
import { parse } from '../src/schema.mjs';

const value=(wire,key)=>{
  const item=wire?.attrs[key]?.[0];
  return item?.startsWith('"') ? JSON.parse(item) : item;
};
const read=async (reader,text)=>(await reader.propose(text)).candidates
  .filter(c=>c.source==='preservation-adjunct').map(c=>parse(c.sop));

test('preserves named and remainder targets without inventing a universal or an extra action',async t=>{
  const reader=createReader({version:1,examples:[],templates:[],
    lexicon:{circle:[['target','make','drawn','new','circle',10]]}});
  t.after(()=>reader.close());
  for (const [text,keep,field,selector] of [
    ['Draw a circle, keeping everything else where it is.','place','description','everything else'],
    ['Draw a circle — keep "North Pier" as it is.','all','name','North Pier'],
    ['Draw a circle but leave Kettle unchanged.','all','name','Kettle'],
  ]) {
    const circuits=await read(reader,text);
    assert.ok(circuits.some(wires=>{
      const requests=wires.filter(w=>w.type==='w.request.request');
      const [creation,retention]=requests;
      const owned=w=>value(w,'request')==='$'+retention?.id;
      const target=wires.find(w=>w.type==='w.request.target' && owned(w));
      return requests.length===2 && value(creation,'act')==='make' &&
        value(target,'family')==='drawn' && value(target,'mode')==='existing' &&
        value(target,'fill')!=='all' && value(target,field)===selector &&
        wires.some(w=>owned(w) && value(w,'attribute')==='drawn.keep' && value(w,'value')===keep);
    }),text);
  }
});

test('requires a complete local preservation frame outside quotations and conditional or interrogative text',async t=>{
  const reader=createReader();
  t.after(()=>reader.close());
  for (const text of [
    'Draw a circle containing "keep the rest unchanged".',
    'Draw a circle, keep the rest unchanged?',
    'Draw a circle, if necessary keep the rest unchanged.',
    'If needed, draw a circle, keeping the rest unchanged.',
    'Draw a circle, keep the rest unchanged and remove the triangle.',
    'Draw a circle, keep the rest on the left.',
    'Where is the circle? Keep the rest unchanged.',
  ]) assert.equal((await read(reader,text)).length,0,text);
});

test('binds a compatible catalog preservation key in another family',async t=>{
  const directory=mkdtempSync(join(tmpdir(),'sop-retention-'));
  t.after(()=>rmSync(directory,{recursive:true,force:true}));
  const overlay=join(directory,'bench.sop');
  writeFileSync(overlay,`
@bench std.schema.world name=w.workbench
@fixture std.schema.kind of=w.workbench.fixture world=w.workbench acts=make acts=change
@stand pro.reader.target family=fixture sort=stand text=stand act=make tab=workbench mode=new
@stay w.request.key tab=workbench family=fixture name=fixture.statePreserved head=class value=place
@retention pro.reader.preservation family=fixture attribute=fixture.statePreserved
`);
  const reader=createReader(undefined,loadWorlds({paths:[overlay]}));
  t.after(()=>reader.close());
  const circuits=await read(reader,'Make a stand, leaving everything else where it is');
  assert.ok(circuits.some(wires=>wires.some(w=>value(w,'attribute')==='fixture.statePreserved')));
  assert.ok(!(await read(reader,'Make a stand, leaving everything else unchanged')).some(wires=>
    wires.some(w=>value(w,'attribute')==='fixture.statePreserved')));
});
