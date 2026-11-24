import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createEstimator } from '../src/estimate.mjs';
import { createReader } from '../src/runtime.mjs';
import { loadWorlds } from '../src/worlds.mjs';

test('ranks both integration-review properties without changing the proposal set',async t=>{
  const worlds=loadWorlds({paths:['sop-worlds']});
  const reader=createReader(undefined,worlds);
  t.after(()=>reader.close());
  for (const [input,expected,bad] of [
    ['What style does the link have?',/asked="link\.style"/u,/w\.request\.unread/u],
    ['Set the route on the link to curvy',/attribute="link\.route"[^\n]*value=curved/u,/link\.end/u],
  ]) {
    const {candidates}=await reader.propose(input);
    const ranked=await reader.formalise(input,{tab:'diagram'});
    assert.match(ranked.sop,expected);
    assert.doesNotMatch(ranked.sop,bad);
    assert.ok(ranked.alternatives.some(c=>bad.test(c.sop)));
    assert.deepEqual([ranked,...ranked.alternatives].map(c=>c.sop).sort(),candidates.map(c=>c.sop).sort());
    assert.ok(ranked.estimation.ranking[0].reasons.some(r=>r.signal==='written_property_evidence'));
  }
});

test('supports installed property roles, rejects unsupported polarity, and preserves strong identity',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'sop-evidence-ranking-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const path=join(dir,'workbench.sop');
  writeFileSync(path,`
@bench std.schema.world name=w.workbench
@fixture std.schema.kind of=w.workbench.fixture world=w.workbench acts=change
@finish w.request.key tab=workbench family=fixture name=fixture.finish head=class value=matte value=gloss
@edge w.request.key tab=workbench family=fixture name=fixture.edge head=candidate value=to
`);
  const estimator=createEstimator(loadWorlds({paths:[path]}));
  t.after(()=>estimator.close());
  const utterance='Set the finish on the fixture to matte';
  const base='@r w.request.request act=change mood=do predicate=Set\n@t w.request.target request=$r family=fixture mode=existing ';
  const before='\n@c w.request.constraint request=$r on=attribute phase=result operator=eq attribute=fixture.finish value=matte';
  const good={sop:base+'fill=description description="the fixture"'+before+' key_words=finish'};
  const negated={sop:base+'fill=description description="the fixture"'+before+' key_words=finish want=no'};
  const extra={sop:good.sop+
    '\n@extra w.request.constraint request=$r on=attribute phase=result operator=eq attribute=fixture.edge value=to'};
  const identity={sop:base+'fill=written name=Anchor'+before};
  assert.equal((await estimator.estimate([negated,extra,good],{tab:'workbench'})).selectedIndex,0);
  const ranked=await estimator.estimate([negated,extra,good],{tab:'workbench'},{utterance});
  assert.equal(ranked.selectedIndex,2);
  assert.ok(ranked.ranking.find(r=>r.index===1).reasons.some(r=>r.unsupportedEffects===1));
  assert.ok(ranked.ranking.find(r=>r.index===0).reasons.some(r=>r.unsupportedEffects===1));
  const live=await estimator.estimate([negated,good,identity],{
    tab:'workbench',entities:[{family:'fixture',name:'Anchor',selected:true}],
  },{utterance});
  assert.equal(live.selectedIndex,2);
  assert.ok(live.ranking[0].reasons.some(r=>r.signal==='entity_identity'));
});

