import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createReader} from '../src/runtime.mjs';
import {parse} from '../src/schema.mjs';

const field=(w,key)=>{
  const value=w.attrs[key]?.[0];
  return value?.startsWith('"') ? JSON.parse(value) : value;
};
const model={version:1,examples:[],templates:[],lexicon:{
  seal:[['target','make','drawn','new','seal',10]],
  lighthouse:[['target','make','drawn','new','lighthouse',10]],
}};

function properties({candidates}) {
  return candidates.flatMap(({sop})=>{
    const wires=parse(sop), target=wires.find(w=>w.type==='w.request.target' &&
      field(w,'mode')==='new' && field(w,'sort')==='seal');
    if (!target) return [];
    const owned=wires.filter(w=>w.type==='w.request.constraint' && field(w,'request')===field(target,'request'));
    return [new Map(owned.map(w=>[field(w,'attribute'),field(w,'value')]))];
  });
}

test('keeps the shorter spatial attachment when it also grounds a preceding property',async()=>{
  const reader=createReader(model);
  try {
    const alternatives=properties(await reader.propose('Draw a seal facing right next to the lighthouse.'));
    assert.ok(alternatives.some(p=>p.get('drawn.facing')==='right' && p.get('drawn.relation')==='near' &&
      p.get('drawn.anchor')==='the lighthouse'));
    assert.ok(alternatives.some(p=>p.get('drawn.relation')==='next_to' && p.get('drawn.anchor')==='the lighthouse'));
    const straightforward=properties(await reader.propose('Draw a seal right next to the lighthouse.'));
    assert.ok(straightforward.some(p=>p.get('drawn.relation')==='next_to'));
    assert.ok(straightforward.every(p=>!p.has('drawn.facing')));
  } finally {await reader.close();}
});
