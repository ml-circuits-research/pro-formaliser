import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { evidenceInText } from '../src/grounding.mjs';
import { createReader } from '../src/runtime.mjs';
import { validate } from '../src/schema.mjs';
import { loadWorlds } from '../src/worlds.mjs';
import { createNearExample } from '../src/near-example.mjs';

const request = '@r w.request.request act=change mood=do predicate=paint';
const target = '@t w.request.target request=$r family=shape sort=circle';
const source = (text, sop, count) => ({text, sop, count});
const discourse = [{text:'please', class:'politeness'}, {text:'thanks', class:'politeness'},
  {text:'um', class:'interjection'}, {text:'now', class:'filler'}];

test('anchors the full body and replaces boundary courtesy with input evidence', () => {
  const lookup = createNearExample([
    source('um, paint the circle, thanks.', [
      request + ' words="um, paint the circle, thanks."', target,
      '@near.f1 w.request.filler text=um', '@f w.request.filler text=thanks',
    ].join('\n'), 4),
  ], {discourse});
  const [answer] = lookup('paint the circle please!');
  assert.equal(answer.support, 4);
  assert.match(answer.sop, /words="paint the circle"/);
  assert.match(answer.sop, /@near\.f2 w\.request\.filler text="please"/);
  assert.doesNotMatch(answer.sop, /um|thanks/);
  assert.deepEqual(lookup('paint the square please!'), []);
  assert.deepEqual(lookup('paint the circle now'), []);
  assert.deepEqual(lookup('paint the circle please?'), []);
  assert.deepEqual(lookup('do not paint the circle please'), []);
});

test('retains existing unread content and question punctuation', () => {
  const lookup = createNearExample([
    source('can you paint the circle sideways?', [
      request, target, '@u w.request.unread request=$r text=sideways',
    ].join('\n')),
  ], {discourse});
  const [answer] = lookup('can you paint the circle sideways, please?');
  assert.equal(answer.unread, 'sideways');
  assert.match(answer.sop, /w\.request\.unread request=\$r text=sideways/);
  assert.deepEqual(lookup('can you paint the circle sideways please.'), []);
});

test('rejects a transfer that would drop a value or evidence from the source', () => {
  const lookup = createNearExample([
    source('paint the circle please', [request, target,
      '@c w.request.constraint request=$r attribute=shape.colour value="please"'].join('\n')),
    source('paint the circle thanks', [request, target,
      '@t2 w.request.target request=$r name=thanks'].join('\n')),
  ], {discourse});
  assert.deepEqual(lookup('paint the circle.'), []);
});

test('public reader transfers a positive nominal suggestion with the shared payload and its limits',async t=>{
  const worlds=loadWorlds();
  const body='a line chart of monthly revenue, peak marked and labelled, with gridlines behind it';
  const donor='one more thing: I want '+body+', if you can';
  const receiver='How about '+body+'?';
  const annotation=[
    '@f w.request.filler text="more thing"',
    '@r w.request.request act=make mood=do predicate=want words='+JSON.stringify('I want '+body),
    '@t w.request.target request=$r family=chart mode=new determiner=indefinite',
    '@c1 w.request.constraint request=$r on=attribute attribute=chart.type value=line words="line chart" operator=eq phase=result',
    '@c2 w.request.constraint request=$r on=attribute attribute=chart.measure value=revenue operator=eq phase=result',
    '@c3 w.request.constraint request=$r on=attribute attribute=chart.grid value=show words="with gridlines behind it" operator=eq phase=result',
    '@u w.request.unread request=$r text="peak marked and labelled" note=chart.annotation',
  ].join('\n');
  const examples=[source(donor,annotation,3)];
  const reader=createReader({version:1,examples,templates:[]},worlds);
  t.after(()=>reader.close());
  const {candidates}=await reader.propose(receiver);
  const reading=candidates.find(candidate=>candidate.source==='near-example');
  assert.ok(reading,receiver);
  assert.equal(reading.support,3);
  assert.ok(validate(reading.sop,worlds));
  assert.ok(evidenceInText(receiver,reading.sop,worlds));
  assert.match(reading.sop,/predicate="How about"/);
  assert.match(reading.sop,/attribute=chart\.measure value=revenue/);
  assert.match(reading.sop,/attribute=chart\.grid value=show/);
  assert.match(reading.sop,/text="peak marked and labelled"/);
  const find=createNearExample(examples,{discourse:worlds.discourse,worlds});
  for (const query of [
    'Show me '+body, 'I prefer '+body, 'Maybe '+body, 'Quick question: '+body, 'But '+body,
    'Oh wait: '+body, 'Cancel '+body, 'Do not make '+body,
    'What if '+body, 'Just '+body, '"How about" '+body,
    'By the way '+receiver, receiver+' Only if approved.',
    'How about '+body.replace('revenue','spending')+'?',
  ]) assert.deepEqual(find(query),[],query);
  assert.deepEqual(createNearExample([source(donor.replace('I want','Show me'),annotation.replace('predicate=want','predicate=show').replace('I want','Show me'))],
    {discourse:worlds.discourse,worlds})(receiver),[]);
  assert.deepEqual(createNearExample([source(donor.replace('if you can','if approved'),annotation)],
    {discourse:worlds.discourse,worlds})(receiver),[]);
});

test('keeps action support narrow and reads a neutral opening contributed by an overlay',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'near-example-openings-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  writeFileSync(join(dir,'openings.sop'),'@bench.lead pro.reader.body_lead role=neutral text="a quick aside"');
  const worlds=loadWorlds({paths:[dir]});
  const action='draw a cat on the lawn';
  const annotation=[
    '@r w.request.request act=make mood=do predicate=draw words='+JSON.stringify(action),
    '@t w.request.target request=$r family=drawn mode=new sort=cat',
    '@c w.request.constraint request=$r on=place attribute=drawn.anchor value="the lawn" operator=relation phase=selector',
  ].join('\n');
  const find=createNearExample([source(action,annotation,4)],{discourse:worlds.discourse,worlds});
  for (const query of ['A quick aside: '+action,'Just '+action]) {
    const [reading]=find(query);
    assert.ok(reading,query);
    assert.match(reading.sop,/attribute=drawn\.anchor value="the lawn"/);
    assert.match(reading.sop,/w\.request\.filler text="(?:A quick aside|Just)"/);
  }
  for (const query of ['A quick aside '+action,'Maybe '+action,'But '+action,'Just do not '+action,'Just '+action+'?']) {
    assert.deepEqual(find(query),[],query);
  }
  const ask=annotation.replace('act=make mood=do','act=ask mood=ask');
  assert.deepEqual(createNearExample([source(action,ask)],{discourse:worlds.discourse,worlds})('Just '+action),[]);
});
