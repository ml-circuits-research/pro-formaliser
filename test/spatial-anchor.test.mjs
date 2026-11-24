import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createReader} from '../src/runtime.mjs';
import {parse} from '../src/schema.mjs';
import {loadWorlds} from '../src/worlds.mjs';

const model={version:1,templates:[],examples:[],lexicon:{
  put:[['act','make','do',8]],
  seal:[['target','make','drawn','new','seal',8]],
  road:[['target','make','drawn','new','road',8]],
  barn:[['target','make','drawn','new','barn',8]],
  iris:[['target','make','drawn','new','iris',8]],
  'tree frog':[['target','make','drawn','new','tree frog',8]],
  box:[['target','make','node','new','box',8]],
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

test('scopes landmark side aliases to a typed placement and preserves other readings',async t=>{
  const worlds=loadWorlds({paths:[]});
  const reader=createReader(model,worlds), baseline=createReader(model,{...worlds,landmarkSurfaceFacts:[]});
  t.after(()=>Promise.all([reader.close(),baseline.close()]));
  for(const [text,key,marker,relative,landmark] of [
    ['Please put an iris on the left side of the house, please','drawn.relation','on the left side of','left_of','the house'],
    ['Put a tree frog on the left side of that mountain','drawn.relation','on the left side of','left_of','that mountain'],
    ['Add a box to the right side of that node','node.position','to the right side of','right_of','that node'],
  ]) {
    const {candidates}=await reader.propose(text,{evidence:true});
    const relativeReading=candidates.find(c=>{
      if(c.source!=='spatial-anchor')return false;
      const wires=parse(c.sop);
      const relation=wires.find(w=>field(w,'attribute')===key && field(w,'value')===relative && field(w,'words')===marker);
      const anchor=wires.find(w=>field(w,'attribute')===key.split('.')[0]+'.anchor' && field(w,'value')===landmark);
      return relation && anchor && field(relation,'request')===field(anchor,'request') &&
        wires.some(w=>field(w,'constraint')==='$'+anchor.id && field(w,'from')==='page');
    });
    assert.ok(relativeReading,text);
    assert.deepEqual(relativeReading.evidence.missing,[]);
    const old=await baseline.propose(text);
    assert.ok(old.candidates.every(c=>candidates.some(next=>c.sop===next.sop)),text);
  }
  for(const text of ['Paint the left side of the door red','Draw a seal on the left side of the canvas',
      'Draw a seal on the right side of the page','Draw a seal on the left side of that quillswirl',
      'Do not draw a seal to the left side of the house']) {
    const {candidates}=await reader.propose(text), old=await baseline.propose(text);
    assert.deepEqual(candidates.map(c=>c.sop),old.candidates.map(c=>c.sop),text);
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

test('a written proper name can supply the lookup for a spatial landmark',async t=>{
  const reader=createReader(model);t.after(()=>reader.close());
  const {candidates}=await reader.propose('Draw a seal above North Pier');
  assert.ok(anchors(candidates.filter(c=>c.source==='spatial-anchor'),'North Pier').some(({same,anchor})=>
    same.some(w=>field(w,'attribute')==='drawn.relation' && field(w,'value')==='above') &&
    same.some(w=>field(w,'constraint')==='$'+anchor.id && field(w,'from')==='page')));
  for (const text of ['Draw a seal above north pier','Draw a seal above North and Pier',
      'Do not draw a seal above North Pier','Draw a seal under North beside Pier']) {
    assert.equal((await reader.propose(text)).candidates.some(c=>c.source==='spatial-anchor'),false,text);
  }
});
