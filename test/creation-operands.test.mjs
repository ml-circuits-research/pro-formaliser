import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {createReader} from '../src/runtime.mjs';
import {loadWorlds} from '../src/worlds.mjs';
import {parse} from '../src/schema.mjs';

const first=(w,key)=>{
  const raw=w?.attrs[key]?.[0];
  return raw?.startsWith('"') ? JSON.parse(raw) : raw;
};
async function creation(reader,text,key,value) {
  const {candidates}=await reader.propose(text);
  return candidates.filter(c=>c.source==='literal-creation').map(c=>parse(c.sop))
    .find(wires=>wires.some(w=>first(w,'attribute')===key && first(w,'value')===value));
}

test('grounds a written name before a typed kind and a title after an implicit creation',async t=>{
  const r=createReader();t.after(()=>r.close());
  const named=await creation(r,'Draw a Charter box','node.label','Charter');
  assert.ok(named);
  assert.equal(first(named.find(w=>w.type==='w.request.target'),'sort'),'box');
  const fragment=await creation(r,'hexagon labelled Charter Board','node.label','Charter Board');
  assert.ok(fragment);
  assert.equal(first(fragment.find(w=>w.type==='w.request.request'),'predicate'),undefined);
  assert.ok(!await creation(r,'Draw a Red box','node.label','Red'));
  assert.ok(!await creation(r,'hexagon labelled Charter if approved','node.label','Charter if approved'));
});

test('reads named operands from an installed inventory with no instance or tab input',async t=>{
  const dir=mkdtempSync('.cache/named-operand-');t.after(()=>rmSync(dir,{recursive:true,force:true}));
  writeFileSync(join(dir,'work.sop'),[
    '@w std.schema.world name=w.workbench',
    '@m std.schema.kind of=w.workbench.module world=w.workbench acts=make',
    '@k w.request.key tab=workbench family=module name=module.name head=span',
    '@p k.workbench.register name=Velarium',
    '@r pro.reader.creation_role tab=workbench family=module attribute=module.name value_type=k.workbench.register'
  ].join('\n'));
  const r=createReader(undefined,loadWorlds({paths:[dir]}));t.after(()=>r.close());
  assert.ok(await creation(r,'Create Velarium','module.name','Velarium'));
  assert.ok(!await creation(r,'Create Unknownium','module.name','Unknownium'));
  assert.ok(!await creation(r,'Do not create Velarium','module.name','Velarium'));
  assert.ok(await creation(r,'Add Leo','person.name','Leo'));
});
