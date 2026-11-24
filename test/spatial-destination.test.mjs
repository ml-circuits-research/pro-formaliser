import assert from 'node:assert/strict';
import test from 'node:test';
import { createReader } from '../src/runtime.mjs';
import { parse } from '../src/schema.mjs';

const get=(wire,key)=>{
  const value=wire?.attrs[key]?.[0];
  return value?.startsWith('"') ? JSON.parse(value) : value;
};

function relations(result,act,anchor) {
  return result.candidates.flatMap(candidate=>{
    const wires=parse(candidate.sop);
    const request=wires.find(w=>w.type==='w.request.request' && get(w,'act')===act);
    if (!request) return [];
    const related=wires.filter(w=>get(w,'request')==='$'+request.id);
    const landmark=related.find(w=>['drawn.anchor','node.anchor'].includes(get(w,'attribute')) && get(w,'value')===anchor);
    const target=related.find(w=>w.type==='w.request.target');
    if (!landmark || !related.some(w=>get(w,'constraint')==='$'+landmark.id && get(w,'from')==='page')) return [];
    return related.filter(w=>['drawn.relation','node.position'].includes(get(w,'attribute')))
      .map(relation=>({candidate,relation,landmark,target}));
  });
}

test('grounds direct-pronoun placement destinations while retaining selectors',async t=>{
  const reader=createReader(); t.after(()=>reader.close());
  for (const [text,anchor,relation] of [
    ['And now place it just right of the box','the box','right_of'],
    ['Move them left of the shape','the shape','left_of'],
  ]) {
    const result=await reader.propose(text,{evidence:true});
    const readings=relations(result,'place',anchor);
    const destinations=readings.filter(r=>get(r.relation,'value')===relation && get(r.relation,'phase')==='result');
    assert.deepEqual(new Set(destinations.map(r=>get(r.target,'family'))),new Set(['drawn','node']),text);
    for (const reading of destinations) {
      assert.equal(get(reading.target,'fill'),'context',text);
      assert.equal(get(reading.landmark,'phase'),'selector',text);
      assert.deepEqual(reading.candidate.evidence.missing,[],text);
    }
    assert.ok(readings.some(r=>get(r.relation,'phase')==='selector'),text);
  }
  for (const [text,act] of [
    ['Remove it right of the box','remove'],
    ['Is it right of the box?','ask'],
  ]) {
    const readings=relations(await reader.propose(text),act,'the box');
    assert.ok(readings.length,text);
    assert.ok(readings.every(r=>get(r.relation,'phase')==='selector'),text);
  }
  const explicit=relations(await reader.propose('Move a node right of the box'),'place','the box');
  assert.ok(explicit.some(r=>get(r.target,'family_words')==='node' && get(r.relation,'phase')==='selector'));
});

test('a qualified direction binds proximity to the same landmark and phase',async t=>{
  const reader=createReader(); t.after(()=>reader.close());
  const text='Move them immediately left of the shape';
  const result=await reader.propose(text,{evidence:true});
  const readings=relations(result,'place','the shape').filter(r=>get(r.target,'family')==='node' &&
    get(r.relation,'phase')==='result' && get(r.relation,'value')==='left_of');
  assert.ok(readings.some(({candidate})=>parse(candidate.sop).some(w=>
    get(w,'attribute')==='node.position' && get(w,'phase')==='result' &&
    get(w,'value')==='near' && get(w,'words')==='immediately') && candidate.evidence.missing.length===0));
  assert.ok(readings.some(({candidate})=>!candidate.sop.includes('value=near')));
  for (const control of ['Just move them left of the shape','Move them left of the shape']) {
    const answer=await reader.propose(control);
    assert.ok(answer.candidates.every(c=>c.source!=='spatial-modifier'),control);
  }
});

test('grounds a preposed destination and keeps all evidence in its original position',async t=>{
  const reader=createReader(); t.after(()=>reader.close());
  const text='Immediately left of the shape, move them.';
  const readings=relations(await reader.propose(text,{evidence:true}),'place','the shape');
  const matches=readings.filter(({candidate,relation,target})=>get(relation,'phase')==='result' &&
    get(relation,'value')==='left_of' && get(target,'fill')==='context' &&
    parse(candidate.sop).some(w=>get(w,'value')==='near' && get(w,'words')==='Immediately'));
  assert.deepEqual(new Set(matches.map(r=>get(r.target,'family'))),new Set(['drawn','node']));
  for (const {candidate} of matches) assert.deepEqual(candidate.evidence.missing,[]);
  for (const control of ['Left of the shape, remove them.','If left of the shape, move them.',
    'Left of the shape, do not move them.','Left of the shape, move them below the box.',
    'Left of the shape or the box, move them.']) {
    const result=await reader.propose(control);
    assert.ok(result.candidates.every(c=>c.source!=='fronted-destination'),control);
  }
});
