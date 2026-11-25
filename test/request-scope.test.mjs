import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { createReader } from '../src/runtime.mjs';
import { parse } from '../src/schema.mjs';
import { loadWorlds } from '../src/worlds.mjs';

const decode = value => value?.startsWith('"') ? JSON.parse(value) : value;
const rows = ({sop},kind) => parse(sop).filter(wire => wire.type === 'w.request.' + kind)
  .map(wire=>Object.fromEntries(Object.entries(wire.attrs).map(([key,[value]])=>[key,decode(value)])));
const model = examples => ({version:1,examples,templates:[]});
const change = [
  '@r w.request.request act=change mood=do predicate=paint',
  '@t w.request.target request=$r family=drawn mode=existing family_words=object',
].join('\n');
const color = (value, phase='result', extra='') =>
  '@c.'+value+' w.request.constraint request=$r on=attribute attribute=drawn.colour value='+value+
  ' operator=eq phase='+phase+extra;

test('terminal punctuation does not turn polite imperatives into questions',async t=>{
  const reader=createReader();
  t.after(()=>reader.close());
  for (const input of ['Could you paint the object blue?','Could you also paint the object blue?','Paint the object blue!']) {
    const result=await reader.formalise(input,{});
    assert.equal(rows(result,'request')[0].act,'change');
    assert.deepEqual(rows(result,'constraint').map(({value,phase})=>[value,phase]),[['blue','result']]);
  }
});

test('interrogatives preserve selectors and cannot inherit an imperative result',async t=>{
  const text='Is the object blue?';
  const unsupported=[change.replace('predicate=paint','predicate=Is'),color('blue')].join('\n');
  const reader=createReader(model([{text,sop:unsupported,count:40}]));
  t.after(()=>reader.close());
  const result=await reader.formalise(text,{});
  assert.equal(rows(result,'request')[0].act,'ask');
  assert.deepEqual(rows(result,'constraint').map(({value,phase})=>[value,phase]),[['blue','selector']]);
  const survey=await reader.propose('Should I paint the object blue?');
  assert.ok(survey.candidates.length);
  assert.ok(survey.candidates.every(candidate=>rows(candidate,'request').every(req=>req.act==='ask')));
});

test('negative contrast leaves earlier positive evidence available',async t=>{
  const text='paint the object red, but not blue.';
  const stale=[change,color('red'),color('blue')].join('\n');
  const reader=createReader(model([{text,sop:stale,count:40}]));
  t.after(()=>reader.close());
  const result=await reader.formalise(text,{});
  assert.deepEqual(rows(result,'constraint').map(({value,phase})=>[value,phase]),[['red','result']]);
  assert.ok(rows(result,'unread').some(row=>row.text.includes('not blue')));
  assert.equal((await reader.propose('Do not paint the object blue.')).candidateCount,0);
});

test('local exclusions stay unread while both positive clauses remain available',async t=>{
  const reader=createReader();
  t.after(()=>reader.close());
  for (const exclusion of ['but not blue','instead of blue','rather than blue']) {
    const result=await reader.formalise('Paint the object red, '+exclusion+', then paint the object green.',{});
    assert.deepEqual(rows(result,'request').map(row=>row.act),['change','change']);
    assert.deepEqual(rows(result,'constraint').map(({value})=>value),['red','green']);
    assert.ok(rows(result,'unread').some(row=>row.text.includes(exclusion)),exclusion);
  }
});

test('unbound conditions are not promoted while typed negative and condition survive',async t=>{
  const typedNegation='do not paint the object blue';
  const typedCondition='if the object is blue, then paint it red';
  const reader=createReader(model([
    {text:typedNegation,sop:[change,color('blue','result',' want=no')].join('\n'),count:1},
    {text:typedCondition,sop:[change,color('blue','selector'),color('red')].join('\n'),count:1},
  ]));
  t.after(()=>reader.close());
  const negation=await reader.formalise(typedNegation);
  assert.equal(rows(negation,'constraint')[0].want,'no');
  const condition=await reader.formalise(typedCondition);
  assert.deepEqual(rows(condition,'constraint').map(({value,phase})=>[value,phase]),[
    ['blue','selector'],['red','result'],
  ]);
  const noGuards=createReader();
  t.after(()=>noGuards.close());
  for (const input of ['If the object is blue, then paint it red.','Paint the object blue unless it is selected.']) {
    assert.equal((await noGuards.propose(input)).candidateCount,0,input);
  }
});

