import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createReader} from '../src/runtime.mjs';
import {parse} from '../src/schema.mjs';

const model={version:1,templates:[],examples:[],lexicon:{
  seal:[['target','make','drawn','new','seal',8]],
  road:[['target','make','drawn','new','road',8]],
  barn:[['target','make','drawn','new','barn',8]]
}};
const decode=raw=>raw?.startsWith('"') ? JSON.parse(raw) : raw;
const field=(wire,key)=>decode(wire.attrs[key]?.[0]);

function anchors(candidates,label) {
  return candidates.flatMap(({sop})=>{
    const wires=parse(sop);
    const anchor=wires.find(w=>field(w,'attribute')==='drawn.anchor' && field(w,'value')===label);
    if (!anchor) return [];
    const ref=field(anchor,'request');
    const same=wires.filter(w=>field(w,'request')===ref);
    return [{same,anchor}];
  });
}

test('grounds a complete definite anchor on the local relation while retaining an aside',async t=>{
  const reader=createReader(model);t.after(()=>reader.close());
  for(const [text,anchor,aside] of [
    ['Draw a seal along the damp gravel road','the damp gravel road',undefined],
    ['Draw a seal along the damp gravel road, so it does not reach the barn','the damp gravel road','so it does not reach the barn']
  ]) {
    const {candidates}=await reader.propose(text);
    const complete=anchors(candidates.filter(c=>c.source==='spatial-anchor'),anchor);
    assert.ok(complete.some(({same,anchor})=>same.some(w=>field(w,'sort')==='seal' && field(w,'mode')==='new') &&
      same.some(w=>field(w,'attribute')==='drawn.relation' && field(w,'value')==='along' && field(w,'phase')==='result') &&
      same.some(w=>field(w,'constraint')==='$'+anchor.id && field(w,'from')==='page') &&
      (!aside || same.some(w=>field(w,'text')?.includes(aside)))),text);
    assert.ok(candidates.some(c=>c.source!=='spatial-anchor'));
  }
});

test('does not invent a landmark or reuse a quoted, conditional or ambiguous scope',async t=>{
  const reader=createReader(model);t.after(()=>reader.close());
  for(const text of [
    'Draw a seal along the imaginary quillswirl',
    'Draw a seal along the road and near the barn',
    'Draw a seal in the far right part',
    'Draw a seal along “the damp gravel road”',
    'If ready draw a seal along the damp gravel road',
    'Do not draw a seal along the damp gravel road',
    'Draw a seal along the road beside the barn',
    'Draw a seal along the road facing the barn',
    'The seal along the road must watch the barn'
  ]) {
    const {candidates}=await reader.propose(text);
    assert.ok(candidates.every(c=>c.source!=='spatial-anchor'),text);
  }
});
