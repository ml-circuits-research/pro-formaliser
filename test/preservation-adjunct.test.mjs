import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createReader } from '../src/runtime.mjs';
import { loadWorlds } from '../src/worlds.mjs';
import { parse } from '../src/schema.mjs';
import { preservationAdjunct, preservationAdjunctReading } from '../src/preservation-adjunct.mjs';

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
    'Do not draw a circle, keeping everything else where it is.',
    'Draw a circle, do not leave everything else unchanged.',
    'Where is the circle? Keep the rest unchanged.',
  ]) assert.equal((await read(reader,text)).length,0,text);
});

const ownedText='Draw a kite under the bridge facing the moon';
const retentionText='keeping everything else where it is';
const fullText=ownedText+', '+retentionText+'.';
const original=[
  '@r w.request.request act=make mood=do predicate=Draw words='+JSON.stringify(fullText),
  '@t w.request.target request=$r family=drawn mode=new determiner=indefinite sort=kite',
  '@p w.request.constraint request=$r on=place attribute=drawn.relation value=under operator=relation phase=result words="under the bridge"',
  '@a w.request.constraint request=$r on=place attribute=drawn.anchor value="the bridge" operator=relation phase=selector',
  '@f w.request.constraint request=$r on=attribute attribute=drawn.facing value=moon operator=eq phase=result open_value=true key_words=facing words="the moon"',
  '@filler w.request.filler text="keeping everything else"',
].join('\n');

test('preserves a fully grounded base available only in a full-input candidate',async t=>{
  const reader=createReader({version:1,examples:[{text:fullText,sop:original,count:4}],templates:[],lexicon:{}});
  t.after(()=>reader.close());
  const full=await reader.propose(fullText,{evidence:true});
  const typed=full.candidates.find(c=>c.source==='preservation-adjunct' && c.sop.includes('drawn.facing'));
  assert.ok(typed,fullText);
  assert.ok(full.candidates.some(c=>c.sop.includes('@filler w.request.filler')));
  const wires=parse(typed.sop);
  assert.equal(value(wires.find(w=>w.id==='r'),'words'),ownedText);
  assert.equal(value(wires.find(w=>w.id==='a'),'value'),'the bridge');
  assert.equal(value(wires.find(w=>w.id==='f'),'words'),'the moon');
  assert.equal(value(wires.find(w=>value(w,'attribute')==='drawn.keep'),'value'),'place');
  assert.ok(!wires.some(w=>w.id==='filler'));
  assert.deepEqual(typed.evidence.missing,[]);
  assert.equal(typed.evidence.counts.unread,undefined);
});

test('rejects suffix effects and preserves unresolved base text of a full-input candidate',()=>{
  const worlds=loadWorlds();
  const split=preservationAdjunct(fullText,worlds);
  assert.ok(split);
  const compose=sop=>preservationAdjunctReading(fullText,split,{sop},worlds);
  const extra='\n@x w.request.constraint request=$r on=attribute attribute=drawn.label value="everything else"';
  assert.equal(compose(original+extra),undefined);
  assert.equal(compose(original+'\n@x w.request.request act=change words="'+retentionText+'"'),undefined);
  const partial=original.split('\n').filter(line=>!line.startsWith('@f ')).join('\n')+
    '\n@u w.request.unread request=$r text='+JSON.stringify('facing the moon, '+retentionText+'.');
  const candidate=compose(partial);
  assert.ok(candidate);
  assert.equal(value(parse(candidate.sop).find(w=>w.id==='u'),'text'),'facing the moon');
  assert.equal(compose(partial+' note="unresolved relation"'),undefined);
  const mixed='Remove the chart; '+fullText;
  const other=[
    '@other w.request.request act=remove mood=do predicate=Remove words="Remove the chart"',
    '@other.t w.request.target request=$other family=chart mode=existing fill=description description="the chart"'
  ].join('\n');
  assert.equal(preservationAdjunctReading(mixed,preservationAdjunct(mixed,worlds),
    {sop:other+'\n'+original},worlds),undefined);
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
