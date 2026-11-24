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
