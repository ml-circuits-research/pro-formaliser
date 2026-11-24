import assert from 'node:assert/strict';
import test from 'node:test';
import { identitySelectorReadings } from '../src/identity-selectors.mjs';
import { evidenceInText } from '../src/grounding.mjs';
import { parse, validate } from '../src/schema.mjs';
import { loadWorlds } from '../src/worlds.mjs';

const base = loadWorlds();
const worlds = {...base,
  selectorKeys:new Map([['part',new Set(['part.ids'])],['rig',new Set(['rig.inventory'])]]),
  identityAssignmentVerbs:new Set(['rename','call']),
};
const circuit = (family='part', predicate='set', mode='existing') =>
  '@r w.request.request act=change mood=do predicate='+predicate+'\n'+
  '@t w.request.target request=$r family='+family+' mode='+mode+' fill=written';
const ids = (value, words, extra='') => '@i w.request.constraint request=$r on=attribute attribute=part.ids value='+
  JSON.stringify(value)+' operator=eq phase=result'+(words ? ' words='+JSON.stringify(words) : '')+extra;
const size = '@p w.request.constraint request=$r on=size attribute=part.size value=small operator=degree phase=result';
const variant = '@p w.request.constraint request=$r on=attribute attribute=part.variant value=blush operator=eq phase=result key_words=variant';
const read = (text,sop) => identitySelectorReadings(text,{sop,source:'example'},worlds);

test('promotes a definite written identity and preserves the independent result', () => {
  const text='make the head small size';
  const fixture=[circuit('part','make'),ids('head'),size].join('\n');
  const [answer]=read(text,fixture);
  const wires=parse(answer.sop);
  assert.equal(wires.find(w=>w.id==='i').attrs.phase[0],'selector');
  assert.deepEqual(wires.find(w=>w.id==='p').attrs,parse(fixture).find(w=>w.id==='p').attrs);
  assert.equal(parse(fixture).find(w=>w.id==='i').attrs.phase[0],'result');
  assert.ok(validate(answer.sop,base));
  assert.ok(evidenceInText(text,answer.sop,base));
});

test('uses a nominal head after an exact quoted selector and supports unrelated declared keys', () => {
  const text='please set the "cheeks" part using the blush variant';
  const [answer]=read(text,[circuit()+' family_words=part',ids('cheeks','"cheeks"'),variant].join('\n'));
  assert.match(answer.sop,/part\.ids value="cheeks" operator=eq phase=selector/u);
  assert.match(answer.sop,/part\.variant value=blush operator=eq phase=result/u);
  const rig=[circuit('rig'),
    '@i w.request.constraint request=$r on=attribute attribute=rig.inventory value=SAT17 operator=eq phase=result',
    '@p w.request.constraint request=$r on=attribute attribute=rig.profile value=calm operator=eq phase=result',
  ].join('\n');
  assert.match(read('set the SAT17 calm',rig)[0].sop,/rig\.inventory value=SAT17 operator=eq phase=selector/u);
});

test('binds identity before a catalog-licensed result marker across families', () => {
  const drawing=[circuit()+' family_words=part',ids('shoulders','"shoulders"'),variant.replace('blush','apron')].join('\n');
  const [part]=read('set the "shoulders" part to the apron variant',drawing);
  assert.match(part.sop,/part\.ids value="shoulders" operator=eq phase=selector/u);
  assert.match(part.sop,/part\.variant value=apron operator=eq phase=result/u);
  assert.ok(validate(part.sop,base));
  assert.ok(evidenceInText('set the "shoulders" part to the apron variant',part.sop,base));

  const rig=[circuit('rig')+' family_words=rig',
    '@i w.request.constraint request=$r on=attribute attribute=rig.inventory value=SAT17 operator=eq phase=result',
    '@p w.request.constraint request=$r on=attribute attribute=rig.profile value=calm operator=eq phase=result',
  ].join('\n');
  const [inventory]=read('set the SAT17 rig to calm',rig);
  assert.match(inventory.sop,/rig\.inventory value=SAT17 operator=eq phase=selector/u);
  assert.deepEqual(read('set the SAT17 rig in calm',rig),[]);
  assert.deepEqual(read('set the SAT17 rig to unsettled',rig),[]);
});

test('does not promote payloads, assignments, stale evidence or overlapping scopes', () => {
  const positive=[circuit(),ids('head'),size].join('\n');
  assert.deepEqual(read('set the head', [circuit(),ids('head')].join('\n')),[]);
  assert.deepEqual(read('set small size to the head',positive),[]);
  assert.deepEqual(read('rename the head small',positive.replace('predicate=set','predicate=rename')),[]);
  assert.deepEqual(read('do not set the head small',positive),[]);
  assert.deepEqual(read("don't set the head small",positive),[]);
  assert.deepEqual(read('set the head small if ready',positive),[]);
  assert.deepEqual(read('set the head small. Confirm later',positive),[]);
  assert.deepEqual(read('set the head small beside the head',positive),[]);
  assert.deepEqual(read('set the head small',positive.replace('mode=existing','mode=new')),[]);
  assert.deepEqual(read('set the head small',positive.replace('part.ids','part.name')),[]);
  assert.deepEqual(read('set the font colour small',[circuit(),ids('font colour'),size].join('\n')),[]);
  assert.deepEqual(read('set the head small',[circuit(),ids('head',undefined,' key_words=the'),size].join('\n')),[]);
  assert.deepEqual(read('set the head small',positive+'\n@j w.request.constraint request=$r on=attribute attribute=part.ids value=head operator=eq phase=selector'),[]);
});
