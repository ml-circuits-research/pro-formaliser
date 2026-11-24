import assert from 'node:assert/strict';
import test from 'node:test';
import { createNearExample } from '../src/near-example.mjs';

const request = '@r w.request.request act=change mood=do predicate=paint';
const target = '@t w.request.target request=$r family=shape sort=circle';
const source = (text, sop, count) => ({text, sop, count});
const discourse = [{text:'please', class:'politeness'}, {text:'thanks', class:'politeness'},
  {text:'um', class:'interjection'}, {text:'now', class:'filler'}];

test('anchors the full body and replaces boundary courtesy with input evidence', () => {
  const lookup = createNearExample([
    source('um, paint the circle, thanks.', [
      request + ' words="um, paint the circle, thanks."', target,
      '@near.f1 w.request.filler text=um', '@f w.request.filler text=thanks',
    ].join('\n'), 4),
  ], {discourse});
  const [answer] = lookup('paint the circle please!');
  assert.equal(answer.support, 4);
  assert.match(answer.sop, /words="paint the circle"/);
  assert.match(answer.sop, /@near\.f2 w\.request\.filler text="please"/);
  assert.doesNotMatch(answer.sop, /um|thanks/);
  assert.deepEqual(lookup('paint the square please!'), []);
  assert.deepEqual(lookup('paint the circle now'), []);
  assert.deepEqual(lookup('paint the circle please?'), []);
  assert.deepEqual(lookup('do not paint the circle please'), []);
});

test('retains existing unread content and question punctuation', () => {
  const lookup = createNearExample([
    source('can you paint the circle sideways?', [
      request, target, '@u w.request.unread request=$r text=sideways',
    ].join('\n')),
  ], {discourse});
  const [answer] = lookup('can you paint the circle sideways, please?');
  assert.equal(answer.unread, 'sideways');
  assert.match(answer.sop, /w\.request\.unread request=\$r text=sideways/);
  assert.deepEqual(lookup('can you paint the circle sideways please.'), []);
});

test('rejects a transfer that would drop a value or evidence from the source', () => {
  const lookup = createNearExample([
    source('paint the circle please', [request, target,
      '@c w.request.constraint request=$r attribute=shape.colour value="please"'].join('\n')),
    source('paint the circle thanks', [request, target,
      '@t2 w.request.target request=$r name=thanks'].join('\n')),
  ], {discourse});
  assert.deepEqual(lookup('paint the circle.'), []);
});
