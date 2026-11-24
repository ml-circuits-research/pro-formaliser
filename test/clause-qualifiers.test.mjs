import test from 'node:test';
import assert from 'node:assert/strict';
import { clauseQualifiers } from '../src/clause-qualifiers.mjs';
import { predicateModeLearner } from '../src/predicate-modes.mjs';
import { loadWorlds } from '../src/worlds.mjs';
import { parse,validate } from '../src/schema.mjs';
import { evidenceInText } from '../src/grounding.mjs';

test('qualifies each target inside its own request span',()=>{
  const words='draw a big cat then draw two dogs';
  const base={sop:[
    '@a w.request.request act=make mood=do words="draw a big cat" predicate=draw',
    '@a.t w.request.target request=$a family=drawn mode=new sort=cat',
    '@b w.request.request act=make mood=do words="draw two dogs" predicate=draw',
    '@b.t w.request.target request=$b family=drawn mode=new sort=dog sort_words=dogs',
  ].join('\n')};
  const worlds=loadWorlds();
  const enrich=clauseQualifiers(words,worlds,{modifiers:{'["drawn","big"]':['drawn.size','big']}},()=>true);
  const candidate=enrich(base);
  assert.ok(validate(candidate.sop,worlds) && evidenceInText(words,candidate.sop,worlds));
  const wires=parse(candidate.sop);
  assert.deepEqual(wires.find(w=>w.attrs.count)?.attrs.request,['$b']);
  assert.deepEqual(wires.find(w=>w.attrs.attribute)?.attrs.request,['$a']);
});
test('narrow operation names need evidence on the same action and family',()=>{
  const modes=predicateModeLearner();
  for (const [text,pred,mode] of [['reverse the link','reverse','reverse'],['reverse this link','reverse','reverse'],
    ['reverse a link','reverse',undefined],['change this link','change','reverse'],['change a link','change',undefined]]) {
    modes.observe(text,'link','change',pred,mode);
  }
  assert.deepEqual(modes.finish(),{'["reverse","change","link"]':'reverse'});
});