test('a declared conditional courtesy lead does not block an independent request',async t=>{
  const cache=fileURLToPath(new URL('../.cache/',import.meta.url));
  const dir=mkdtempSync(join(cache,'scope-test-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const file=join(dir,'overlay.sop');
  writeFileSync(file,'@extra.polite w.lang.en.phrase name=lead.polite item="if it is not too much trouble"');
  const reader=createReader(undefined,loadWorlds({paths:[file]}));
  t.after(()=>reader.close());
  const result=await reader.formalise('If it is not too much trouble, paint the object blue.',{});
  assert.equal(rows(result,'request')[0].act,'change');
  assert.equal(rows(result,'constraint')[0].value,'blue');
});

test('courtesy conditionals preserve their requested effect while substantive guards remain scoped',async t=>{
  const reader=createReader();
  t.after(()=>reader.close());
  for (const input of [
    'If you can, paint the object red.',
    'Paint the object red, if possible.',
    'I was wondering if you could paint the object red.',
  ]) {
    const result=await reader.formalise(input,{});
    assert.equal(rows(result,'request')[0]?.act,'change',input);
    assert.equal(rows(result,'constraint')[0]?.value,'red',input);
  }
  for (const input of ['If you can verify it, paint the object red.','Paint the object red if you can verify it.']) {
    assert.equal((await reader.propose(input)).candidateCount,0,input);
  }
});

test('declared suggestion, correction and removal leads keep the intended action available',async t=>{
  const examples=[
    'Can I get a blue object?',
    'Have the object blue',
    'How about making the object blue?',
  ].map(text=>({text,count:1,sop:[change.replace(' predicate=paint',''),color('blue')].join('\n')}));
  const reader=createReader(model(examples));
  t.after(()=>reader.close());
  for (const {text} of examples) {
    const proposal=await reader.propose(text);
    assert.ok(proposal.candidates.some(candidate=>rows(candidate,'request')[0].act==='change' &&
      rows(candidate,'constraint').some(({value,phase})=>value==='blue' && phase==='result')),text);
  }
  for (const input of ['No, not that, paint the object red.','What if you paint the object red?']) {
    const proposal=await reader.propose(input);
    assert.ok(proposal.candidates.some(candidate=>rows(candidate,'request')[0].act==='change' &&
      rows(candidate,'constraint').some(({value})=>value==='red')),input);
  }
  const removal=await reader.propose('No more the group Phase 2');
  assert.ok(removal.candidates.some(candidate=>rows(candidate,'request')[0].act==='remove'));
  assert.ok(removal.candidates.every(candidate=>rows(candidate,'constraint').every(c=>c.phase!=='result')));
});

test('inverted questions do not open an imperative inside a multi-step inquiry',async t=>{
  const reader=createReader();
  t.after(()=>reader.close());
  const proposal=await reader.propose('How do I draw an object and then paint it blue?');
  assert.ok(proposal.candidates.length);
  assert.ok(proposal.candidates.every(candidate=>rows(candidate,'request').every(req=>req.act==='ask')));
});

test('native wh facts and overlay condition words extensibly drive scope',async t=>{
  const cache=fileURLToPath(new URL('../.cache/',import.meta.url));
  const dir=mkdtempSync(join(cache,'scope-grammar-test-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const file=join(dir,'overlay.sop');
  writeFileSync(file,`
@fixture.wh w.lang.en.wh text=whither asks=place
@fixture.guard pro.reader.scope_cue kind=condition text="in case" polarity=positive
`);
  const reader=createReader(undefined,loadWorlds({paths:[file]}));
  t.after(()=>reader.close());
  const question=await reader.formalise('Whither is the object?');
  assert.equal(rows(question,'request')[0].question,'where');
  assert.equal((await reader.propose('Paint the object red in case I can verify it.')).candidateCount,0);
});

test('an attested command after a modal addressee can still request an action',async t=>{
  const text='Could you enamel the object blue?';
  const sop=[change.replace('predicate=paint','predicate=enamel'),color('blue')].join('\n');
  const trained={...model([{text,sop,count:1}]),lexicon:{enamel:[['act','change','do',3]]}};
  const reader=createReader(trained);
  t.after(()=>reader.close());
  assert.ok((await reader.propose(text)).candidates.some(c=>rows(c,'request').some(r=>r.act==='change') &&
    rows(c,'constraint').some(r=>r.phase==='result' && r.value==='blue')));
  const question=await reader.propose('Could she enamel the object blue?');
  assert.ok(question.candidates.every(c=>rows(c,'request').every(r=>r.act==='ask')));
});
