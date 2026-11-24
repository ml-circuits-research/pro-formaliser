import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createReader} from '../src/runtime.mjs';
import {parse} from '../src/schema.mjs';

test('an indefinite nominal can propose creation with its stated properties and landmark',async t=>{
  const model={version:1,examples:[],templates:[],lexicon:{
    lantern:[['target','make','drawn','new','lantern',10]],
    pier:[['target','make','drawn','new','pier',10]]
  }};
  const reader=createReader(model);
  t.after(()=>reader.close());
  const read=async text=>(await reader.propose(text)).candidates.filter(c=>c.source==='nominal-creation');
  const options=await read('a tiny lantern behind the pier');
  assert.ok(options.some(c=>{
    const wires=parse(c.sop);
    return !wires.find(w=>w.type==='w.request.request').attrs.predicate &&
      ['tiny','behind','the pier'].every(value=>wires.some(w=>w.type==='w.request.constraint' &&
        w.attrs.value?.some(raw=>raw===value || raw===JSON.stringify(value))));
  }));
  for(const text of ['the lantern behind the pier','a lantern is behind the pier','a lantern behind the pier?',
    'a lantern shatters','a lantern if the pier is open','a lantern and delete the pier']) {
    assert.equal((await read(text)).length,0,text);
  }
});
