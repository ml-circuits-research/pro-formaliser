import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createReader } from '../src/runtime.mjs';
import { loadWorlds } from '../src/worlds.mjs';
import { parse } from '../src/schema.mjs';

const value=(wire,key)=>{
  const raw=wire?.attrs[key]?.[0];
  return raw?.startsWith('"') ? JSON.parse(raw) : raw;
};
const reasonCandidates=async (reader,text)=>(await reader.propose(text)).candidates
  .filter(c=>c.source==='discourse-reason').map(c=>parse(c.sop));

test('recovers a grounded imperative and preserves the negative motivation as literal discourse',async t=>{
  const reader=createReader({version:1,examples:[],templates:[],
    lexicon:{circle:[['target','remove','drawn','existing','circle',20]]}});
  t.after(()=>reader.close());
  for (const [motivation,suffix] of [
    ['We do not need that grouping anymore',', delete the circle.'],
    ['I don’t want the old pattern','; delete the circle.'],
    ["I don't like the chart",'. Then delete the circle.'],
  ]) {
    const candidates=await reasonCandidates(reader,motivation+suffix);
    assert.ok(candidates.some(wires=>{
      const requests=wires.filter(w=>w.type==='w.request.request');
      return requests.length===1 && value(requests[0],'act')==='remove' &&
        value(requests[0],'words')===motivation+suffix && value(requests[0],'predicate')==='delete' &&
        wires.some(w=>w.type==='w.request.unread' && value(w,'request')==='$'+requests[0].id &&
          value(w,'text')===motivation && value(w,'note')==='stated negative motivation') &&
        wires.some(w=>w.type==='w.request.target' && value(w,'sort')==='circle');
    }),motivation);
  }
});

test('retains a negative preference when the explicit imperative might contradict it',async t=>{
  const reader=createReader({version:1,examples:[],templates:[],
    lexicon:{circle:[['target','make','drawn','new','circle',20]]}});
  t.after(()=>reader.close());
  const reason="I don't want the yellow circle";
  const candidates=await reasonCandidates(reader,reason+', draw the yellow circle.');
  assert.ok(candidates.some(wires=>wires.some(w=>w.type==='w.request.unread' && value(w,'text')===reason) &&
    wires.some(w=>w.type==='w.request.request' && value(w,'predicate')==='draw') &&
    !wires.some(w=>w.type==='w.request.filler' && value(w,'text')===reason)));
});

test('keeps guards, negative instructions, declarative continuations and quotes intact',async t=>{
  const reader=createReader({version:1,examples:[],templates:[],
    lexicon:{circle:[['target','remove','drawn','existing','circle',20]]}});
  t.after(()=>reader.close());
  for (const text of [
    'Do not delete the square, delete the circle.',
    'We do not need you to delete the square, delete the circle.',
    'We do not need that part if it is fine, delete the circle.',
    'We do not need that part, delete the circle if it is red.',
    'We do not need that part, do not delete the circle.',
    'Do we not need that part, delete the circle?',
    'We do not need that part, delete the circle?',
    'We do not need that part, the circle should be deleted.',
    'We do not need that part, "delete the circle".',
  ]) assert.equal((await reasonCandidates(reader,text)).length,0,text);
});

test('uses an independent native predicate, family and motivation vocabulary from a fresh overlay',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'sop-discourse-reason-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const path=join(dir,'bench.sop');
  writeFileSync(path,`
@bench std.schema.world name=w.workbench
@fixture std.schema.kind of=w.workbench.fixture world=w.workbench acts=remove
@stand pro.reader.target family=fixture sort=stand text=stand act=remove tab=workbench mode=existing
@unmount k.actions.verb act=remove text=unmount
@require w.lang.en.skip class=desire text=require
`);
  const reader=createReader(undefined,loadWorlds({paths:[path]}));
  t.after(()=>reader.close());
  const text='We do not require that assembly — unmount the stand';
  assert.ok((await reasonCandidates(reader,text)).some(wires=>
    wires.some(w=>w.type==='w.request.target' && value(w,'family')==='fixture') &&
    wires.some(w=>w.type==='w.request.request' && value(w,'predicate')==='unmount')));
});
