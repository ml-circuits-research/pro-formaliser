import test from 'node:test';
import assert from 'node:assert/strict';
import { createReader } from '../src/runtime.mjs';
import { learnLexicon } from '../src/lexicon.mjs';

test('unification keeps exact evidence, schema rejects unknown acts and fallback keeps remaining text', async () => {
  const sop = '@r1 w.request.request act=make predicate=draw\n@r1.t w.request.target request=$r1 family=drawn mode=new sort=oval';
  const model = {version:1,examples:[{text:'draw oval',sop,count:1},{text:'draw oval',sop:sop.replace('act=make','act=blorp'),count:99}],
    templates:[{pattern:['draw',{slot:0,min:1,max:2}],parts:['@r w.request.request act=make predicate=draw\n@r.t w.request.target request=$r family=drawn mode=new name=',{slot:0,quote:'always'}],count:2}],
    lexicon:learnLexicon([{sop}])};
  const reader = createReader(model);
  try {
    assert.equal((await reader.formalise('draw oval')).sop,sop);
    assert.match((await reader.formalise('draw 新 moon')).sop,/name="新 moon"/);
    const partial = await reader.formalise('draw oval with luminous edges');
    assert.equal(partial.status,'partial');
    assert.match(partial.sop,/sort=oval/);
    assert.match(partial.sop,/text="with luminous edges"/);
    assert.equal((await reader.formalise('zzz')).status,'unresolved');
  } finally { await reader.close(); }
});

test('composes a grounded result, defers negated result and inserts a lookup for a family-only reference', async () => {
  const lexicon = {
    paint:[['act','change','do',20]],
    object:[['target','change','drawn','existing','',10]],
    violet:[['constraint','change','drawn','on=attribute attribute=drawn.colour value=violet operator=eq phase=result',5]]
  };
  const reader = createReader({version:1,examples:[],templates:[],lexicon});
  try {
    const positive = await reader.formalise('paint object violet');
    assert.match(positive.sop,/w.request.lookup request=\$r1 target=\$r1.t key=thing/);
    assert.match(positive.sop,/attribute=drawn.colour value=violet/);
    const negative = await reader.formalise('paint object but not violet');
    assert.doesNotMatch(negative.sop,/value=violet/);
    assert.match(negative.sop,/text="but not violet"/);
  } finally { await reader.close(); }
});

test('explicit sequences preserve request-local references, quoted joiners and concurrent replies', async () => {
  const wire = (act,predicate,name) => '@r w.request.request act='+act+' predicate='+predicate+'\n@t w.request.target request=$r family=drawn mode=new name='+JSON.stringify(name);
  const examples = [{text:'draw comet',sop:wire('make','draw','comet'),count:2},
    {text:'mark moon',sop:wire('change','mark','moon'),count:1}];
  const reader=createReader({version:1,examples,templates:[],lexicon:{}});
  try {
    const [joined,raw] = await Promise.all([reader.formalise('draw comet, and then mark moon'),reader.formalise('draw comet')]);
    assert.equal(joined.source,'sequence');
    assert.match(joined.sop,/request=\$s1\.r/);
    assert.match(joined.sop,/request=\$s2\.r/);
    assert.match(joined.sop,/words="mark moon"/);
    assert.equal(raw.sop,examples[0].sop);
    assert.notEqual((await reader.formalise('draw "comet then mark moon"')).source,'sequence');
  } finally { await reader.close(); }
});

test('discard stale evidence in an example and keep the reading grounded in the current text', async () => {
  const model = {version:1,templates:[],examples:[
    {text:'draw oval',sop:'@r w.request.request act=remove predicate=erase',count:99},
    {text:'draw oval',sop:'@r w.request.request act=make predicate=draw',count:1}
  ]};
  const reader = createReader(model);
  try {
    assert.match((await reader.formalise('draw oval')).sop,/act=make/);
  } finally { await reader.close(); }
});

test('a matched whole-utterance example cannot hide two independently matched requests',async()=>{
  const wire=(act,pred)=>'@r w.request.request act='+act+' predicate='+pred;
  const text='draw comet and delete moon';
  const examples=[[text,wire('make','draw')],['draw comet',wire('make','draw')],['delete moon',wire('remove','delete')]]
    .map(([text,sop])=>({text,sop,count:1}));
  const reader=createReader({version:1,templates:[],examples,lexicon:{}});
  try {
    const r=await reader.formalise(text);
    assert.equal(r.source,'sequence');
    assert.match(r.sop,/act=remove predicate=delete/);
    assert.ok(r.alternatives.some(c=>c.sop===examples[0].sop));
  } finally {await reader.close();}
});

test('a connective between learned names admits new titles and rejects a whole command as a title', async t=>{
  const {train}=await import('../src/model.mjs');
  const row=(replacement,old)=>({
    text:replacement+' for '+old,
    sop:'@r w.request.request act=change mood=do\n@t w.request.target request=$r family=node mode=existing name='+old+
      '\n@c w.request.constraint request=$r on=attribute attribute=node.label value='+replacement+' operator=eq phase=result',
  });
  const reader=createReader(train([row('Cedar','Pine'),row('Elm','Ash')]));
  t.after(()=>reader.close());
  const hasTemplate=async text=>(await reader.propose(text)).candidates.some(c=>c.source==='template');
  assert.ok(await hasTemplate('Board of Governors for Trustees'));
  assert.ok(await hasTemplate('maple for birch'));
  assert.equal(await hasTemplate('draw two boxes for me'),false);
});
