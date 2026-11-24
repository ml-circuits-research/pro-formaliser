import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {tokens} from '../src/lexicon.mjs';
import {quotedSpans} from '../src/literal-roles.mjs';
import {parse} from '../src/schema.mjs';
import {createReader} from '../src/runtime.mjs';
import {loadWorlds} from '../src/worlds.mjs';
import {compileTransformations,transformationReadings} from '../src/transformation.mjs';

const worlds=loadWorlds();
const facts=parse(readFileSync(new URL('../resources/pro.reader/transformation.sop',import.meta.url),'utf8')+
  '\n@house k.objects.object name=house\n@boat k.objects.object name=boat\n'+
  '@brick k.styles.material name=brick\n@glass k.styles.material name=glass\n'+
  '@red_brick core.word text="red brick" means=brick of=k.styles.material.name');
const transformations=compileTransformations(type=>facts.filter(wire=>wire.type===type),worlds.requestKeys,
  facts.filter(wire=>wire.type==='core.word'));

function read(text) {
  return transformationReadings(text,tokens(text),quotedSpans(text),{...worlds,transformations});
}

const data=(candidate,type)=>parse(candidate.sop).filter(wire=>wire.type==='w.request.'+type)
  .map(wire=>Object.fromEntries(Object.entries(wire.attrs).map(([key,[value]])=>
    [key,value.startsWith('"') ? JSON.parse(value) : value])));

test('grounds a full art style on the page referenced by a whole-drawing nominal',()=>{
  const text='render the whole drawing as a dark gothic painting';
  const [candidate]=read(text);
  const [target]=data(candidate,'target'),[property]=data(candidate,'constraint');
  assert.deepEqual([target.family,target.fill,target.family_words],['page','context','the whole drawing']);
  assert.deepEqual([property.attribute,property.value,property.words,property.phase],
    ['page.style','dark gothic painting','a dark gothic painting','result']);
  assert.equal(data(candidate,'lookup')[0].from,'page');
  assert.equal(candidate.status,'matched');
});

test('grounds native material and preserves a remaining modifier without guessing a texture',()=>{
  const [candidate]=read('coat the whole house in rough red brick');
  const [target]=data(candidate,'target'),[property]=data(candidate,'constraint');
  assert.deepEqual([target.family,target.sort,target.description],['drawn','house','the whole house']);
  assert.deepEqual([property.attribute,property.value,property.words],['drawn.material','brick','red brick']);
  assert.deepEqual(data(candidate,'unread').map(row=>row.text),['rough']);
  assert.equal(candidate.status,'partial');
  const [glass]=read('cover the boat with glass');
  assert.equal(data(glass,'constraint')[0].value,'glass');
  assert.equal(glass.status,'matched');
});

test('does not assign a page style to an object, a document format, or a negated or coordinated request',()=>{
  for (const text of [
    'render the whole boat as a dark gothic painting',
    'render the whole drawing as a PDF',
    'do not render the whole drawing as a dark gothic painting',
    'render every drawing as a dark gothic painting',
    'render the whole drawing as a dark gothic painting and delete it',
    'coat the house in a layer of red brick',
    'coat the house in glass red brick',
    'coat the imaginarything in brick',
  ]) assert.deepEqual(read(text),[],text);
});

test('retains native material aliases through reader evidence checks',async ()=>{
  const reader=createReader();
  try {
    const result=await reader.formalise('cover the house with timber',{tab:'drawing',evidence:true});
    const candidate=[result,...result.alternatives].find(reading=>reading.source==='transformation');
    assert.ok(candidate);
    assert.deepEqual(data(candidate,'constraint').map(row=>[row.value,row.words]),[['wood','timber']]);
  } finally {
    await reader.close();
  }
});

test('reads a new overlay owner and span property through the normal entry point',async t=>{
  const directory=mkdtempSync(fileURLToPath(new URL('../.cache/transform-',import.meta.url)));
  t.after(()=>rmSync(directory,{recursive:true,force:true}));
  const path=join(directory,'studio.sop');
  writeFileSync(path,`@foreign core.word text=fremdwort means=wood of=k.styles.material.name lang=de
@studio std.schema.world name=w.studio
@panel std.schema.kind of=w.studio.panel world=w.studio acts=change
@finish w.request.key tab=studio family=panel name=panel.finish head=span
@surface w.request.key tab=studio family=panel name=panel.surface head=class value=matte value=reflective
@transform pro.reader.transformation tab=studio family=panel act=change predicate=retexture marker=with owner=panel extent=entire value_head=finish attribute=panel.finish
@tone pro.reader.transformation tab=studio family=panel act=change predicate=turn marker=into owner=panel attribute=panel.surface
`);
  const reader=createReader(undefined,loadWorlds({paths:[path]}));
  try {
    const result=await reader.formalise('retexture the entire panel with satin finish',{tab:'studio'});
    const candidate=[result,...result.alternatives].find(reading=>reading.source==='transformation');
    assert.ok(candidate);
    assert.deepEqual(data(candidate,'target').map(row=>row.family),['panel']);
    assert.deepEqual(data(candidate,'constraint').map(row=>[row.attribute,row.value]),[['panel.finish','satin finish']]);
    const foreign=await reader.propose('coat the house in fremdwort');
    assert.ok(!foreign.candidates.some(reading=>reading.source==='transformation'));
    const closed=await reader.formalise('turn the panel into matte',{tab:'studio'});
    const typed=[closed,...closed.alternatives].find(reading=>reading.source==='transformation');
    assert.ok(typed);
    assert.deepEqual(data(typed,'constraint').map(row=>[row.attribute,row.value]),[['panel.surface','matte']]);
  } finally {
    await reader.close();
  }
});
