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
