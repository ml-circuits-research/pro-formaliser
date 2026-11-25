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

test('keeps the remainder on the independently established object family through a page-wide edit',async t=>{
  const reader=createReader({version:1,examples:[],templates:[],
    lexicon:{circle:[['target','make','drawn','new','circle',10]]}});
  t.after(()=>reader.close());
  const text='Draw a circle, clear as day, then set the entire picture to a foggy morning — the other objects stay put.';
  const {candidates}=await reader.propose(text,{evidence:true});
  const matched=candidates.find(c=>{
    if (c.source!=='preservation-adjunct') return false;
    const wires=parse(c.sop), requests=wires.filter(w=>w.type==='w.request.request');
    const owned=(wire,req)=>value(wire,'request')==='$'+req?.id;
    const [draw,scene,keep]=requests;
    return requests.length===3 && value(draw,'act')==='make' && value(keep,'predicate')==='stay' &&
      wires.some(w=>owned(w,scene) && value(w,'family')==='page') &&
      wires.some(w=>owned(w,keep) && value(w,'family')==='drawn' && value(w,'description')==='the other objects') &&
      wires.some(w=>owned(w,keep) && value(w,'attribute')==='drawn.keep' && value(w,'value')==='place') &&
      wires.some(w=>owned(w,draw) && w.type==='w.request.unread' && value(w,'text')==='clear as day');
  });
  assert.ok(matched,text);
  assert.deepEqual(matched.evidence.missing,[]);
  assert.deepEqual(matched.catalog.issues,[]);
  assert.ok(!matched.evidence.counts.uncovered);
  for (const text of [
    'Draw a circle — the other objects stay on the left.',
    'Draw a circle — the other objects stay put if approved.',
    'Draw a circle — the other objects stay put, delete the node.',
    'Draw a circle, then remove the node — the other objects stay put.',
    'Draw a circle labelled "the other objects stay put".',
  ]) assert.equal((await read(reader,text)).length,0,text);
});

test('motion amount wording cannot transfer a retention constraint onto the moved object',async t=>{
  const reader=createReader({version:1,examples:[],templates:[],lexicon:{
    dog:[['target','place','drawn','existing','dog',10]],
    all:[['constraint','*','drawn','on=attribute attribute=drawn.keep value=all operator=eq phase=result',10]],
  }});
  t.after(()=>reader.close());
  const text='Move the dog all the way to the left, and the rest stay exactly where they are, no other change to the scene.';
  const candidates=await read(reader,text);
  const matching=candidates.find(wires=>{
    const [edit,keep]=wires.filter(w=>w.type==='w.request.request');
    return value(edit,'act')==='place' && value(keep,'predicate')==='stay' &&
      wires.some(w=>value(w,'request')==='$'+keep.id && value(w,'description')==='the rest') &&
      wires.some(w=>value(w,'request')==='$'+keep.id && value(w,'attribute')==='drawn.keep' && value(w,'value')==='place') &&
      wires.some(w=>value(w,'request')==='$'+keep.id && w.type==='w.request.unread' &&
        value(w,'text')==='no other change to the scene');
  });
  assert.ok(matching,text);
  assert.ok(matching.filter(w=>value(w,'attribute')==='drawn.keep').every(w=>value(w,'value')==='place'));
  assert.ok(matching.some(w=>w.type==='w.request.unread' && value(w,'text').includes('all the way')));
});

