import assert from 'node:assert/strict';
import {test} from 'node:test';
import {loadWorlds} from '../src/worlds.mjs';
import {parse} from '../src/schema.mjs';
import {maskQuoted} from '../src/literal-roles.mjs';
import {requestScope} from '../src/request-scope.mjs';
import {sentenceRequestReadings} from '../src/sentence-requests.mjs';

const worlds=loadWorlds();
const permit=(text,quotes)=>!requestScope(text,maskQuoted(text,quotes),worlds,[]).preventsSplitting;
const sop=(...lines)=>[{sop:lines.join('\n')}];
const title=text=>sop(
  '@r w.request.request act=change mood=do predicate=Title',
  '@t w.request.target request=$r family=chart mode=existing fill=context',
  '@k w.request.lookup request=$r target=$t key=thing from=page',
  '@c w.request.constraint request=$r on=attribute attribute=chart.title value='+JSON.stringify(text)+' operator=eq phase=result'
);

test('combines separate typed sentences without changing a question into an edit',async ()=>{
  const text='What colour is the tree? Title Sensor readings.';
  const inputs=[];
  const candidates=await sentenceRequestReadings(text,worlds,async fragment=>{
    inputs.push(fragment);
    if (fragment.startsWith('What')) return sop(
      '@r w.request.request act=ask mood=ask predicate="What colour" question=what asked=drawn.colour',
      '@t w.request.target request=$r family=drawn mode=existing fill=description sort=tree'
    );
    return title('Sensor readings');
  },permit);
  assert.deepEqual(inputs,['What colour is the tree?','Title Sensor readings.']);
  const wires=parse(candidates[0].sop);
  assert.deepEqual(wires.filter(wire=>wire.type==='w.request.request').map(wire=>wire.attrs.act[0]),['ask','change']);
  assert.ok(wires.some(wire=>wire.attrs.target?.[0]==='$sentence2.t'));
});

test('keeps quoted punctuation and decimal values inside their original sentence',async ()=>{
  const first='Title "Version 9.2. Pilot".';
  const second='Title Sensor readings.';
  const inputs=[];
  const candidates=await sentenceRequestReadings(first+' '+second,worlds,async fragment=>{
    inputs.push(fragment);
    return title(fragment===first ? 'Version 9.2. Pilot' : 'Sensor readings');
  },permit);
  assert.deepEqual(inputs,[first,second]);
  assert.ok(candidates[0].sop.includes('value="Version 9.2. Pilot"'));
});

test('rejects dependent and ungrounded fragments',async ()=>{
  for (const text of [
    'If the chart is visible, title Sensor readings. Remove the chart.',
    'Do not remove the chart. Title Sensor readings.'
  ]) {
    const candidates=await sentenceRequestReadings(text,worlds,async()=>assert.fail('guarded text was split'),permit);
    assert.deepEqual(candidates,[],text);
  }
  const candidates=await sentenceRequestReadings('Title Sensor readings. Produce something else.',worlds,
    async fragment=>fragment.startsWith('Title') ? title('Sensor readings') : sop(
      '@r w.request.request act=make mood=do predicate=Produce',
      '@u w.request.unread request=$r text="something else"'
    ),permit);
  assert.deepEqual(candidates,[]);
});
