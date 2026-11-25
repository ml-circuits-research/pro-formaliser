import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {loadWorlds} from '../src/worlds.mjs';
import {createReader} from '../src/runtime.mjs';
import {tokens} from '../src/lexicon.mjs';
import {parse} from '../src/schema.mjs';
import {evidenceInText} from '../src/grounding.mjs';
import {frameSupport} from '../src/language-frames.mjs';
import {prologWorker} from '../src/prolog-worker.mjs';

test('an exact source phrase inside a quotation cannot supply a request predicate',()=>{
  const wrong='@r w.request.request act=remove predicate=delete';
  assert.equal(evidenceInText('write “delete the chart”',wrong),false);
  assert.equal(evidenceInText('delete “delete”',wrong),true);
  assert.equal(evidenceInText('copy “delete the chart” then delete this',wrong+' words="delete the chart"'),false);
});

test('a new world frame identifies reversed arguments and distinguishes imperative head from noun',async t=>{
  const dir=mkdtempSync('.cache/linguistic-test-');
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  writeFileSync(join(dir,'words.sop'),`
@spruce k.actions.verb text=glaze act=change
@pattern w.lang.en.frame name=demo.glaze act=change
@p1 w.lang.en.part frame=demo.glaze at=1 is=verb act=change
@p2 w.lang.en.part frame=demo.glaze at=2 is=role role=thing takes=words
@p3 w.lang.en.part frame=demo.glaze at=3 is=word word=using
@p4 w.lang.en.part frame=demo.glaze at=4 is=role role=coating takes=words
@map pro.reader.evidence_role role=coating type=w.request.constraint slot=value phase=result
`);
  const worlds=loadWorlds({paths:[dir]}),text='glaze Mercury using violet',ts=tokens(text);
  const worker=prologWorker(new URL('../prolog/formalise.pl',import.meta.url));
  try {
    const proofs=await worker.request({languageOnly:worlds.languageFrames.prepare(ts,[],worlds)});
    const assess=(name,value)=>frameSupport(parse('@r w.request.request act=change predicate=glaze\n@t w.request.target request=$r family=drawn mode=existing name="'+name+'"\n@c w.request.constraint request=$r on=attribute attribute=drawn.colour value='+value+' phase=result'),
      proofs,ts,text,worlds);
    assert.equal(assess('Mercury','violet').frame,'demo.glaze');
    assert.equal(assess('Mercury','violet').conflicts.length,0);
    assert.equal(assess('violet','Mercury').conflicts.length,2);
    const noun=tokens('the glaze');
    assert.equal((await worker.request({languageOnly:worlds.languageFrames.prepare(noun,[],worlds)})).length,0);
  } finally {await worker.close();}
});

test('the reader exposes an attested syntactic frame without claiming to resolve its object',async()=>{
  const reader=createReader();
  try{
    const r=await reader.formalise('delete the triangle',{evidence:true});
    assert.equal(r.language.act,'remove');
    assert.deepEqual(r.language.roles,[{role:'thing',text:'triangle'}]);
  }finally{await reader.close();}
});

test('an exact canonical predicate with a full frame excludes conflicting learned acts and operand heads',async t=>{
  const reader=createReader({
    version:1,examples:[],templates:[],
    lexicon:{save:[['act','place','do',10000]],as:[['act','make','do',10000]],
      copy:[['act','change','do',10000]]},
  });
  t.after(()=>reader.close());
  for (const [text,act,predicate] of [
    ['Save the chart as PNG','save','Save'],
    ['Save the document','save','Save'],
    ['Copy the chart','copy','Copy'],
  ]) {
    const {candidates}=await reader.propose(text);
    assert.ok(candidates.length,text);
    for (const {sop} of candidates) {
      const [request]=parse(sop);
      assert.equal(request.attrs.act[0],act,text);
      assert.equal(request.attrs.predicate[0],predicate,text);
    }
  }
  const {candidates}=await reader.propose('Save the chart as PNG');
  assert.ok(candidates.some(({sop})=>parse(sop).some(wire=>
    wire.type==='w.request.unread' && wire.attrs.text[0]==='"the chart as PNG"')));
});

test('a native target declaration licenses saving that family and keeps an unsupported format unread',async t=>{
  const worlds=loadWorlds({paths:['sop-worlds/save-target-pilot']});
  const reader=createReader(undefined,worlds);
  t.after(()=>reader.close());
  for (const [text,family,unread] of [
    ['Save the picture','page'],
    ['Save the chart as PNG','chart','"as PNG"'],
    ['Save the diagram','diagram'],
  ]) {
    const {candidates}=await reader.propose(text,{evidence:true});
    const matching=candidates.find(({sop})=>parse(sop).some(wire=>
      wire.type==='w.request.target' && wire.attrs.family[0]===family));
    assert.ok(matching,text);
    const wires=parse(matching.sop);
    assert.equal(wires[0].attrs.act[0],'save',text);
    assert.deepEqual(wires.filter(wire=>wire.type==='w.request.unread').map(wire=>wire.attrs.text[0]),
      unread ? [unread] : [],text);
    assert.deepEqual(matching.catalog.issues,[],text);
    assert.deepEqual(matching.evidence.missing,[],text);
  }
});
