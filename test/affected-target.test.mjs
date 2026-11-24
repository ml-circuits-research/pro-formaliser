import assert from 'node:assert/strict';
import { test } from 'node:test';
import { affectedTargetCandidates, createAffectedParticiples } from '../src/affected-target.mjs';
import { tokens } from '../src/lexicon.mjs';
import { quotedSpans } from '../src/literal-roles.mjs';
import { loadWorlds } from '../src/worlds.mjs';
import { parse } from '../src/schema.mjs';

const w = loadWorlds();
const worlds = {
  ...w,
  affectedTargetLeads: new Set(['i need',"i ' ll have"]),
  affectedTargetSources: [
    {act:'remove',family:'meeting',marker:'from',keyword:'schedule',attribute:'meeting.calendar'},
  ],
  affectedParticiples: form=>form==='deleted' ? ['delete'] : [],
};

function read(text, facts = worlds) {
  return affectedTargetCandidates(text,tokens(text),quotedSpans(text),facts);
}

const data = (candidate, type) => parse(candidate.sop)
  .filter(wire=>wire.type==='w.request.'+type).map(wire=>Object.fromEntries(
    Object.entries(wire.attrs).map(([key,[value]])=>[key,value.startsWith('"') ? JSON.parse(value) : value])));

test('inverts native regular and irregular participial morphology', () => {
  const byType = new Map();
  const sop = [
    '@e w.lang.en.class name=verb.e drop=e pos=verb',
    '@ed w.lang.en.ending class=verb.e suffix=ed vform=past_participle',
    '@t w.lang.en.irregular_form lemma=take form=taken vform=past_participle',
  ].join('\n');
  for (const wire of parse(sop)) byType.set(wire.type,[wire]);
  const participles = createAffectedParticiples(type=>byType.get(type) ?? []);
  assert.deepEqual(participles('deleted'),['delete']);
  assert.deepEqual(participles('taken'),['take']);
  assert.deepEqual(participles('delete'),[]);
});

test('keeps the affected written name and nominal family, and preserves the unbound source text', () => {
  const proposals = read('I’ll have the Grow step deleted from this tree');
  assert.equal(proposals.length,1);
  const [candidate] = proposals;
  assert.deepEqual(data(candidate,'request').map(({act,predicate})=>[act,predicate]),[['remove','deleted']]);
  const [target] = data(candidate,'target');
  assert.deepEqual([target.mode,target.family,target.name,target.family_words],['existing','node','Grow','step']);
  assert.equal(data(candidate,'unread')[0].text,'from this tree');
});

test('derives a bare name family from its declared source and retains its written source selector', () => {
  const proposals = read('I need Review deleted from my schedule');
  assert.equal(proposals.length,1);
  const [candidate] = proposals;
  assert.deepEqual(data(candidate,'target').map(({family,name})=>[family,name]),[['meeting','Review']]);
  const [constraint] = data(candidate,'constraint');
  assert.deepEqual([constraint.attribute,constraint.phase,constraint.words,constraint.value],
    ['meeting.calendar','selector','from my schedule','my schedule']);
  assert.deepEqual(data(candidate,'unread'),[]);
  const requestKeys = w.requestKeys.map(key=>key.name==='meeting.calendar' ? {...key,head:'class'} : key);
  assert.deepEqual(read('I need Review deleted from my schedule',{...worlds,requestKeys}),[]);
});

test('reads another overlay family with no dependency on example nouns or names', () => {
  const lookup = phrase => phrase==='sensor' ? [['target','remove','instrument','existing','']] : w.lookup(phrase);
  const overlay = {...worlds,lookup,literalGrammar:{licenses:(family,act)=>family==='instrument' && act==='remove'}};
  const [candidate] = read('I need the "Air intake" sensor deleted',overlay);
  assert.deepEqual(data(candidate,'target').map(({family,name})=>[family,name]),[['instrument','Air intake']]);
});

test('rejects ungrounded, quoted, negative, perfect and coordinated lookalikes', () => {
  for (const text of [
    'I have the Grow step deleted', 'I’ll have deleted the Grow step', "I don't need the Grow step deleted",
    'I need the Grow step not deleted', 'I need the Grow step "deleted"', 'I need Review deleted',
    'I need the Grow step deleted from this tree; keep Start', 'I need the Grow step deleted if possible',
    'I need the Grow step deleted from this tree and the Start step changed',
  ]) assert.deepEqual(read(text),[],text);
});
