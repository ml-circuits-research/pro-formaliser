import assert from 'node:assert/strict';
import test from 'node:test';
import { sequenceNameReadings } from '../src/sequence-names.mjs';
import { loadWorlds } from '../src/worlds.mjs';
import { validate } from '../src/schema.mjs';
import { evidenceInText } from '../src/grounding.mjs';

test('the same alternative both creates the named object and places it by its written name',()=>{
  const worlds=loadWorlds();
  const parts=['add a fish called dog','put dog below bench'];
  const result={source:'lexicon',sop:[
    '@r w.request.request act=make predicate=add',
    '@t w.request.target request=$r family=drawn mode=new sort=fish',
    '@n w.request.constraint request=$r on=attribute attribute=drawn.name operator=eq phase=result value=dog'
  ].join('\n'),alternatives:[]};
  const readings=sequenceNameReadings(parts,[result],worlds,{});
  assert.ok(readings.some(r=>validate(r.sop,worlds) && evidenceInText(parts.join('; then '),r.sop,worlds) &&
    r.sop.includes('name=dog') && r.sop.includes('value=bench')));
  assert.deepEqual(sequenceNameReadings([parts[0],'put cat below bench'],[result],worlds,{}),[]);
});
