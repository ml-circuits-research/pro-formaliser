import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { createReader } from '../src/runtime.mjs';
import { evidenceInText } from '../src/grounding.mjs';
import { parse, validate } from '../src/schema.mjs';
import { loadWorlds } from '../src/worlds.mjs';

const one = (wire,key) => {
  const value=wire.attrs[key]?.[0];
  return value?.startsWith('"') ? JSON.parse(value) : value;
};
const constraints = wires => wires.filter(w=>w.type==='w.request.constraint');

test('grounded guards select the same object without changing the positive result',async t=>{
  const worlds=loadWorlds(), reader=createReader(undefined,worlds);
  t.after(()=>reader.close());
  for (const [text,value,polarity] of [
    ['Make the object blue if it is red.','red',undefined],
    ['Make the object blue unless it is green.','green','no'],
    ['Make the object blue if it is not green.','green','no'],
    ['If it is red, make the object blue.','red',undefined],
    ['If it is red then make the object blue.','red',undefined],
    ['If the object is red, then make the object blue.','red',undefined],
    ['Unless it is green, make the object blue.','green','no'],
  ]) {
    const result=await reader.formalise(text,{tab:'drawing'});
    assert.equal(result.source,'guarded',text);
    assert.ok(validate(result.sop,worlds) && evidenceInText(text,result.sop,worlds),text);
    const wires=parse(result.sop);
    const [request,target]=['request','target'].map(type=>wires.find(w=>w.type==='w.request.'+type));
    assert.equal(one(request,'words'),undefined,text);
    const statements=constraints(wires);
    assert.ok(statements.every(w=>one(w,'request')===one(target,'request')),text);
    assert.deepEqual(statements.map(w=>[one(w,'attribute'),one(w,'phase'),one(w,'want'),one(w,'value')]),[
      ['drawn.colour','selector',polarity,value],
      ['drawn.colour','result',undefined,'blue'],
    ],text);
  }
});

test('leaves unresolved references, compound conditions and other objects outside the guard subset',async t=>{
  const reader=createReader();
  t.after(()=>reader.close());
  for (const text of [
    'Make the object blue if the box is red.',
    'Make the object blue if the other object is red.',
    'Make the object blue unless it is selected.',
    'Make the object blue if it is red or green.',
    'Make the object blue if it was red.',
    'Make the object blue if it is red, then delete the object.',
    'Make the object blue and delete the box if it is red.',
    'If the object is blue, then paint it red.',
  ]) {
    const {candidates}=await reader.propose(text);
    assert.ok(candidates.every(c=>c.source!=='guarded'),text);
  }
});

test('a closed scalar guard and result use a newly declared family',async t=>{
  const cache = fileURLToPath(new URL('../.cache/',import.meta.url));
  const dir = mkdtempSync(join(cache,'guard-world-test-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const file = join(dir,'overlay.sop');
  writeFileSync(file,`
@fixture.head pro.reader.target family=fixture tab=workbench sort=fluxometer text=fluxometer act=change mode=existing
@fixture.finish w.request.key tab=workbench family=fixture name=fixture.finish head=class value=polished value=frosted
@fixture.scope pro.reader.scope_cue kind=condition polarity=positive text="in case"
`);
  const worlds=loadWorlds({paths:[file]}), reader=createReader(undefined,worlds);
  t.after(()=>reader.close());
  const text='In case the fluxometer is frosted, make the fluxometer polished.';
  const {candidates}=await reader.propose(text);
  const reading=candidates.find(r=>r.source==='guarded');
  assert.ok(reading);
  assert.ok(validate(reading.sop,worlds) && evidenceInText(text,reading.sop,worlds));
  assert.deepEqual(constraints(parse(reading.sop)).map(w=>[one(w,'attribute'),one(w,'phase'),one(w,'value')]),[
    ['fixture.finish','selector','frosted'],['fixture.finish','result','polished'],
  ]);
});
