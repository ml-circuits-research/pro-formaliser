import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createReader } from '../src/runtime.mjs';
import { parse } from '../src/schema.mjs';

const decode=value=>value?.startsWith('"') ? JSON.parse(value) : value;
const first=(wire,key)=>decode(wire.attrs[key]?.[0]);
const kinds=['cat','bird','dog','house','scarf'];
const model={version:1,examples:[],templates:[],lexicon:Object.fromEntries(kinds.map(kind=>
  [kind,[['target','make','drawn','new',kind,100]]]))};

test('scene objects keep their colours and the background remains in the source scope',async t=>{
  const reader=createReader(model);
  t.after(()=>reader.close());
  const background='A moonlit meadow in the evening';
  for (const lead of [background+' with','Create']) {
    const text=lead+' a red cat, a blue bird, and a green dog.';
    const result=await reader.propose(text);
    const expected=[['cat','red'],['bird','blue'],['dog','green']];
    const matching=result.candidates.filter(candidate=>{
      const wires=parse(candidate.sop);
      const targets=wires.filter(w=>w.type==='w.request.target');
      return JSON.stringify(targets.map(w=>[first(w,'sort'),first(wires.find(x=>
        x.type==='w.request.constraint' && first(x,'request')===first(w,'request') &&
        first(x,'attribute')==='drawn.colour') ?? {attrs:{}},'value')]))===JSON.stringify(expected);
    });
    assert.ok(matching.length,text);
    const wires=parse(matching[0].sop);
    const requests=wires.filter(w=>w.type==='w.request.request');
    assert.deepEqual(requests.map(w=>first(w,'act')),['make','make','make']);
    assert.deepEqual(requests.map(w=>first(w,'predicate')),[lead==='Create' ? 'Create' : undefined,undefined,undefined]);
    if (lead!=='Create') {
      const carried=wires.find(w=>w.type==='w.request.unread' && first(w,'text')===background);
      assert.ok(carried);
      assert.equal(first(carried,'request'),'$'+requests[0].id);
      assert.ok(first(requests[0],'words').startsWith(background));
    }
  }
});

test('a grounded first object keeps its owned complements and quoted lists stay literal',async t=>{
  const reader=createReader(model);
  t.after(()=>reader.close());
  for (const text of [
    'A house with a red cat, a blue bird, and a green dog.',
    'Create a house marked "a red cat, a blue bird, and a green dog".',
  ]) {
    const result=await reader.propose(text);
    assert.ok(result.candidates.every(candidate=>candidate.source!=='enumeration'),text);
  }
});
