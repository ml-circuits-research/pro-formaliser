import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { evidenceInText } from '../src/grounding.mjs';
import { reciprocalReading } from '../src/reciprocal-reading.mjs';
import { createReader } from '../src/runtime.mjs';
import { parse, validate } from '../src/schema.mjs';
import { loadWorlds } from '../src/worlds.mjs';

const local=fileURLToPath(new URL('../sop-worlds/',import.meta.url));
const clause='draw two kids on the lawn facing each other';
const filler='right there in the picture — that is how the picture goes';
const text=clause+' — '+filler;
const base=`@f w.request.filler text="${filler}"
@r w.request.request act=make mood=do words="${clause}" predicate=draw
@t w.request.target request=$r family=drawn mode=new determiner=quantified sort=kid sort_words=kids count_words=two
@c1 w.request.constraint request=$r on=count attribute=drawn.count words=two operator=eq phase=result
@c2 w.request.constraint request=$r on=place attribute=drawn.relation value=on words="on the lawn" operator=relation phase=result
@c3 w.request.unread request=$r text="kids on the lawn facing each other" note=drawn.facing
@c4 w.request.constraint request=$r on=place attribute=drawn.anchor value="the lawn" operator=relation phase=selector`;
const model=(text,sop)=>({version:1,examples:[{text,sop,count:1}],templates:[]});

test('public proposals keep the selected pair, lawn, and filler while binding orientation',async t=>{
  const worlds=loadWorlds({paths:[local]});
  const reader=createReader(model(text,base),worlds);
  t.after(()=>reader.close());
  const {candidates}=await reader.propose(text);
  const reading=candidates.find(item=>item.source==='reciprocal');
  assert.ok(reading);
  assert.ok(validate(reading.sop,worlds),reading.sop);
  assert.ok(evidenceInText(text,reading.sop,worlds),reading.sop);
  const wires=parse(reading.sop);
  assert.deepEqual(wires.find(wire=>wire.type==='w.relational.reciprocal').attrs,{
    request:['$r'],members:['$t'],predicate:['$w.relational.faces'],words:['"facing each other"']
  });
  assert.equal(validate(reading.sop.replace(/ count=2(?=\s|$)/u,' count=3'),worlds),false);
  const originals=parse(base.replace('count_words=two','count_words=two count=2')).filter(wire=>wire.type!=='w.request.unread');
  assert.deepEqual(wires.filter(wire=>wire.type!=='w.relational.reciprocal'),originals);
  assert.equal(wires.filter(wire=>wire.type==='w.request.target').length,1);
  assert.equal(validate(reading.sop,loadWorlds({paths:[]})),false);
});

test('rejects singular, non-pair, comparative, asserted, negative, and quoted interpretations',()=>{
  const worlds=loadWorlds({paths:[local]});
  for (const [source,sop] of [
    ['draw a duck facing left','@r w.request.request act=make mood=do predicate=draw\n@t w.request.target request=$r family=drawn mode=new sort=duck'],
    ['draw a duck facing each other','@r w.request.request act=make mood=do predicate=draw\n@t w.request.target request=$r family=drawn mode=new sort=duck'],
    [text.replace('two','three'),base.replaceAll('two','three')],
    [text.replace('two','more than two'),base.replace('draw two','draw more than two')],
    ['do not '+text,base],
    ["don't "+text,base],
    [text.replace('facing each other','"facing each other"'),base.replace('words="'+clause+'" ','')],
    ['two kids on the lawn facing each other',base.replace('words="'+clause+'" ','')],
    ['draw two kids. facing each other',base.replace('words="'+clause+'" ','')],
    [text.replace('facing each other','facing each other or facing away'),base.replace('words="'+clause+'" ','')]
  ]) assert.equal(reciprocalReading(source,{sop},worlds),undefined,source);
});

test('an unrelated declared predicate and marker work on a different pair',async t=>{
  const path=mkdtempSync(join(tmpdir(),'pro-reader-reciprocal-'));
  t.after(()=>rmSync(path,{recursive:true,force:true}));
  cpSync(local,path,{recursive:true});
  writeFileSync(join(path,'w.relational','shards','shipyard.sop'),[
    '@w.relational.routes w.relational.predicate name=routes about="the first unit routes cargo to the second"',
    '@w.relational.routes.routing core.word text=routing means=w.relational.routes'
  ].join('\n'));
  writeFileSync(join(path,'language','shipyard.sop'),
    '@proposal.en.reciprocal.pair pro.reader.reciprocal_marker text="to its counterpart"');
  const worlds=loadWorlds({paths:[path]});
  const input='draw two cranes routing to its counterpart';
  const sop=[
    '@r w.request.request act=make mood=do predicate=draw',
    '@t w.request.target request=$r family=drawn mode=new sort=crane sort_words=cranes count=2 count_words=two',
    '@u w.request.unread request=$r text="routing to its counterpart"'
  ].join('\n');
  const reader=createReader(model(input,sop),worlds);
  t.after(()=>reader.close());
  const {candidates}=await reader.propose(input);
  const reading=candidates.find(item=>item.source==='reciprocal');
  assert.ok(reading);
  const relation=parse(reading.sop).find(wire=>wire.type==='w.relational.reciprocal');
  assert.equal(relation.attrs.predicate[0],'$w.relational.routes');
  assert.equal(relation.attrs.words[0],'"routing to its counterpart"');
});

