import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createReader } from '../src/runtime.mjs';
import { parse, validate } from '../src/schema.mjs';
import { loadWorlds } from '../src/worlds.mjs';
import { serialize } from '../.cache/knowledge/tools/sopworld/sopworld.mjs';

const get=(wire,key)=>{
  const raw=wire?.attrs[key]?.[0];
  return raw?.startsWith('"') ? JSON.parse(raw) : raw;
};
const enriched=result=>result.candidates.filter(candidate=>candidate.source==='source-container');
const type='w.relational.source_scope';
const modulePath=fileURLToPath(new URL('../sop-worlds/w.relational/',import.meta.url));
const sourceWorlds=()=>loadWorlds({paths:[modulePath]});

test('binds an explicitly stated current source separately from the affected target',async t=>{
  const worlds=sourceWorlds();
  const reader=createReader(undefined,worlds); t.after(()=>reader.close());
  for (const [text,target,container,label,exclude] of [
    ['Remove the shape from the canvas','drawn','page','the canvas'],
    ['Remove the paragraph from the document','paragraph','document','the document'],
    ['Remove every single shape from the scene but keep the ones beside the shape',
      'drawn','page','the scene',true],
  ]) {
    const result=await reader.propose(text,{evidence:true});
    assert.ok(enriched(result).some(candidate=>{
      const wires=parse(candidate.sop);
      const targets=wires.filter(w=>w.type==='w.request.target');
      const [object]=targets;
      const source=wires.find(w=>w.type===type);
      const request=wires.find(w=>w.type==='w.request.request' && get(w,'act')==='remove');
      return targets.length===1 && get(object,'family')===target && request && source &&
        get(object,'request')==='$'+request.id && get(source,'request')==='$'+request.id &&
        get(source,'affected')==='$'+object.id && get(source,'lookup')==='page' &&
        get(source,'container_family')===container && get(source,'container_words')===label &&
        get(source,'words')==='from '+label && validate(candidate.sop,worlds) &&
        !wires.some(w=>w.type==='w.request.unread' && get(w,'text')?.includes('from '+label)) &&
        (!exclude || get(object,'fill')==='all' && wires.some(w=>get(w,'want')==='no' && get(w,'phase')==='selector')) &&
        !candidate.evidence.missing.length;
    }),text);
    assert.ok(result.candidates.some(candidate=>candidate.source!=='source-container'),text);
  }
});

test('resolves the typed links by reference after renaming and reversing wires',async t=>{
  const worlds=sourceWorlds();
  const reader=createReader(undefined,worlds); t.after(()=>reader.close());
  const [candidate]=enriched(await reader.propose('Remove the paragraph from the document'));
  assert.ok(candidate);
  const wires=parse(candidate.sop);
  const ids=new Map(wires.map((wire,i)=>[wire.id,'renamed'+i]));
  const reordered=wires.map(wire=>({...wire,id:ids.get(wire.id),attrs:Object.fromEntries(
    Object.entries(wire.attrs).map(([key,values])=>[key,values.map(raw=>
      raw.startsWith('$') && ids.has(raw.slice(1)) ? '$'+ids.get(raw.slice(1)) : raw)]))})).reverse();
  const sop=serialize(reordered);
  assert.ok(validate(sop,worlds));
  const read=parse(sop);
  const [affected]=read.filter(wire=>wire.type==='w.request.target');
  const [source]=read.filter(wire=>wire.type===type);
  assert.equal(read.filter(wire=>wire.type==='w.request.target').length,1);
  assert.equal(get(source,'affected'),'$'+affected.id);
  assert.equal(get(source,'request'),get(affected,'request'));
  const wrongOwner=sop.replace('request='+get(source,'request')+' affected=', 'request=$another affected=')+
    '\n@another w.request.request act=remove mood=do';
  assert.ok(!validate(wrongOwner,worlds));
  assert.ok(!validate(sop.replace('affected=$'+affected.id,'affected='+get(affected,'request')),worlds));
});

test('keeps the unread source when the extension is absent',async t=>{
  const reader=createReader(undefined,loadWorlds({paths:[]})); t.after(()=>reader.close());
  const result=await reader.propose('Remove the paragraph from the document');
  assert.deepEqual(enriched(result),[]);
  assert.ok(result.candidates.every(candidate=>!candidate.sop.includes(type)));
  assert.ok(result.candidates.some(candidate=>{
    const wires=parse(candidate.sop);
    const targets=wires.filter(wire=>wire.type==='w.request.target');
    return targets.length===1 && get(targets[0],'family')==='paragraph' &&
      wires.some(wire=>wire.type==='w.request.unread' && get(wire,'text')==='from the document');
  }));
});

test('leaves named, indefinite, quoted and non-source containers in their original roles',async t=>{
  const reader=createReader(undefined,sourceWorlds()); t.after(()=>reader.close());
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
