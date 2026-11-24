import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parse } from '../src/schema.mjs';
import { compileTrailingDiscourse, discourseBody } from '../src/trailing-discourse.mjs';

function compile(...sources) {
  const wires=parse(sources.join('\n'));
  return compileTrailingDiscourse(type=>wires.filter(wire=>wire.type===type));
}

const base=readFileSync(new URL('../sop-worlds/pro.reader/discourse.sop',import.meta.url),'utf8');

test('a declared final sentence preserves imperative, question and sequential body evidence',()=>{
  const index=compile(base);
  for (const [input,body,suffix] of [
    ['  Draw the chair. That would help.  ','Draw the chair.','That would help.'],
    ['What is connected to François? I appreciate it.','What is connected to François?','I appreciate it.'],
    ['Move the chair. Then label it “Ready!”. Thanks. That would help.',
      'Move the chair. Then label it “Ready!”.','Thanks. That would help.'],
    ['Draw the chair! That would help','Draw the chair!','That would help'],
  ]) {
    const reading=discourseBody(input,index);
    assert.equal(reading.text,body);
    assert.equal(input.slice(reading.start,reading.end),body);
    assert.equal(reading.suffix,suffix);
  }
});

test('an overlay can declare an arbitrary pragmatic tail with original spelling retained',()=>{
  const index=compile('@ack pro.reader.trailing_discourse text="Duly noted, editor" text="Duly noted"');
  assert.deepEqual(discourseBody('🧭 Mark the chart. Duly Noted.',index),{
    text:'🧭 Mark the chart.',start:0,end:'🧭 Mark the chart.'.length,suffix:'Duly Noted.',
  });
  assert.equal(discourseBody('Mark the chart. Duly noted, editor.',index).suffix,'Duly noted, editor.');
  assert.equal(discourseBody('Mark the chart. Duly noted, colleague.',index),undefined);
});

test('embedded text, unclosed quotes and additional actions are not stripped',()=>{
  const index=compile(base);
  for (const input of [
    'Label the chart “That would help.”',
    'Label the chart "Status. That would help.',
    '“Delete these.” That would help.',
    'Label the chart That would help.',
    'Draw the chart, that would help.',
    'Draw the chart. That would help?',
    'Draw the chart. That would help. Delete another chart.',
  ]) assert.equal(discourseBody(input,index),undefined,input);
});
