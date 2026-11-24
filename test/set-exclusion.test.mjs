import assert from 'node:assert/strict';
import test from 'node:test';
import { createReader } from '../src/runtime.mjs';
import { parse } from '../src/schema.mjs';

const get=(wire,key)=>{
  const raw=wire?.attrs[key]?.[0];
  return raw?.startsWith('"') ? JSON.parse(raw) : raw;
};
const exclusions=result=>result.candidates.filter(candidate=>candidate.source==='set-exclusion');

test('subtracts a written spatial or property exception from a universal existing target',async t=>{
  const reader=createReader(); t.after(()=>reader.close());
  for (const [text,attribute,value,anchor,words,act='remove'] of [
    ['Remove every single box but keep the ones beside the shape',
      'node.position','near','the shape','but keep the ones beside the shape'],
    ['Delete all boxes except the red ones','node.colour','red',undefined,'except the red ones'],
    ['Copy all boxes except the red ones','node.colour','red',undefined,'except the red ones','copy'],
    ['Delete all boxes except those to the right of the shape',
      'node.position','right_of','the shape','except those to the right of the shape'],
  ]) {
    const result=await reader.propose(text,{evidence:true});
    const candidates=exclusions(result);
    assert.ok(candidates.length,text);
    assert.ok(candidates.some(c=>{
      const wires=parse(c.sop);
      const target=wires.find(w=>w.type==='w.request.target' && get(w,'family')==='node');
      const ref=get(target,'request');
      const request=wires.find(w=>w.type==='w.request.request' && '$'+w.id===ref);
      const related=wires.filter(w=>get(w,'request')===ref);
      const exclusion=related.find(w=>get(w,'attribute')===attribute && get(w,'value')===value &&
        get(w,'want')==='no' && get(w,'phase')==='selector' && get(w,'words')===words);
      const landmark=anchor && related.find(w=>get(w,'attribute')==='node.anchor' && get(w,'value')===anchor);
      return get(request,'act')===act && target && get(target,'fill')==='all' && get(target,'quantifier')==='all' &&
        exclusion && (!anchor || landmark && related.some(w=>get(w,'constraint')==='$'+landmark.id &&
          get(w,'from')==='page')) && !c.evidence.missing.length;
    }),text);
    assert.ok(result.candidates.some(c=>c.source!=='set-exclusion'),text);
  }
});

test('keeps conditions, separate preservation and competing anchors outside set exclusion',async t=>{
  const reader=createReader(); t.after(()=>reader.close());
  for (const text of [
    'Remove all boxes except the red ones if ready',
    'Remove all boxes except the ones under the shape unless ready',
    'Do not delete all boxes except the red ones',
    'Copy all boxes but keep the ones beside the shape',
    'Delete a box except the red ones',
    'Remove all boxes but keep all shapes',
    'Remove all boxes next to the shape except the ones above the box',
    'Delete all boxes except the red and blue ones',
    'Delete all boxes except all ones',
    'Remove all boxes except the ones behind the quillswirl',
  ]) assert.deepEqual(exclusions(await reader.propose(text)),[],text);
  const result=await reader.propose('Remove every single box');
  assert.ok(result.candidates.some(candidate=>parse(candidate.sop).some(w=>w.type==='w.request.target' &&
    get(w,'fill')==='all' && get(w,'count_words')==='every single box')));
});

test('binds a fronted exception to the following universal action',async t=>{
  const reader=createReader(); t.after(()=>reader.close());
  const text='Except for the blue nodes, copy all nodes.';
  const proofs=exclusions(await reader.propose(text,{evidence:true}));
  assert.ok(proofs.some(c=>{
    const wires=parse(c.sop), root=wires.find(w=>w.type==='w.request.request');
    const target=wires.find(w=>w.type==='w.request.target');
    return get(root,'act')==='copy' && get(target,'quantifier')==='all' &&
      wires.some(w=>get(w,'attribute')==='node.colour' && get(w,'value')==='blue' &&
        get(w,'phase')==='selector' && get(w,'want')==='no' &&
        get(w,'words')==='Except for the blue nodes') && !c.evidence.missing.length;
  }));
  for (const control of ['Except for the blue nodes, copy the node.',
    'Except for the blue nodes, do not copy all nodes.',
    'Except for the blue nodes, copy all houses.']) {
    assert.deepEqual(exclusions(await reader.propose(control)),[],control);
  }
});
