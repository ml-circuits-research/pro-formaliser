import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createReader} from '../src/runtime.mjs';
import {loadWorlds} from '../src/worlds.mjs';
import {parse,validate} from '../src/schema.mjs';
import {evidenceInText} from '../src/grounding.mjs';
import {sequenceReferenceReadings} from '../src/sequence-reference.mjs';

const value=(wire,key)=>{
  const raw=wire?.attrs[key]?.[0];
  return raw?.startsWith('"') ? JSON.parse(raw) : raw;
};
const worlds=loadWorlds();
const current='Paint it blue';
const first='Draw a seal near the lighthouse';
const prefix=[
  '@r w.request.request act=make mood=do predicate=Draw words='+JSON.stringify(first),
  '@seal w.request.target request=$r family=drawn mode=new determiner=indefinite sort=seal',
  '@relation w.request.constraint request=$r on=place attribute=drawn.relation value=near words="near" operator=relation phase=result',
  '@anchor w.request.constraint request=$r on=place attribute=drawn.anchor value="the lighthouse" operator=relation phase=selector',
  '@anchorLookup w.request.lookup request=$r constraint=$anchor key=thing from=page',
].join('\n');
const suffix=[
  '@c w.request.request act=change mood=do predicate=Paint words='+JSON.stringify(current),
  '@paint w.request.target request=$c family=drawn mode=existing fill=context family_words=it',
  '@old w.request.lookup request=$c target=$paint key=thing from=page',
  '@property w.request.constraint request=$c on=attribute attribute=drawn.colour value=blue operator=eq phase=result',
].join('\n');

test('binds a native pronoun to the earlier live target while preserving independent lookups',()=>{
  const text=first+'; then '+current;
  const [reading]=sequenceReferenceReadings(text,{sop:prefix+'\n'+suffix},worlds,()=>true);
  assert.ok(reading);
  assert.ok(validate(reading.sop,worlds));
  assert.ok(evidenceInText(text,reading.sop,worlds));
  assert.match(reading.sop,/mode=bound family_words="it"/);
  assert.match(reading.sop,/anchorLookup w.request.lookup/);
  assert.doesNotMatch(reading.sop,/old w.request.lookup/);
  for (const [revised,source] of [
    [suffix.replaceAll(/\bit\b/g,'them'),prefix],
    [suffix,prefix.replace('act=make','act=remove')],
    [suffix,prefix.replace('sort=seal','sort=seal count=2')],
    [suffix.replace('family=drawn','family=node'),prefix],
    [suffix.replace('fill=context family_words=it','fill=written name=blue'),prefix],
    [suffix,prefix+'\n@alt w.request.target request=$r family=drawn mode=new sort=seal'],
  ]) {
    const scope=revised.includes('Paint them blue') ? 'Paint them blue' : current;
    assert.deepEqual(sequenceReferenceReadings(first+'; then '+scope,{sop:source+'\n'+revised},worlds,()=>true),[]);
  }
});

test('uses the normal API for new targets and context-bound follow-up effects',async t=>{
  const reader=createReader({version:1,templates:[],examples:[
    {text:first,sop:prefix,count:1},
    {text:current,sop:suffix,count:1}
  ]},worlds);
  t.after(()=>reader.close());
  const input=first+'; then '+current;
  const {candidates}=await reader.propose(input);
  const next=candidates.find(c=>c.source==='sequence-reference');
  assert.ok(next);
  assert.ok(candidates.some(c=>c.source!=='sequence-reference'));
  const wires=parse(next.sop);
  const target=wires.find(w=>w.type==='w.request.target' && value(w,'mode')==='bound');
  assert.equal(value(target,'family'),'drawn');
  assert.equal(value(target,'family_words'),'it');
  assert.ok(wires.some(w=>value(w,'request')===value(target,'request') && value(w,'attribute')==='drawn.colour'));
  assert.ok(wires.some(w=>value(w,'mode')==='new' && value(w,'sort')==='seal'));
});

test('requires plural evidence and retains only grounded preservation dependencies',()=>{
  const earlier='Draw two seals near the lighthouse', later='Hold them there';
  const plural=prefix.replace(first,earlier).replace('determiner=indefinite sort=seal',
    'determiner=quantified sort=seal sort_words=seals count=2 count_words=two');
  const keep=[
    '@c w.request.request act=change mood=do predicate=Hold words='+JSON.stringify(later),
    '@paint w.request.target request=$c family=drawn mode=existing fill=description description=them',
    '@property w.request.constraint request=$c on=attribute attribute=drawn.keep value=place words="Hold them there" operator=eq phase=result',
  ].join('\n');
  const input=earlier+'; then '+later;
  const [reading]=sequenceReferenceReadings(input,{sop:plural+'\n'+keep},worlds,()=>true);
  assert.ok(reading);
  assert.match(reading.sop,/mode=bound family_words="them"/);
  assert.match(reading.sop,/attribute=drawn.keep value=place/);
  const noPlace=plural.split('\n').filter(line=>!line.includes('attribute=drawn.relation')).join('\n');
  assert.deepEqual(sequenceReferenceReadings(input,{sop:noPlace+'\n'+keep},worlds,()=>true),[]);
  assert.deepEqual(sequenceReferenceReadings(input,{sop:plural+'\n'+keep},worlds,()=>false),[]);
});
