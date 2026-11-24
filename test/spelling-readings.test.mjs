import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createReader } from '../src/runtime.mjs';
import { loadWorlds } from '../src/worlds.mjs';
import { spellingReadings } from '../src/spelling-readings.mjs';

const original='Set the route on the link to curvvy';
const corrected='Set the route on the link to curvy';
const key='link.route';

test('combines spelling readings once per SOP and skips the second generation without corrections',async()=>{
  const originalSop={sop:'original'}, correctedSop={sop:'corrected'}, shared={sop:'shared'};
  const texts=[];
  const propose=async text=>{
    texts.push(text);
    return {candidates:text===original ? [originalSop,shared] : [correctedSop,shared]};
  };
  const {candidates}=await spellingReadings(original,propose);
  assert.deepEqual(texts,[original,corrected]);
  assert.deepEqual(candidates.map(c=>[c.sop,c.spellingReading,c.spellingReadings]),[
    ['corrected','corrected',['corrected']],['shared','original',['original','corrected']],
    ['original','original',['original']],
  ]);
  texts.length=0;
  const unchanged=await spellingReadings(corrected,propose);
  assert.deepEqual(texts,[corrected]);
  assert.ok(unchanged.candidates.every(c=>c.spellingReading==='original'));
});

test('reader retains originals and corrected lexical evidence through ranking',async t=>{
  const reader=createReader(undefined,loadWorlds({paths:['sop-worlds']}));
  t.after(()=>reader.close());
  const baseline=await reader.propose(original);
  const revised=await reader.propose(corrected);
  const result=await reader.propose(original,{spell:true,evidence:true});
  assert.equal(result.original,original);
  assert.equal(result.spelling.text,corrected);
  const unique=new Set([...baseline.candidates,...revised.candidates].map(c=>c.sop));
  assert.deepEqual(new Set(result.candidates.map(c=>c.sop)),unique);
  assert.equal(result.candidateCount,unique.size);
  assert.ok(baseline.candidates.every(c=>!Object.hasOwn(c,'spellingReading')));
  const ordered=await reader.formalise(original,{spell:true});
  assert.equal(ordered.sop,revised.candidates[0].sop);
  const ranked=await reader.formalise(original,{spell:true,evidence:true,tab:'diagram'});
  assert.match(ranked.sop,/attribute="link\.route"[^\n]*value=curved/u);
  assert.equal(ranked.spellingReading,'corrected');
  assert.ok(ranked.estimation.ranking[0].reasons.some(r=>
    r.signal==='written_property_evidence' && r.supportedEffects===1));
  assert.deepEqual(new Set([ranked,...ranked.alternatives].map(c=>c.sop)),unique);
  for (const c of [ranked,...ranked.alternatives]) {
    const source=c.spellingReading==='corrected' ? corrected : original;
    for (const token of c.evidence.tokens) {
      assert.equal(source.slice(token.start,token.end),token.text);
      assert.equal(original.slice(token.originalStart,token.originalEnd),token.originalText);
    }
    for (const span of c.evidence.spans) assert.equal(span.originalRanges.length,span.ranges.length);
  }
  const repaired=ranked.evidence.tokens.find(token=>token.text==='curvy');
  assert.equal(repaired.status,'grounded');
  assert.equal(repaired.originalText,'curvvy');
  assert.ok(ranked.evidence.spans.some(span=>span.text==='curvy' &&
    span.originalRanges.some(([a,b])=>original.slice(a,b)==='curvvy')));
  assert.ok(ranked.sop.includes(key));
});

test('spelling CLI retains both readings for batch and pipeline modes',()=>{
  const cli=fileURLToPath(new URL('../bin/formalise.mjs',import.meta.url));
  for (const mode of [[],['--pipeline','--tab','diagram']]) {
    const result=spawnSync(process.execPath,[cli,'--worlds-only','--batch','--spell','--evidence',...mode],{
      encoding:'utf8',input:JSON.stringify({text:original})+'\n',
      env:{...process.env,SOP_WORLDS:'sop-worlds'},
    });
    assert.equal(result.status,0,result.stderr);
    const output=JSON.parse(result.stdout);
    const candidates=output.candidates ?? [output,...output.alternatives];
    assert.equal(output.original,original);
    assert.equal(output.spelling.text,corrected);
    assert.ok(candidates.some(c=>c.spellingReading==='original'));
    assert.ok(candidates.some(c=>c.spellingReading==='corrected'));
    assert.ok(candidates.every(c=>c.evidence.tokens.every(t=>Number.isInteger(t.originalStart))));
  }
});

test('a selected original name can outrank a spelling correction',async t=>{
  const examples=['Stormm','Storm'].map(name=>({text:'Remove '+name,count:1,sop:
    '@r w.request.request act=remove mood=do predicate=Remove\n'+
    '@t w.request.target request=$r family=drawn mode=existing determiner=definite fill=written name='+name}));
  const reader=createReader({version:1,templates:[],lexicon:{},examples},loadWorlds({paths:['sop-worlds']}));
  t.after(()=>reader.close());
  const ranked=await reader.formalise('Remove Stormm',{spell:true,context:{
    tab:'drawing',entities:[{family:'drawn',name:'Stormm',selected:true}],
  }});
  assert.equal(ranked.spelling.text,'Remove Storm');
  assert.equal(ranked.spellingReading,'original');
  assert.match(ranked.sop,/name=Stormm/u);
  assert.ok(ranked.estimation.ranking[0].reasons.some(r=>r.signal==='entity_identity'));
  assert.ok(ranked.alternatives.some(candidate=>candidate.spellingReading==='corrected' &&
    /name=Storm(?:\s|$)/u.test(candidate.sop)));
});
