import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createReader } from '../src/runtime.mjs';
import { learnLexicon } from '../src/lexicon.mjs';
import { loadWorlds } from '../src/worlds.mjs';
import { parse, validate } from '../src/schema.mjs';
import { evidenceInText } from '../src/grounding.mjs';
import { topicCommandLearner } from '../src/topic-commands.mjs';

const one=(w,k)=>{
  const raw=w?.attrs[k]?.[0];
  return raw?.startsWith('"') ? JSON.parse(raw) : raw;
};
const starter={version:1,templates:[],lexicon:{}};
const result=(wires,key)=>wires.find(w=>one(w,'attribute')===key);
async function proposals(reader,text) {
  const {candidates}=await reader.propose(text,{evidence:true});
  return candidates.filter(c=>c.source==='topic-command');
}
const examples=['dog','cat','bird','kid','boy','girl','woman','duck'].map((sort,i)=>{
  const value=i%2 ? 'left' : 'right';
  return {text:'the '+sort+': face '+value,count:1,sop:[
    '@r w.request.request act=change mood=do predicate=face',
    '@t w.request.target request=$r family=drawn mode=existing determiner=definite fill=description sort='+sort,
    '@c w.request.constraint request=$r on=attribute attribute=drawn.facing value='+value+' operator=eq phase=result',
  ].join('\n')};
});

test('rebinds independent topic, selector and result on an unseen noun with legacy and new model shapes',async t=>{
  const worlds=loadWorlds({paths:[]}), learner=topicCommandLearner(worlds);
  learnLexicon(examples,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,learner);
  assert.deepEqual(learner.finish(),[{predicate:'face',family:'drawn',act:'change',attribute:'drawn.facing',support:8}]);
  for (const extra of [{}, {topicCommands:learner.finish()}]) {
    const reader=createReader({...starter,examples,...extra},worlds);
    t.after(()=>reader.close());
    const text='the huge bear: face right';
    const candidates=await proposals(reader,text);
    assert.equal(candidates.length,1,text);
    const [candidate]=candidates, wires=parse(candidate.sop);
    assert.ok(validate(candidate.sop,worlds));
    assert.ok(evidenceInText(text,candidate.sop,worlds));
    assert.deepEqual(candidate.evidence.counts,{grounded:5});
    assert.equal(one(wires.find(w=>w.id==='t'),'sort'),'bear');
    assert.equal(one(result(wires,'drawn.size'),'phase'),'selector');
    assert.equal(one(result(wires,'drawn.size'),'value'),'huge');
    assert.equal(one(result(wires,'drawn.facing'),'phase'),'result');
    assert.equal(one(result(wires,'drawn.facing'),'value'),'right');
    for (const negative of [
      'the huge bear: do not face right',
      'the huge bear: face right?',
      'the huge bear: face sideways',
      'the worried bear: face right',
      'the huge bear: face right and remove it',
      'if ready the huge bear: face right',
      'the bear: face “right”',
    ]) assert.equal((await proposals(reader,negative)).length,0,negative);
  }
});

test('counts independent normalized utterances and rejects conflicting learned result keys',()=>{
  const worlds=loadWorlds({paths:[]}), repeated=topicCommandLearner(worlds);
  for (let i=0;i<100;i++) repeated.observe(examples[0].text,parse(examples[0].sop));
  assert.deepEqual(repeated.finish(),[]);
  const conflict=topicCommandLearner(worlds);
  for (const example of examples) conflict.observe(example.text,parse(example.sop));
  conflict.observe(examples[0].text.toUpperCase(),parse(examples[0].sop.replace('drawn.facing','drawn.direction')));
  assert.deepEqual(conflict.finish(),[]);
});

test('keeps each supported result interpretation within and across installed families',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'topic-commands-'));
  t.after(()=>rmSync(dir,{force:true,recursive:true}));
  const file=join(dir,'bench.sop');
  const base=[
    '@bench std.schema.world name=w.bench',
    '@device std.schema.kind of=w.bench.instrument world=w.bench acts=change',
    '@name core.word text="sound meter" means=w.bench.instrument',
    '@state w.request.key tab=bench family=instrument name=instrument.state head=class value=ready value=silent',
    '@mode w.request.key tab=bench family=instrument name=instrument.mode head=class value=ready value=silent',
    '@setstate pro.reader.topic_command tab=bench family=instrument act=change predicate="hold in mode" attribute=instrument.state',
    '@screen std.schema.kind of=w.bench.screen world=w.bench acts=change',
    '@screen.name core.word text="sound meter" means=w.bench.screen',
    '@display w.request.key tab=bench family=screen name=screen.display head=class value=ready value=silent',
    '@setdisplay pro.reader.topic_command tab=bench family=screen act=change predicate="hold in mode" attribute=screen.display',
  ];
  for (const conflicting of [false,true]) {
    const lines=conflicting ? [...base,'@setmode pro.reader.topic_command tab=bench family=instrument act=change predicate="hold in mode" attribute=instrument.mode'] : base;
    writeFileSync(file,lines.join('\n'));
    const worlds=loadWorlds({paths:[file]}),reader=createReader({...starter,examples:[]},worlds);
    t.after(()=>reader.close());
    const text='the sound meter: hold in mode silent';
    const candidates=await proposals(reader,text);
    assert.equal(candidates.length,conflicting ? 3 : 2);
    const circuits=candidates.map(c=>parse(c.sop));
    assert.ok(circuits.some(wires=>one(result(wires,'screen.display'),'value')==='silent'));
    assert.ok(circuits.some(wires=>one(result(wires,'instrument.state'),'value')==='silent'));
    assert.equal(circuits.some(wires=>one(result(wires,'instrument.mode'),'value')==='silent'),conflicting);
    assert.ok(candidates.every(c=>validate(c.sop,worlds) && evidenceInText(text,c.sop,worlds)));
    assert.equal((await proposals(reader,'the sound meter: hold in mode busy')).length,0);
  }
});
