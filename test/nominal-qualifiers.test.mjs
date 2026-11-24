import assert from 'node:assert/strict';
import test from 'node:test';
import { parse } from '../src/schema.mjs';
import { tokens } from '../src/lexicon.mjs';
import { loadWorlds } from '../src/worlds.mjs';
import { modifierLearner,modifierReading } from '../src/nominal-modifiers.mjs';
import { nominalNumberReading } from '../src/nominal-number.mjs';
import { quotedSpans } from '../src/literal-roles.mjs';
const worlds=loadWorlds();
const candidate={sop:'@r w.request.request act=make\n@t w.request.target request=$r family=node mode=new sort=box sort_words=boxes'};
test('a numeral qualifying one noun keeps its written evidence',()=>{
  const count=text=>nominalNumberReading(text,candidate,worlds.nominalNumbers,quotedSpans(text));
  assert.match(count('create three boxes').sop,/count=3 quantity="three" count_words="three"/u);
  assert.match(count('find the first boxes').sop,/ordinal="first"/u);
  assert.equal(count('create a label "three boxes"'),undefined);
  assert.equal(count('create 0.5 boxes'),undefined);
  assert.match(count('create twenty-one boxes').sop,/count=21/u);
  assert.match(count('create half a dozen boxes').sop,/count=6/u);
});
test('independent training phrases license a property on a new noun with the same family',()=>{
  const learner=modifierLearner({requestKeys:[{name:'sample.finish',family:'sample',head:'class',values:[]}]});
  const [target,c]=parse('@t w.request.target family=sample sort=rod\n@c w.request.constraint attribute=sample.finish value=rough');
  learner.observe('add a rough rod',target,c);
  assert.deepEqual(learner.finish(),{});
  learner.observe('find the rough rod',target,c);
  const forms=learner.finish(),text='make a rough disk';
  const base={sop:'@r w.request.request act=make\n@t w.request.target request=$r family=sample mode=new sort=disk\n@u w.request.unread request=$r text=rough'};
  const reading=modifierReading(text,tokens(text),[],base,forms);
  assert.match(reading.sop,/attribute=sample.finish value=rough operator=eq phase=result/u);
  assert.doesNotMatch(reading.sop,/unread/u);
});

test('crosses an already grounded adjacent modifier only when its evidence and role agree',()=>{
  const forms={
    '["sample","medium"]':['sample.size','medium'],
    '["sample","brown"]':['sample.colour','brown'],
  };
  const head='@r w.request.request act=make\n@t w.request.target request=$r family=sample mode=new sort=baskets';
  const read=(text,binding)=>modifierReading(text,tokens(text),quotedSpans(text),
    {sop:head+'\n'+binding+'\n@u w.request.unread request=$r text=medium'},forms);
  const binding='@c w.request.constraint request=$r on=attribute attribute=sample.colour value=brown operator=eq phase=result';
  const text='make three medium brown baskets';
  const result=read(text,binding);
  assert.match(result.sop,/attribute=sample.size value=medium operator=eq phase=result/u);
  assert.equal(result.sop.match(/attribute=sample\.colour/gu).length,1);
  assert.doesNotMatch(result.sop,/w\.request\.unread/u);
  for (const conflict of [
    binding.replace('value=brown','value=red'),
    binding.replace('phase=result','phase=selector'),
    binding+' words="medium brown"',
    binding+' want=no',
    binding+'\n'+binding.replace('@c ','@other '),
  ]) assert.equal(read(text,conflict),undefined,conflict);
  assert.equal(read('make the brown, then three medium brown baskets',binding),undefined);
  assert.equal(read('make three medium, brown baskets',binding),undefined);
});
