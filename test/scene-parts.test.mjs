import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { createReader } from '../src/runtime.mjs';
import { parse } from '../src/schema.mjs';
import { loadWorlds } from '../src/worlds.mjs';
import { createSceneConstructLearner } from '../src/scene-constructs.mjs';

const decode=value=>value?.startsWith('"') ? JSON.parse(value) : value;
const first=(wire,key)=>decode(wire.attrs[key]?.[0]);
const kinds=['cat','bird','dog','house','scarf'];
const model={version:1,examples:[],templates:[],lexicon:Object.fromEntries(kinds.map(kind=>
  [kind,[['target','make','drawn','new',kind,100]]]))};

test('scene objects keep their colours and the background remains in the source scope',async t=>{
  const reader=createReader(model);
  t.after(()=>reader.close());
  const background='A moonlit meadow in the evening';
  for (const lead of [background+' with','Create']) {
    const text=lead+' a red cat, a blue bird, and a green dog.';
    const result=await reader.propose(text);
    const expected=[['cat','red'],['bird','blue'],['dog','green']];
    const matching=result.candidates.filter(candidate=>{
      const wires=parse(candidate.sop);
      const targets=wires.filter(w=>w.type==='w.request.target');
      return JSON.stringify(targets.map(w=>[first(w,'sort'),first(wires.find(x=>
        x.type==='w.request.constraint' && first(x,'request')===first(w,'request') &&
        first(x,'attribute')==='drawn.colour') ?? {attrs:{}},'value')]))===JSON.stringify(expected);
    });
    assert.ok(matching.length,text);
    const wires=parse(matching[0].sop);
    const requests=wires.filter(w=>w.type==='w.request.request');
    assert.deepEqual(requests.map(w=>first(w,'act')),['make','make','make']);
    assert.deepEqual(requests.map(w=>first(w,'predicate')),[lead==='Create' ? 'Create' : undefined,undefined,undefined]);
    if (lead!=='Create') {
      const carried=wires.find(w=>w.type==='w.request.unread' && first(w,'text')===background);
      assert.ok(carried);
      assert.equal(first(carried,'request'),'$'+requests[0].id);
      assert.ok(first(requests[0],'words').startsWith(background));
    }
  }
});

test('a grounded first object keeps its owned complements and quoted lists stay literal',async t=>{
  const reader=createReader(model);
  t.after(()=>reader.close());
  for (const text of [
    'A house with a red cat, a blue bird, and a green dog.',
    'Create a house marked "a red cat, a blue bird, and a green dog".',
  ]) {
    const result=await reader.propose(text);
    assert.ok(result.candidates.every(candidate=>candidate.source!=='enumeration'),text);
  }
});

