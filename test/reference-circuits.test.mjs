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

test('unresolved thing lookup words are part of the request meaning',()=>{
  const requests=[
    '@first w.request.request act=copy mood=do predicate=Copy',
    '@second w.request.request act=copy mood=do predicate=copy',
  ].join('\n');
  const lookup='@ref w.request.lookup request=$first key=thing words=it';
  const sop=requests+'\n'+lookup;
  const row={text:'Copy it, then copy that',sop};
  const compare=predicted=>scoreReferences(row,{sop:predicted});
  const identical=compare(sop);
  assert.equal(identical.fullWireMatch,true);
  assert.equal(identical.semanticWireMatch,true);
  assert.equal(identical.semanticMatchedWires,3);
  assert.equal(compare(sop.replace('words=it','words="it"')).semanticWireMatch,true);
  const reordered=sop.replaceAll('first','a').replaceAll('second','b').replace('@ref','@lookup').split('\n');
  assert.equal(compare([reordered[2],...reordered.slice(0,2)].join('\n')).semanticWireMatch,true);
  for (const different of [
    requests,sop.replace(' words=it',''),sop.replace('words=it','words=that'),
    sop.replace('request=$first','request=$second'),sop+' from=previous',
  ]) {
    const result=compare(different);
    assert.equal(result.fullWireMatch,false,different);
    assert.equal(result.semanticWireMatch,false,different);
    assert.equal(result.semanticMatchedWires,2,different);
    assert.equal(scoreReferences(row,{sop:'',alternatives:[{sop:different}]}).alternativeSemanticMatch,false);
  }
});

test('words on an already bound lookup remain supporting evidence',()=>{
  const examples=[
    '@r w.request.request act=copy mood=do predicate=Copy\n'+
      '@t w.request.target request=$r family=document mode=existing family_words=document\n'+
      '@l w.request.lookup request=$r target=$t key=thing words=it',
    '@r w.request.request act=place predicate=Place\n'+
      '@c w.request.constraint request=$r on=place relation=near value=chart\n'+
      '@l w.request.lookup request=$r constraint=$c key=thing words=it',
    '@a w.request.request act=ask mood=ask question=count predicate=Count\n'+
      '@r w.request.request act=make mood=do predicate=Draw\n'+
      '@l w.request.lookup request=$r key=answer from=request antecedent=$a words=it',
  ];
  for (const sop of examples) {
    const row={text:'Copy it',sop};
    const result=scoreReferences(row,{sop:sop.replace('words=it','words=that')});
    assert.equal(result.fullWireMatch,false);
    assert.equal(result.semanticWireMatch,true);
  }
});
