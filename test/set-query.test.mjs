import assert from 'node:assert/strict';
import { test } from 'node:test';
import { tokens } from '../src/lexicon.mjs';
import { postfixSetQuestions, universalTargetReading } from '../src/set-query.mjs';
import { createReader } from '../src/runtime.mjs';
import { parse } from '../src/schema.mjs';
import { loadWorlds } from '../src/worlds.mjs';

const worlds=loadWorlds();

test('a postfix count requires the whole preceding nominal',()=>{
  const text='Text boxes count?';
  const exact=[0,10,['target','ask','node','existing','text',1]];
  assert.match([...postfixSetQuestions(text,tokens(text),worlds,[exact],[])][0].sop,
    /question=count.+\n.+fill=all sort="text" sort_words="Text boxes"/u);
  assert.equal([...postfixSetQuestions(text,tokens(text),worlds,[[5,...exact.slice(1)]],[])].length,0);
  assert.equal([...postfixSetQuestions(text,tokens(text),worlds,[exact],[{}])].length,0);
});

test('a universal set cue changes only an adjacent existing target',()=>{
  const sop='@r w.request.request act=place predicate=put\n'+
    '@t w.request.target request=$r family=drawn mode=existing sort=cloud sort_words=clouds\n'+
    '@u w.request.unread request=$r text="every one of the"';
  const read=text=>universalTargetReading(text,tokens(text),worlds,{sop},[]);
  assert.match(read('Put every one of the clouds in a grid.').sop,
    /fill=all quantifier=all count_words="every one of the clouds"/u);
  assert.match(read('Put all three clouds in a grid.').sop,/fill=all quantifier=all count_words="all three clouds" count=3/u);
  assert.equal(read('Put every three clouds in a grid.'),undefined);
  assert.equal(read('Put all nearby clouds in a grid.'),undefined);
  assert.equal(read('Put not all the clouds in a grid.'),undefined);
});

test('treats a nominal count request as a question and keeps its written scope',async t=>{
  const reader=createReader(undefined,worlds);
  t.after(()=>reader.close());
  const value=(wire,key)=>{
    const raw=wire?.attrs[key]?.[0];
    return raw?.startsWith('"') ? JSON.parse(raw) : raw;
  };
  for (const [text,family,noun,scope] of [
    ['Give us a headcount of humans on the guest list, would you?','person','humans','on the guest list'],
    ['What is the headcount of participants?','person','participants',undefined],
    ['Give me a count of charts, please','chart','charts',undefined],
  ]) {
    const {candidates}=await reader.propose(text,{evidence:true});
    const reading=candidates.find(candidate=>candidate.source==='prefix-set-query' &&
      parse(candidate.sop).some(wire=>value(wire,'family')===family));
    assert.ok(reading,text);
    const wires=parse(reading.sop);
    const request=wires.find(wire=>wire.type==='w.request.request');
    const target=wires.find(wire=>wire.type==='w.request.target');
    const unread=wires.find(wire=>wire.type==='w.request.unread');
    assert.deepEqual([value(request,'act'),value(request,'question')],['ask','count']);
    assert.deepEqual([value(target,'fill'),value(target,'quantifier'),value(target,'family_words')],['all','all',noun]);
    assert.equal(value(unread,'text'),scope);
    assert.equal(reading.status,scope?'partial':'matched');
    assert.deepEqual(reading.evidence.missing,[]);
    assert.equal(reading.evidence.counts.uncovered ?? 0,0);
    assert.deepEqual(reading.catalog.issues,[]);
    assert.ok(candidates.every(candidate=>parse(candidate.sop).filter(wire=>wire.type==='w.request.request')
      .every(wire=>value(wire,'act')==='ask')),text);
  }
  for (const text of [
    'Give us the guest list',
    'Give us a headcount of mystery objects',
    'Give us a headcount of people if ready',
    'Give us a headcount of people and remove the room',
    'Write "Give us a headcount of people"',
  ]) {
    const {candidates}=await reader.propose(text);
    assert.ok(!candidates.some(candidate=>candidate.source==='prefix-set-query'),text);
  }
});
