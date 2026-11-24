import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evidenceInText } from '../src/grounding.mjs';
import { tokens } from '../src/lexicon.mjs';
import { quotedSpans } from '../src/literal-roles.mjs';
import { createNominalPhraseLearner, nominalPhraseReadings } from '../src/nominal-phrases.mjs';
import { parse, validate } from '../src/schema.mjs';
import { loadWorlds } from '../src/worlds.mjs';

const worlds=loadWorlds();
const request='@r w.request.request act=make mood=do predicate=draw';
const target=sort=>'@t w.request.target request=$r family=drawn mode=new sort='+sort;
const expression='@fa w.request.constraint request=$r on=attribute attribute=drawn.expression value=shocked key_words=face operator=eq phase=result';
const posture='@po w.request.constraint request=$r on=attribute attribute=drawn.pose value=standing operator=eq phase=result';
const facing='@fi w.request.constraint request=$r on=attribute attribute=drawn.facing value=right key_words=facing operator=eq phase=result';
const unread=words=>'@u w.request.unread request=$r text='+JSON.stringify(words);
const quote=v=>v.startsWith('"') ? JSON.parse(v) : v;
const constraints=sop=>parse(sop).filter(w=>w.type==='w.request.constraint').map(w=>
  [quote(w.attrs.attribute[0]),quote(w.attrs.value[0]),w.attrs.words && quote(w.attrs.words[0])]);

function train(suffix, fields, sorts=['boy','girl']) {
  const learner=createNominalPhraseLearner(worlds);
  for (const sort of sorts) {
    const [req,thing,...properties]=parse([request,target(sort),...fields].join('\n'));
    learner.observe('draw a '+sort+' '+suffix,thing,properties,req);
  }
  return learner.finish();
}
function read(text,sop,forms) {
  return nominalPhraseReadings(text,tokens(text),quotedSpans(text),{sop:sop.join('\n')},forms,worlds);
}

test('binds attested named-value, bare and split-key adjuncts in one reading',()=>{
  const tail='with a shocked face standing facing right';
  const forms=train(tail,[expression,posture,facing]);
  assert.deepEqual(train(tail,[expression,posture,facing],['boy','boy']),{});
  const text='draw a robot with a shocked face standing facing right';
  const [reading]=read(text,[request,target('robot'),unread(tail)],forms);
  assert.deepEqual(constraints(reading.sop),[
    ['drawn.expression','shocked','with a shocked face'],
    ['drawn.pose','standing','standing'],
    ['drawn.facing','right','facing right'],
  ]);
  assert.ok(validate(reading.sop,worlds));
  assert.ok(evidenceInText(text,reading.sop,worlds));
  assert.doesNotMatch(reading.sop,/w\.request\.unread/u);
  assert.deepEqual(train('with a curious face',[expression.replace('value=shocked','value=curious open_value=true')]),{});
});

test('crosses grounded details without duplicating them and stops at a conflicting binding',()=>{
  const forms=train('facing right',[facing]);
  const text='draw a robot standing facing right';
  const base=[request,target('robot'),posture,unread('facing right')];
  const [reading]=read(text,base,forms);
  assert.deepEqual(constraints(reading.sop),[
    ['drawn.pose','standing',undefined],
    ['drawn.facing','right','facing right'],
  ]);
  assert.deepEqual(read(text,base.with(2,posture.replace('phase=result','phase=selector')),forms),[]);
  assert.deepEqual(read(text,[...base,'@other'+posture.slice(3).replace('value=standing','value=sitting')+' words=standing'],forms),[]);
  assert.deepEqual(read('draw a robot standing, facing right',base,forms),[]);
  assert.deepEqual(read('draw a robot standing facing right if held',base,forms),[]);
});

test('preserves an owned placement between two independently learned adjuncts',()=>{
  const forms={...train('with a shocked face',[expression]),...train('standing',[posture])};
  const text='draw a robot with a shocked face just next to the bridge standing';
  const relation='@p w.request.constraint request=$r on=place attribute=drawn.relation value=near words="next to" operator=relation phase=result';
  const anchor='@a w.request.constraint request=$r on=place attribute=drawn.anchor value="the bridge" operator=relation phase=selector';
  const base=[request,target('robot'),relation,anchor,unread('with a shocked face just'),
    '@u2 w.request.unread request=$r text=standing'];
  const [reading]=read(text,base,forms);
  assert.deepEqual(constraints(reading.sop),[
    ['drawn.relation','near','next to'],
    ['drawn.anchor','the bridge',undefined],
    ['drawn.expression','shocked','with a shocked face'],
    ['drawn.pose','standing','standing'],
  ]);
  assert.match(reading.sop,/w\.request\.unread request=\$r text="just"/u);
  assert.ok(validate(reading.sop,worlds));
  assert.ok(evidenceInText(text,reading.sop,worlds));
  assert.deepEqual(read(text,base.with(3,anchor.replace('the bridge','the path')),forms),[]);
});
