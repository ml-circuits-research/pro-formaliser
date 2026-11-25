import assert from 'node:assert/strict';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';
import {createReader} from '../src/runtime.mjs';
import {loadWorlds} from '../src/worlds.mjs';
import {catalogIssues} from '../src/catalog.mjs';
import {parse,validate} from '../src/schema.mjs';
import {participantAdjunctReadings} from '../src/participant-adjunct.mjs';

const path=fileURLToPath(new URL('../sop-worlds/participant-adjunct-pilot',import.meta.url));
const inventory=fileURLToPath(new URL('../sop-worlds/drawable-inventory-pilot',import.meta.url));
const one=(wire,key)=>{
  const value=wire.attrs[key]?.[0];
  return value?.startsWith('"') ? JSON.parse(value) : value;
};
const values=wires=>Object.fromEntries(wires.filter(wire=>wire.type==='w.request.constraint')
  .map(wire=>[one(wire,'attribute'),one(wire,'value')]));

async function reading(reader,worlds,text,expected) {
  const {candidates}=await reader.propose(text,{evidence:true});
  const result=candidates.find(candidate=>{
    if (candidate.source!=='participant-adjunct') return false;
    const properties=values(parse(candidate.sop));
    return Object.entries(expected).every(([key,value])=>properties[key]===value);
  });
  assert.ok(result,text);
  const wires=parse(result.sop);
  assert.ok(validate(result.sop,worlds));
  assert.deepEqual(catalogIssues(wires,worlds),[]);
  assert.deepEqual(result.evidence.missing,[]);
  assert.equal(wires.filter(wire=>wire.type==='w.request.request').length,1);
  assert.equal(wires.filter(wire=>wire.type==='w.request.target').length,1);
  return wires;
}

test('attaches a written participial participant and preserves the creation and relative destination',async t=>{
  const worlds=loadWorlds({paths:[path,inventory]});
  const reader=createReader(undefined,worlds);
  t.after(()=>reader.close());
  const wires=await reading(reader,worlds,'Draw a woman there, carrying a picnic basket.',{
    'drawn.holds':'a picnic basket','drawn.deicticDestination':'there'
  });
  const target=wires.find(wire=>wire.type==='w.request.target');
  assert.equal(one(target,'sort'),'woman');
  assert.equal(one(target,'mode'),'new');
  assert.equal(one(wires.find(wire=>one(wire,'attribute')==='drawn.holds'),'key_words'),'carrying');
  await reading(reader,worlds,'Draw a boy, holding a paper lantern.',{'drawn.holds':'a paper lantern'});
  await reading(reader,worlds,'Draw a girl, wearing a silver necklace.',{'drawn.wear':'a silver necklace'});
  const [enriched]=await participantAdjunctReadings('Put a tall woman there, carrying a picnic basket.',worlds,
    async body=>{
      assert.equal(body,'Put a tall woman');
      return [{sop:[
        '@r w.request.request act=make mood=do predicate=Put',
        '@t w.request.target request=$r family=drawn mode=new sort=woman',
        '@c w.request.constraint request=$r on=attribute attribute=drawn.size value=tall operator=eq phase=result'
      ].join('\n')}];
    },()=>true);
  assert.equal(values(parse(enriched.sop))['drawn.size'],'tall');
});

test('keeps coordinated, negative and quoted material outside the participant binding',async t=>{
  const reader=createReader(undefined,loadWorlds({paths:[path,inventory]}));
  t.after(()=>reader.close());
  for (const text of [
    'Do not draw a boy, holding a paper lantern.',
    'Draw a boy, not holding a paper lantern.',
    'Draw a boy, holding a paper lantern and add a kite.',
    'Draw a boy, holding a paper lantern on the left.',
    'Write "Draw a boy, holding a paper lantern."'
  ]) {
    const {candidates}=await reader.propose(text);
    assert.ok(candidates.every(candidate=>candidate.source!=='participant-adjunct'),text);
  }
});