test('promotes the grounded pilot relation without losing preceding effects or the partial alternative',async t=>{
  const worlds=loadWorlds({paths:['sop-worlds']});
  const photo='Set the width of the product photo to 6.5 inches and the height to twice the width';
  const spokenPhoto=photo.replace('6.5 inches','six inches');
  const kids='draw two kids on the lawn facing each other — right there in the picture — that is how the picture goes';
  const model={version:1,templates:[],lexicon:{},examples:[
    {text:photo,count:1,sop:`@r w.request.request act=change mood=do predicate=Set
@t w.request.target request=$r family=node mode=existing determiner=definite fill=description sort=picture sort_words=photo description="the product photo"
@w w.request.constraint request=$r on=attribute attribute=node.width value="6.5 inches" operator=eq phase=result key_words=width
@h w.request.constraint request=$r on=attribute attribute=node.height value="twice the width" operator=eq phase=result key_words=height
@u w.request.unread request=$r text="twice the width"`},
    {text:kids,count:1,sop:`@r w.request.request act=make mood=do predicate=draw words="draw two kids on the lawn facing each other"
@t w.request.target request=$r family=drawn mode=new determiner=quantified sort=kid sort_words=kids count_words=two
@c w.request.constraint request=$r on=count attribute=drawn.count words=two operator=eq phase=result
@p w.request.constraint request=$r on=place attribute=drawn.relation value=on words="on the lawn" operator=relation phase=result
@a w.request.constraint request=$r on=place attribute=drawn.anchor value="the lawn" operator=relation phase=selector
@u w.request.unread request=$r text="kids on the lawn facing each other"
@f w.request.filler text="right there in the picture — that is how the picture goes"`},
  ]};
  model.examples.push({text:spokenPhoto,count:1,sop:model.examples[0].sop.replace('6.5 inches','six inches')});
  const reader=createReader(model,worlds);
  t.after(()=>reader.close());
  for (const [utterance,tab,relation,preserved] of [
    [photo,'diagram','scaled','node.width'],[spokenPhoto,'diagram','scaled','node.width'],
    [kids,'drawing','reciprocal','the lawn'],
  ]) {
    const {candidates}=await reader.propose(utterance);
    const ranked=await reader.formalise(utterance,{tab});
    assert.ok(ranked.sop.includes('w.relational.'+relation),ranked.sop);
    if (utterance===spokenPhoto) {
      assert.match(ranked.sop,/measure=6(?:\s|$)/u);
      assert.match(ranked.sop,/unit="?inch"?(?:\s|$)/u);
      assert.match(ranked.sop,/measure_words="?six"?(?:\s|$)/u);
    }
    assert.ok(ranked.sop.includes(preserved),ranked.sop);
    assert.ok(ranked.estimation.ranking[0].reasons.some(r=>r.signal==='grounded_relation_extension'));
    assert.deepEqual([ranked,...ranked.alternatives].map(c=>c.sop).sort(),candidates.map(c=>c.sop).sort());
  }
  const estimator=createEstimator(worlds);
  t.after(()=>estimator.close());
  const partial=model.examples[0];
  const {candidates}=await reader.propose(photo);
  const typed=candidates.find(c=>c.sop.includes('w.relational.scaled'));
  const fabricated={sop:typed.sop.replace('factor=2','factor=3')};
  const removed={sop:typed.sop.replace('6.5 inches','65 inches')};
  const wrongUnit={sop:typed.sop.replace(/unit="?inch"?(?=\s|$)/u,'unit="second"')};
  assert.notEqual(wrongUnit.sop,typed.sop);
  for (const competing of [fabricated,removed,wrongUnit]) {
    const result=await estimator.estimate([partial,competing],{tab:'diagram'},{utterance:photo});
    assert.equal(result.selectedIndex,0);
    assert.ok(result.ranking.every(row=>row.reasons.every(r=>r.signal!=='grounded_relation_extension')));
  }
  const conflictingPartial={sop:partial.sop.replace('value="6.5 inches"','value="6.5 inches" measure=6.5 unit="second"')};
  const conflicting=await estimator.estimate([conflictingPartial,typed],{tab:'diagram'},{utterance:photo});
  assert.ok(conflicting.ranking.every(row=>row.reasons.every(r=>r.signal!=='grounded_relation_extension')));
  const different={sop:partial.sop.replace('description="the product photo"','name=Backdrop')};
  const context={tab:'diagram',entities:[{family:'node',sort:'picture',name:'Backdrop',selected:true}]};
  assert.equal((await estimator.estimate([partial,typed,different],context,{utterance:photo})).selectedIndex,2);
});
