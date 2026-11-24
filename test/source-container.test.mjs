import assert from 'node:assert/strict';
import test from 'node:test';
import { createReader } from '../src/runtime.mjs';
import { parse } from '../src/schema.mjs';

const get=(wire,key)=>{
  const raw=wire?.attrs[key]?.[0];
  return raw?.startsWith('"') ? JSON.parse(raw) : raw;
};
const enriched=result=>result.candidates.filter(candidate=>candidate.source==='source-container');

test('binds an explicitly stated current source separately from the affected target',async t=>{
  const reader=createReader(); t.after(()=>reader.close());
  for (const [text,target,container,label,exclude] of [
    ['Remove the shape from the canvas','drawn','page','the canvas'],
    ['Remove the paragraph from the document','paragraph','document','the document'],
    ['Remove every single shape from the scene but keep the ones beside the shape',
      'drawn','page','the scene',true],
  ]) {
    const result=await reader.propose(text,{evidence:true});
    assert.ok(enriched(result).some(candidate=>{
      const wires=parse(candidate.sop);
      const object=wires.find(w=>w.type==='w.request.target' && get(w,'family')===target);
      const source=wires.find(w=>w.type==='w.request.target' && get(w,'family')===container);
      const request=wires.find(w=>w.type==='w.request.request' && get(w,'act')==='remove');
      return request && object && source && get(object,'request')==='$'+request.id &&
        get(source,'request')==='$'+request.id && get(source,'fill')==='context' &&
        get(source,'family_words')===label && get(source,'name')===undefined &&
        wires.some(w=>get(w,'target')==='$'+source.id && get(w,'from')==='page') &&
        !wires.some(w=>w.type==='w.request.unread' && get(w,'text')?.includes('from '+label)) &&
        (!exclude || get(object,'fill')==='all' && wires.some(w=>get(w,'want')==='no' && get(w,'phase')==='selector')) &&
        !candidate.evidence.missing.length;
    }),text);
    assert.ok(result.candidates.some(candidate=>candidate.source!=='source-container'),text);
  }
});

test('leaves named, indefinite, quoted and non-source containers in their original roles',async t=>{
  const reader=createReader(); t.after(()=>reader.close());
  for (const text of [
    'Remove the paragraph from the document Annual Report',
    'Remove the shape from a canvas',
    'Remove the shape "from the canvas"',
    'Remove the shape from the box',
    'Make a shape from the canvas',
    'Is the shape from the canvas?',
    'Remove it from the document called Annual Report',
  ]) assert.deepEqual(enriched(await reader.propose(text)),[],text);
});