test('a context-only scene header requires corroborated local training evidence',async t=>{
  const dir=mkdtempSync(join(fileURLToPath(new URL('../.cache/',import.meta.url)),'scene-header-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const overlay=join(dir,'gallery.sop');
  writeFileSync(overlay,`
@gallery.location w.request.key family=gallery name=gallery.location head=span
@gallery.light w.request.key family=gallery name=gallery.light head=class value=dusk value=noon
@gallery.plaque pro.reader.target family=artifact sort=plaque text=plaque act=make
@gallery.lantern pro.reader.target family=artifact sort=lantern text=lantern act=make
`);
  const worlds=loadWorlds({paths:[overlay]});
  const header='An atrium at dusk';
  function example(prefix,object,light='dusk',place='atrium') {
    const subject=place==='atrium' ? header : 'A '+place+' at dusk';
    const written=(prefix ? prefix+' ' : '')+subject;
    return {text:written+' with a '+object,sop:[
      '@r w.request.request act=change mood=do words='+JSON.stringify(written)+(prefix ? ' predicate='+prefix : ''),
      '@t w.request.target request=$r family=gallery mode=existing fill=context',
      '@l w.request.lookup request=$r target=$t key=thing from=page',
      '@g w.request.constraint request=$r on=attribute attribute=gallery.location value='+place,
      '@h w.request.constraint request=$r on=attribute attribute=gallery.light value='+light,
      '@r2 w.request.request act=make mood=do words="a '+object+'"',
      '@t2 w.request.target request=$r2 family=artifact mode=new sort='+object,
    ].join('\n')};
  }
  const text=header+' with a plaque, and a lantern.';
  const run=async examples=>{
    const reader=createReader({...model,examples},worlds);
    try { return (await reader.propose(text)).candidates; }
    finally { await reader.close(); }
  };
  const standalone=example('', 'plaque');
  for (const training of [
    [standalone],
    [standalone,example('Draw','plaque')],
    [standalone,example('Draw','lantern','noon')],
    [example('Draw','plaque'),example('Make','lantern')],
  ]) {
    assert.ok((await run(training)).every(c=>!c.sop.includes('attribute=gallery.light')));
  }
  const candidates=await run([standalone,example('Draw','lantern')]);
  const complete=candidates.find(c=>c.sop.includes('attribute=gallery.light'));
  assert.ok(complete);
  const wires=parse(complete.sop);
  const requests=wires.filter(w=>w.type==='w.request.request');
  assert.deepEqual(requests.map(w=>first(w,'act')),['change','make','make']);
  assert.equal(first(requests[0],'words'),header);
  assert.equal(first(requests[0],'predicate'),undefined);
  assert.deepEqual(wires.filter(w=>first(w,'request')==='$'+requests[0].id).filter(w=>w.type==='w.request.constraint')
    .map(w=>first(w,'value')),['atrium','dusk']);
  assert.ok(candidates.some(c=>c.sop.includes('@scene.setting')));
  const corroborated=await run([
    example('Draw','plaque'),example('Make','lantern'),example('', 'plaque','dusk','courtyard'),
  ]);
  assert.ok(corroborated.some(c=>c.sop.includes('attribute=gallery.location value=atrium')));
  assert.ok(corroborated.every(c=>!c.sop.includes('value=courtyard')));
});

test('learned scene constructors separate setting and list after a display-shaped wrapper',async()=>{
  const worlds=loadWorlds();
  const ctor=createSceneConstructLearner(worlds);
  const scope=subject=>'Show me a '+subject+' scene at dusk';
  function observe(subject,kinds) {
    const words=scope(subject);
    const parts=kinds.map(kind=>'a '+kind);
    ctor.observe(words+': '+parts.join(', '),parse([
      '@r w.request.request act=change mood=do words='+JSON.stringify(words)+' predicate=Show',
      '@t w.request.target request=$r family=page mode=existing fill=context',
      '@c w.request.constraint request=$r on=attribute attribute=page.scene value='+subject,
      ...parts.flatMap((part,i)=>[
        '@r'+i+' w.request.request act=make mood=do words='+JSON.stringify(part),
        '@t'+i+' w.request.target request=$r'+i+' family=drawn mode=new sort='+kinds[i],
      ]),
    ].join('\n')));
  }
  observe('garden',['cat','bird']);
  assert.deepEqual(ctor.finish(),[]);
  observe('garden',['cat','dog']);
  const sceneConstructs=ctor.finish();
  const reader=createReader({...model,sceneConstructs},worlds);
  try {
    const text='Show me a garden scene at noon: a bird, and a dog.';
    const answer=await reader.propose(text);
    const complete=answer.candidates.find(c=>c.sop.includes('@scene.setting')&&c.sop.includes('sort=bird')&&c.sop.includes('sort=dog'));
    assert.ok(complete);
    assert.doesNotMatch(complete.sop,/sort=garden/);
    assert.match(complete.sop,/text="Show me a garden scene at noon"/);
    const questions=await reader.propose('Show me a garden scene at noon: a bird, and a dog?');
    assert.ok(questions.candidates.every(c=>!c.sop.includes('@scene.setting')));
  } finally { await reader.close(); }
});

test('a trailing list separator has no following predicate',async t=>{
  const reader=createReader(model);
  t.after(()=>reader.close());
  const result=await reader.propose('Create a cat, a dog,');
  assert.ok(result.candidates.some(({sop})=>{
    const targets=parse(sop).filter(w=>w.type==='w.request.target');
    return targets.some(w=>first(w,'sort')==='cat') && targets.some(w=>first(w,'sort')==='dog');
  }));
});

test('a learned change property does not block a counted noun in a creation list',async t=>{
  const reader=createReader({...model,lexicon:{...model.lexicon,
    folios:[
      ['target','make','drawn','new','folio',30],
      ['constraint','change','drawn','on=attribute attribute=drawn.label value=FOLIOS operator=eq phase=result',25],
    ],
  }});
  t.after(()=>reader.close());
  const result=await reader.propose('Create a red cat, two blue folios, and a green dog.');
  assert.ok(result.candidates.some(candidate=>{
    const targets=parse(candidate.sop).filter(wire=>wire.type==='w.request.target');
    return targets.map(wire=>first(wire,'sort')).join(',')==='cat,folio,dog';
  }));
});

test('a location between list members can describe either neighbour',async t=>{
  const reader=createReader(model); t.after(()=>reader.close());
  const text='Create a red cat, a blue bird, near the house, a green dog.';
  const {candidates}=await reader.propose(text,{evidence:true});
  const owners=new Set();
  for (const c of candidates) {
    const wires=parse(c.sop);
    if (wires.filter(w=>w.type==='w.request.target').length!==3 || c.evidence.missing.length) continue;
    const anchor=wires.find(w=>first(w,'attribute')==='drawn.anchor' && first(w,'value')==='the house');
    if (!anchor) continue;
    const target=wires.find(w=>w.type==='w.request.target' && first(w,'request')===first(anchor,'request'));
    if (target) owners.add(first(target,'sort'));
  }
  assert.ok(owners.has('bird'));
  assert.ok(owners.has('dog'));
});
