import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { catalogIssues } from '../src/catalog.mjs';
import { evidenceInText } from '../src/grounding.mjs';
import { postposedClauseReadings } from '../src/postposed-clause.mjs';
import { createReader } from '../src/runtime.mjs';
import { parse, validate } from '../src/schema.mjs';
import { loadWorlds } from '../src/worlds.mjs';

const model=(text,sop)=>({version:1,examples:[{text,sop,count:1}],templates:[]});
const frown='help the girl with pigtails frown because the sandcastle fell down';
const face=value=>[
  '@r w.request.request act=change mood=do predicate=help',
  '@t w.request.target request=$r family=drawn mode=existing sort=girl description="the girl with pigtails"',
  '@c w.request.constraint request=$r on=attribute attribute=drawn.expression value='+JSON.stringify(value)+
    ' operator=eq phase=result open_value=true'
].join('\n');

test('grounds the native expression and keeps its event separately on the same request',async t=>{
  const worlds=loadWorlds();
  const value='frown because the sandcastle fell down';
  const reader=createReader(model(frown+'.',face(value)),worlds);
  t.after(()=>reader.close());
  const {candidates}=await reader.propose(frown+'.');
  const candidate=candidates.find(c=>c.source==='postposed-clause');
  assert.ok(candidate);
  assert.ok(validate(candidate.sop,worlds));
  assert.ok(evidenceInText(frown+'.',candidate.sop,worlds));
  const wires=parse(candidate.sop);
  assert.deepEqual(catalogIssues(wires,worlds,'drawing'),[]);
  assert.equal(wires.find(wire=>wire.id==='c').attrs.value[0],'frowning');
  assert.equal(wires.find(wire=>wire.id==='c').attrs.words[0],'"frown"');
  const cause=wires.find(wire=>wire.attrs.attribute?.[0]==='drawn.cause');
  assert.equal(cause.attrs.key_words[0],'"because"');
  assert.equal(cause.attrs.value[0],'"the sandcastle fell down"');
  assert.equal(cause.attrs.request[0],'$r');
});

test('does not change literal, conditional, selecting, or otherwise unlicensed clause evidence',()=>{
  const worlds=loadWorlds();
  const value='frown because the sandcastle fell down',sop=face(value);
  const direct=(text,sop,permit=()=>true)=>postposedClauseReadings(text,{sop},worlds,permit);
  assert.deepEqual(direct('help the girl with pigtails “'+value+'”',sop),[]);
  assert.deepEqual(direct('help the girl with pigtails "'+value,sop),[]);
  assert.deepEqual(direct('do not '+frown,sop,()=>false),[]);
  assert.deepEqual(direct(frown+' if the sun comes out',sop),[]);
  assert.deepEqual(direct(frown,sop.replace('phase=result','phase=selector')),[]);
  assert.deepEqual(direct(frown,sop.replace('sort=girl description="the girl with pigtails"',
    'sort=girl description="the girl with pigtails '+value+'"')),[]);
  assert.deepEqual(direct(frown,sop.replace('drawn.expression','drawn.text')),[]);
  assert.deepEqual(direct(frown,sop.replace('phase=result','phase=result want=no')),[]);
});

test('cuts a licensed speech comparison away from an open scene value and preserves it as unread',async t=>{
  const worlds=loadWorlds();
  const text='swap the scenery behind everything for a rugged volcano slope exactly as I said, thanks';
  const sop=[
    '@r w.request.request act=change mood=do predicate=swap',
    '@t w.request.target request=$r family=page mode=existing fill=context',
    '@l w.request.lookup request=$r target=$t key=thing from=page',
    '@c w.request.constraint request=$r on=attribute attribute=page.scene value="rugged volcano slope exactly as I said, thanks" words="a rugged volcano slope exactly as I said, thanks" operator=eq phase=result'
  ].join('\n');
  const reader=createReader(model(text,sop),worlds);
  t.after(()=>reader.close());
  const {candidates}=await reader.propose(text);
  const found=candidates.find(c=>c.source==='postposed-clause');
  assert.ok(found);
  assert.ok(validate(found.sop,worlds));
  assert.ok(evidenceInText(text,found.sop,worlds));
  const wires=parse(found.sop);
  assert.equal(wires.find(wire=>wire.id==='c').attrs.value[0],'"a rugged volcano slope"');
  assert.equal(wires.find(wire=>wire.type==='w.request.unread').attrs.text[0],'"exactly as I said"');
  assert.equal(wires.find(wire=>wire.type==='w.request.filler').attrs.text[0],'"thanks"');
  assert.ok(!wires.some(wire=>wire.type==='w.request.previous'));
  for (const clause of ['as the storm settled','as I thought','as I said if the weather changes']) {
    const input=text.replace('exactly as I said',clause);
    assert.deepEqual(postposedClauseReadings(input,{sop:sop.replaceAll('exactly as I said',clause)},worlds,()=>true),[]);
  }
});

test('applies the grammar to another domain while preserving a clause’s own negation',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'postposed-clause-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  writeFileSync(join(dir,'lighting.sop'),[
    '@lab std.schema.world name=w.lighting',
    '@lamp std.schema.kind of=w.lighting.lamp world=w.lighting acts=change',
    '@mode w.request.key tab=lighting family=lamp name=lamp.mode head=class value=dim',
    '@reason w.request.key tab=lighting family=lamp name=lamp.reason head=span',
    '@grammar pro.reader.postposed_clause kind=causal tab=lighting family=lamp attribute=lamp.mode reason_key=lamp.reason text=because',
  ].join('\n'));
  const worlds=loadWorlds({paths:[dir]});
  const text='make the lamp dim because the sensor did not respond';
  const sop=[
    '@r w.request.request act=change mood=do predicate=make',
    '@t w.request.target request=$r family=lamp mode=existing',
    '@c w.request.constraint request=$r on=attribute attribute=lamp.mode value="dim because the sensor did not respond" operator=eq phase=result open_value=true',
  ].join('\n');
  const [reading]=postposedClauseReadings(text,{sop},worlds,()=>true);
  assert.ok(reading);
  assert.ok(validate(reading.sop,worlds));
  assert.ok(evidenceInText(text,reading.sop,worlds));
  assert.deepEqual(catalogIssues(parse(reading.sop),worlds,'lighting'),[]);
  assert.match(reading.sop,/attribute=lamp.reason value="the sensor did not respond"/);
});
