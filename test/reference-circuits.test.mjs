import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkReferences, scoreReferences, validReferencesOf } from '../eval/reference-circuits.mjs';
import { measureRequirements } from '../eval/requirements.mjs';
import { createReader } from '../src/reader.mjs';
import { loadWorlds } from '../src/worlds.mjs';

test('a real reading can match any valid SOP column without counting the row twice',async t=>{
  const worlds=loadWorlds();
  const reader=await createReader({worldsOnly:true});
  t.after(()=>reader.close());
  const text='Set chart width to 500';
  const {candidates}=await reader.propose(text);
  const [described,contextual]=candidates.filter(candidate=>candidate.source==='native-property-frame');
  assert.ok(described && contextual);

  const bad=described.sop.replace('value="500"','value="700"');
  const row={text,sop:described.sop,source:'charts.csv',row:2,references:[
    {column:'sop',sop:described.sop},
    {column:'sop1',sop:bad},
    {column:'sop2',sop:contextual.sop},
  ]};
  row.referenceChecks=checkReferences(row,worlds);
  assert.deepEqual(row.referenceChecks.map(({column,errors})=>[column,errors]),[
    ['sop',[]],['sop1',['source_evidence']],['sop2',[]],
  ]);
  assert.deepEqual(validReferencesOf(row).map(({column})=>column),['sop','sop2']);
  const matched=scoreReferences(row,contextual);
  assert.equal(matched.closestReferenceColumn,'sop2');
  assert.equal(matched.exact,true);
  assert.equal(matched.fullWireMatch,true);
  assert.equal(matched.semanticWireMatch,true);
  assert.equal(matched.alternativeSemanticMatch,false);
  assert.equal(matched.semanticGoldWires,matched.semanticMatchedWires);
  const wrong=scoreReferences(row,{sop:bad,alternatives:[contextual]});
  assert.equal(wrong.exact,false);
  assert.equal(wrong.semanticWireMatch,false);
  assert.equal(wrong.alternativeSemanticMatch,true);
  const requirements=measureRequirements([{...row,prediction:contextual}],worlds);
  assert.deepEqual(requirements.roles.result,{kept:1,omitted:0,added:0});

  const blank={...row,sop:'',references:[row.references[2]],referenceChecks:[row.referenceChecks[2]]};
  assert.equal(scoreReferences(blank,contextual).semanticWireMatch,true);
});