test('enriches an explicitly scoped pair without changing a separate right-facing target',async t=>{
  const worlds=loadWorlds({paths:[local]});
  const first='show two dogs by the tent facing one another';
  const second='a small dog on the left facing right';
  const input=first+', and '+second+' — exactly where the picture needs it';
  const firstWires=[
    '@r1 w.request.request act=make mood=do predicate=show words='+JSON.stringify(first),
    '@r1.t w.request.target request=$r1 family=drawn mode=new sort=dog sort_words=dogs count_words=two',
    '@r1.p w.request.constraint request=$r1 on=place attribute=drawn.relation value=by words="by the tent" operator=relation phase=result open_value=true',
    '@r1.a w.request.constraint request=$r1 on=place attribute=drawn.anchor value="the tent" operator=relation phase=selector',
    '@r1.u w.request.unread request=$r1 text="dogs by the tent facing one another"',
  ];
  const secondWires=[
    '@r2 w.request.request act=make mood=do words='+JSON.stringify(second),
    '@r2.t w.request.target request=$r2 family=drawn mode=new sort=dog',
    '@r2.s w.request.constraint request=$r2 on=size attribute=drawn.size value=small operator=degree phase=result',
    '@r2.p w.request.constraint request=$r2 on=attribute attribute=drawn.at value=left words="on the left" operator=region phase=result',
    '@r2.f w.request.constraint request=$r2 on=attribute attribute=drawn.facing value=right operator=eq phase=result key_words=facing',
  ];
  const sop=[...firstWires,...secondWires].join('\n');
  const reader=createReader(model(input,sop),worlds);
  t.after(()=>reader.close());
  const {candidates}=await reader.propose(input);
  const reading=candidates.find(item=>item.source==='reciprocal');
  assert.ok(reading);
  const wires=parse(reading.sop);
  assert.ok(validate(reading.sop,worlds));
  assert.ok(evidenceInText(input,reading.sop,worlds));
  assert.equal(wires.find(w=>w.id==='r1.t').attrs.count[0],'2');
  assert.deepEqual(wires.filter(w=>w.type==='w.relational.reciprocal').map(w=>w.attrs.members),[['$r1.t']]);
  assert.deepEqual(wires.filter(w=>w.id==='r2' || w.attrs.request?.[0]==='$r2'),parse(secondWires.join('\n')));
  assert.equal(reciprocalReading(input,{sop,source:'lexicon'},worlds),undefined);
  assert.equal(reciprocalReading('Do not '+input,{sop,source:'example'},worlds),undefined);
  const swapped=sop.replace(first,first.replace('facing one another','facing right'));
  assert.equal(reciprocalReading(input,{sop:swapped,source:'example'},worlds),undefined);
});

test('only replaces an exact open directional value for the declared key',async t=>{
  const worlds=loadWorlds({paths:[local]});
  const prefix='show two bears by the woods facing one another';
  const input=prefix+', so the whole scene still reads';
  const sop=[
    '@f w.request.filler text="so the whole scene still reads"',
    '@r w.request.request act=make mood=do predicate=show words='+JSON.stringify(prefix),
    '@t w.request.target request=$r family=drawn mode=new sort=bear sort_words=bears count_words=two',
    '@p w.request.constraint request=$r on=place attribute=drawn.relation value=by words="by the woods" operator=relation phase=result open_value=true',
    '@d w.request.constraint request=$r on=attribute attribute=drawn.facing value="one another" operator=eq phase=result open_value=true key_words=facing words="facing one another"',
  ].join('\n');
  const reader=createReader(model(input,sop),worlds);
  t.after(()=>reader.close());
  const {candidates}=await reader.propose(input);
  const reading=candidates.find(item=>item.source==='reciprocal');
  assert.ok(reading);
  assert.ok(validate(reading.sop,worlds));
  const wires=parse(reading.sop);
  assert.ok(!wires.some(w=>w.id==='d'));
  assert.ok(wires.some(w=>w.id==='f'));
  assert.deepEqual(wires.find(w=>w.type==='w.relational.reciprocal').attrs.words,['"facing one another"']);
  const use=sop+'\n@l w.request.lookup request=$r constraint=$d key=thing from=page';
  assert.equal(reciprocalReading(input,{sop:use,source:'example'},worlds),undefined);
  const conflicting=sop.replace('value="one another"','value=right');
  assert.equal(reciprocalReading(input,{sop:conflicting,source:'example'},worlds),undefined);
});
