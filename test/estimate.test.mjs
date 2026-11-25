import test from 'node:test';
import assert from 'node:assert/strict';
import { createEstimator } from '../src/estimate.mjs';
import { createReader } from '../src/runtime.mjs';

const candidate = (family,name) => ({sop:'@r w.request.request act=change predicate=change\n@t w.request.target request=$r family='+family+' mode=existing'+(name?' name='+JSON.stringify(name):'')});

test('discussion ranks accepted circuits by current identity and discounts older turns',async()=>{
  const estimator=createEstimator();
  const a=candidate('drawn','Blue Moon'), b=candidate('node','Mercury');
  const rank=context=>estimator.estimate([a,b],context);
  try {
    assert.equal((await rank({})).decision,'underdetermined');
    for (const [context,expected] of [
      [{entities:[{name:'Mercury',family:'node',selected:true}]},1],
      [{turns:[a,b]},1],[{turns:[b,a]},0],
      [{turns:[{text:'Open Mercury please'}]},1],
      [{turns:[{text:'Open Mercuryville please'}]},0],
      [{turns:[{text:'Open Mercury',sop:a.sop}]},0]
    ]) {
      const result=await rank(context);
      assert.equal(result.selectedIndex,expected,JSON.stringify(result));
      assert.equal(result.ranking.length,2);
    }
    const invalid=await estimator.estimate([{sop:'bad'},b]);
    assert.deepEqual(invalid.invalidIndices,[0]);
    assert.equal(invalid.decision,'single_candidate');
    assert.equal((await estimator.estimate([])).selectedIndex,null);
  } finally { await estimator.close(); }
});

test('the text pipeline preserves all generated circuits and reports global catalog validation',async()=>{
  const reader=createReader();
  try {
    const text='create an object';
    const generated=await reader.propose(text);
    assert.equal(generated.multipleInterpretations,true);
    const pool=generated.candidates.map(c=>c.sop);
    const ranked=await reader.formalise(text,{rank:true,evidence:true});
    for (const candidate of [ranked,...ranked.alternatives]) assert.equal(candidate.sop,pool[candidate.generatorIndex]);
    assert.equal(ranked.candidateCount,pool.length);
    assert.deepEqual(ranked.catalog,{issues:[]});
    for (const family of ['drawn','node']) assert.ok(pool.some(sop=>sop.includes('family='+family)));
  } finally { await reader.close(); }
});

test('live properties score only selectors on the same request',async()=>{
  const estimator=createEstimator();
  const make=(value,phase)=>({sop:candidate('drawn').sop+
    '\n@c w.request.constraint request=$r on=attribute operator=eq phase='+phase+' attribute=drawn.colour value='+value});
  const ctx={entities:[{family:'drawn',selected:true,properties:{'drawn.colour':'blue'}}]};
  try {
    assert.equal((await estimator.estimate([make('red','selector'),make('blue','selector')],ctx)).selectedIndex,1);
    assert.equal((await estimator.estimate([make('red','result'),make('blue','result')],ctx)).decision,'underdetermined');
  } finally { await estimator.close(); }
});

test('sequence alternatives retain ambiguous readings of individual clauses',async()=>{
  const examples=['drawn','node'].map((family,i)=>({text:'change Mercury',...candidate(family,'Mercury'),count:2-i}));
  examples.push({text:'change Pluto',...candidate('node','Pluto'),count:1});
  const reader=createReader({version:1,examples,lexicon:{},templates:[]});
  const estimator=createEstimator();
  try {
    const text='change Mercury then change Pluto';
    const generated=await reader.formalise(text);
    assert.equal(generated.source,'sequence');
    assert.match(generated.sop,/family=drawn/);
    const candidates=[generated,...generated.alternatives];
    const estimation=await estimator.estimate(candidates,{entities:[{name:'Mercury',family:'node',selected:true}]});
    const ranked=candidates[estimation.selectedIndex];
    assert.equal(ranked.source,'sequence');
    assert.doesNotMatch(ranked.sop,/family=drawn/);
    assert.match(ranked.sop,/name="Pluto"/);
  } finally { await Promise.all([reader.close(),estimator.close()]); }
});
