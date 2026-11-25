import assert from 'node:assert/strict';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';
import {createReader} from '../src/runtime.mjs';
import {parse} from '../src/schema.mjs';
import {loadWorlds} from '../src/worlds.mjs';

const pilot=fileURLToPath(new URL('../sop-worlds/measured-motion-pilot',import.meta.url));
const inventory=fileURLToPath(new URL('../sop-worlds/drawable-inventory-pilot',import.meta.url));
const facts=(sop,type)=>parse(sop).filter(wire=>wire.type==='w.request.'+type).map(wire=>Object.fromEntries(
  Object.entries(wire.attrs).map(([key,[value]])=>[key,value.startsWith('"') ? JSON.parse(value) : value])));

test('separates displacement, direction, units and explicit precision',async t=>{
  const reader=createReader(undefined,loadWorlds({paths:[pilot]}));
  t.after(()=>reader.close());
  for (const [text,sort,number,unit,direction,precision] of [
    ['Move the boat three inches left','boat','3','inch','left',undefined],
    ['Move the house 2.5 pixels up','house','2.5','pixel','up',undefined],
    ['Could you move the boat right by half a space exactly?','boat','0.5','space','right','exact'],
    ['Could you push it left by about three pixels?',undefined,'3','pixel','left','approximate'],
  ]) {
    const {candidates}=await reader.propose(text);
    const proposal=candidates.find(c=>c.source==='measured-motion');
    assert.ok(proposal,text);
    assert.deepEqual(facts(proposal.sop,'unread'),[]);
    const [target]=facts(proposal.sop,'target');
    assert.deepEqual([target.sort,target.fill],[sort,sort ? 'description' : 'context']);
    const [amount,axis,qualifier]=facts(proposal.sop,'constraint');
    assert.deepEqual([amount.attribute,amount.operator,amount.measure,amount.unit],
      ['drawn.displacement','delta',number,unit]);
    assert.equal(axis.value,direction);
    assert.equal(qualifier?.value,precision);
  }
});

test('creates a described object a measured distance from the written boundary',async t=>{
  const reader=createReader(undefined,loadWorlds({paths:[pilot,inventory]}));
  t.after(()=>reader.close());
  const text='Could you place a small boat about half an inch from the top edge?';
  const {candidates}=await reader.propose(text);
  const proposal=candidates.find(c=>c.source==='measured-motion');
  assert.ok(proposal,text);
  assert.equal(facts(proposal.sop,'request')[0].act,'make');
  assert.equal(facts(proposal.sop,'target')[0].sort,'boat');
  const properties=new Map(facts(proposal.sop,'constraint').map(wire=>[wire.attribute,wire]));
  assert.equal(properties.get('drawn.size').value,'small');
  assert.deepEqual([properties.get('drawn.offset').measure,properties.get('drawn.offset').unit],['0.5','inch']);
  assert.equal(properties.get('drawn.near').value,'the top edge');
  assert.equal(properties.get('drawn.distance_precision').value,'approximate');
});

test('retains the selector when an existing object moves a measured distance',async t=>{
  const reader=createReader(undefined,loadWorlds({paths:[pilot]}));
  t.after(()=>reader.close());
  const {candidates}=await reader.propose('Move the boy in red half a space right');
  const proposal=candidates.find(c=>c.source==='measured-motion' && c.sop.includes('subject.property'));
  assert.ok(proposal);
  assert.deepEqual(facts(proposal.sop,'constraint').map(w=>[w.attribute,w.phase,w.value,w.measure]),[
    ['drawn.colour','selector','red',undefined],
    ['drawn.displacement','result','half a space','0.5'],
    ['drawn.direction','result','right',undefined],
  ]);
});

test('keeps measured motion opt-in and requires a complete written amount and scope',async t=>{
  const plain=createReader();
  const staged=createReader(undefined,loadWorlds({paths:[pilot]}));
  t.after(()=>Promise.all([plain.close(),staged.close()]));
  const includes=async (reader,text)=>(await reader.propose(text)).candidates.some(c=>c.source==='measured-motion');
  assert.equal(await includes(plain,'Move the boat three inches left'),false);
  for (const text of [
    'Move the boat back two spaces',
    'Move the boat three mugs left',
    'Move the boat -2 inches left',
    'Move the boat three inches left and down',
    'Did you move the boat three inches left?',
    'Do not move the boat three inches left',
    'If ready, move the boat three inches left',
    'Move the boat three inches from the dock',
  ]) assert.equal(await includes(staged,text),false,text);
});
