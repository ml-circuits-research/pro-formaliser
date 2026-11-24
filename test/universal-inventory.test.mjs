import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createReader } from '../src/runtime.mjs';
import { loadWorlds } from '../src/worlds.mjs';
import { parse } from '../src/schema.mjs';

const pilot=fileURLToPath(new URL('../sop-worlds/universal-inventory-pilot/',import.meta.url));
const get=(wire,key)=>{
  const raw=wire?.attrs[key]?.[0];
  return raw?.startsWith('"') ? JSON.parse(raw) : raw;
};
const universals=result=>result.candidates.filter(c=>c.source==='universal-inventory');
const opens=t=>{
  const reader=createReader(undefined,loadWorlds({paths:[pilot]}));
  t.after(()=>reader.close());
  return reader;
};

test('reads quantified native kinds using licensed existing actions and number agreement',async t=>{
  const reader=opens(t);
  const baseline=createReader();
  t.after(()=>baseline.close());
  for (const [text,act,sort,sortWords,countWords,result] of [
    ['Delete all circles','remove','circle','circles','all circles'],
    ['Remove every single tree','remove','tree',undefined,'every single tree'],
    ['Remove every lad','remove','boy','lad','every lad'],
    ['Remove all lads','remove','boy','lads','all lads'],
    ['Make all trees blue','change','tree','trees','all trees','blue'],
  ]) {
    const before=await baseline.propose(text);
    const found=await reader.propose(text,{evidence:true});
    for (const prior of before.candidates) {
      assert.ok(found.candidates.some(c=>c.sop===prior.sop),text);
    }
    assert.ok(universals(found).some(c=>{
      const wires=parse(c.sop);
      const target=wires.find(w=>w.type==='w.request.target' && get(w,'sort')===sort);
      const request=wires.find(w=>w.type==='w.request.request' && get(target,'request')==='$'+w.id);
      return get(request,'act')===act && get(target,'family')==='drawn' &&
        get(target,'mode')==='existing' && get(target,'fill')==='all' &&
        get(target,'quantifier')==='all' && get(target,'sort_words')===sortWords &&
        get(target,'count_words')===countWords && c.evidence.missing.length===0 &&
        (!result || wires.some(w=>get(w,'request')===get(target,'request') &&
          get(w,'phase')==='result' && get(w,'value')===result));
    }),text);
  }
  for (const text of ['Delete all tree','Delete every trees','Remove lad','Make all trees',
    'Do not delete all circles','Delete all circles if ready','Remove every tree marker',
    'Pick all circles']) {
    assert.deepEqual(universals(await reader.propose(text)),[],text);
  }
});

test('makes the quantified main clause available to set exclusion and keeps its qualifier',async t=>{
  const reader=opens(t);
  for (const text of ['Remove all trees except those beside the house',
    'Remove all trees from the scene but keep the ones beside the house']) {
    const found=await reader.propose(text,{evidence:true});
    assert.deepEqual(universals(found),[],text);
    assert.ok(found.candidates.some(c=>c.source==='set-exclusion' && parse(c.sop).some(w=>
      get(w,'phase')==='selector' && get(w,'want')==='no' && get(w,'value')==='near')),text);
  }
});
