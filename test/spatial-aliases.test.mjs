import test from 'node:test';
import assert from 'node:assert/strict';
import { loadWorlds } from '../src/worlds.mjs';
import { spatialAliases } from '../src/spatial-aliases.mjs';

test('native preposition synonyms inherit the place role of the attested marker', () => {
  const worlds = loadWorlds();
  assert.ok(worlds.lookup('alongside').some(([type,act,role,relation]) =>
    type === 'marker' && act === 'place' && role === 'place' && relation === 'near'));
  assert.ok(!worlds.lookup('anything').some(([type,,,relation]) => type === 'marker' && relation === 'near'));
});

test('fixed meaning needs corroboration and a place operand', () => {
  const words = {attrs:{frame:['f'],at:['1'],is:['word'],word:['base','other','alias']}};
  const operand = {attrs:{frame:['f'],at:['2'],is:['role'],role:['place'],takes:['words']}};
  const fixed = {attrs:{frame:['f'],role:['rel'],value:['base']}};
  const facts = type => type === 'w.lang.en.part' ? [words,operand] : [fixed];
  const spatial = new Map([['base',['close']],['other',['close']]]);
  const read = () => spatialAliases(facts,spatial,(w,k) => w.attrs[k] ?? [],s => s);
  assert.deepEqual(read(),[['alias','close','base']]);
  operand.attrs.role = ['payload'];
  assert.deepEqual(read(),[]);
  operand.attrs.role = ['place'];
  spatial.delete('other');
  assert.deepEqual(read(),[]);
});