test('binds a directional prohibition to the named thing kept in place',async t=>{
  const reader=createReader();
  t.after(()=>reader.close());
  for (const [text,owner,direction,pause] of [
    ["no — the boat stays put, don't move it left",'the boat','left'],
    ["no — the boat stays put, hold off, don't shift it left",'the boat','left','hold off'],
    ['The green boat stays put; do not push it upwards.','The green boat','up'],
  ]) {
    const {candidates}=await reader.propose(text,{evidence:true});
    const reading=candidates.find(c=>c.source==='retention-correction');
    assert.ok(reading,text);
    const wires=parse(reading.sop), requests=wires.filter(w=>w.type==='w.request.request');
    const [keep,ban]=requests;
    assert.equal(requests.length,2);
    const keepTarget=wires.find(w=>w.type==='w.request.target' && value(w,'request')==='$'+keep.id);
    const bound=wires.find(w=>w.type==='w.request.target' && value(w,'request')==='$'+ban.id);
    assert.equal(value(keepTarget,'description'),owner);
    assert.equal(value(bound,'mode'),'bound');
    assert.equal(value(bound,'family_words'),'it');
    assert.equal(wires.filter(w=>w.type==='w.request.lookup').length,1);
    assert.ok(wires.some(w=>value(w,'request')==='$'+keep.id && value(w,'attribute')==='drawn.keep' && value(w,'value')==='place'));
    const effects=wires.filter(w=>value(w,'request')==='$'+ban.id && w.type==='w.request.constraint');
    assert.deepEqual(effects.map(w=>['attribute','value','want'].map(key=>value(w,key))),[['drawn.direction',direction,'no']]);
    assert.deepEqual(wires.filter(w=>w.type==='w.request.unread').map(w=>value(w,'text')),pause ? [pause] : []);
    assert.deepEqual(reading.evidence.missing,[]);
    assert.deepEqual(reading.catalog.issues,[]);
    assert.ok(!reading.evidence.counts.uncovered);
  }
  for (const text of [
    "The boat stays put, don't move the dock left.",
    "The boats stay put, don't move it left.",
    "If ready the boat stays put, don't move it left.",
    "The boat stays put, don't move it left if wet.",
    "The boat stays put, don't move it left?",
    'The boat stays put, label it "do not move it left".',
  ]) assert.ok((await reader.propose(text)).candidates.every(c=>c.source!=='retention-correction'),text);
});

test('binds a scoped keep request to the single written owner of its preceding change',async t=>{
  const reader=createReader();
  t.after(()=>reader.close());
  for (const [body,family,effect,result,scope] of [
    ['If you can, set my avatar to an elderly lady','drawn','drawn.preset','old woman',
      'for the next time I open the app on this machine'],
    ['Set the node height to 40,','node','node.height','40','until the next time I sign in'],
  ]) {
    const text=`${body} and keep it ${scope}.`;
    const {candidates}=await reader.propose(text,{evidence:true});
    const candidate=candidates.find(c=>{
      if (c.source!=='preservation-adjunct') return false;
      const wires=parse(c.sop), requests=wires.filter(w=>w.type==='w.request.request');
      const [change,keep]=requests;
      const owns=(w,r)=>value(w,'request')==='$'+r.id;
      const scoped=(r,key,expected)=>wires.some(w=>owns(w,r) && value(w,'attribute')===key &&
        value(w,'phase')==='result' && value(w,'value')===expected);
      return requests.length===2 && value(keep,'predicate')==='keep' &&
        wires.some(w=>owns(w,keep) && w.type==='w.request.target' && value(w,'family')===family &&
          value(w,'mode')==='bound' && value(w,'family_words')==='it') &&
        wires.every(w=>!owns(w,keep) || w.type!=='w.request.lookup') &&
        scoped(change,effect,result) && scoped(keep,family+'.keep','all') && scoped(keep,'preference.scope',scope);
    });
    assert.ok(candidate,text);
    assert.equal(candidate.status,'matched');
    assert.deepEqual(candidate.catalog.issues,[]);
    assert.deepEqual(candidate.evidence.missing,[]);
    assert.ok(!candidate.evidence.counts.unread && !candidate.evidence.counts.uncovered);
  }
  for (const text of [
    'Set my avatar to robot and keep it for five minutes.',
    'Set my avatar to robot and keep it for the demo.',
    'Set my avatar to robot and keep it for the next time.',
    'Set my avatar to robot and keep them for the next time I sign in.',
    'Set my avatar to robot and keep it for the next time I sign in and delete the box.',
    'Set my avatar to robot and keep it for the next time I sign in if possible.',
    'If approved, set my avatar to robot and keep it for the next time I sign in.',
    'Do not set my avatar to robot and keep it for the next time I sign in.',
    'Set the node label to "and keep it for the next time I sign in".',
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
