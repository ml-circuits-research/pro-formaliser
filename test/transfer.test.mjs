import assert from 'node:assert/strict';
import test from 'node:test';
import { createTransfer } from '../src/transfer.mjs';

const request = '@r w.request.request act=change mood=do';
const bank = { fillerPhrases: [
  { text: 'please', class: 'politeness' },
  { text: 'um', class: 'filler' },
  { text: 'thanks', class: 'politeness' },
] };
const target = '@t w.request.target request=$r family=shape mode=existing';

test('transfers an aligned request across punctuation, courtesy and case with input evidence', () => {
  const lookup = createTransfer([{
    text: 'Please, paint the circle blue. Thanks!',
    sop: '@f w.request.filler text=Please\n' +
      request + ' predicate=paint words="paint the circle blue"\n' +
      target + ' sort=circle\n' +
      '@c w.request.constraint request=$r on=attribute attribute=shape.colour value=blue',
    count: 4,
  }], bank);
  const [answer] = lookup('Um, PAINT the circle blue!');
  assert.equal(answer.source, 'alignment');
  assert.equal(answer.support, 4);
  assert.match(answer.sop, /predicate=PAINT words="PAINT the circle blue"/);
  assert.match(answer.sop, /w.request.filler text=Um/);
  assert.doesNotMatch(answer.sop, /text=(Please|Thanks)\b/);
  assert.deepEqual(lookup('Do not paint the circle blue!'), []);
  assert.deepEqual(lookup('paint the circle blue; remove it'), []);
  assert.deepEqual(lookup('paint the circle green'), []);
});

test('omits request words when the aligned evidence covers the entire input', () => {
  const lookup = createTransfer([{
    text: 'Please, paint the circle!',
    sop: request + ' predicate=paint words="paint the circle"\n' + target + ' sort=circle',
  }], bank);
  assert.equal(lookup('paint the circle')[0].sop, request + ' predicate=paint\n' + target + ' sort=circle');
});

test('copies numeric and delimited content only into aligned slots and source evidence', () => {
  const lookup = createTransfer([{
    text: 'Move the rectangle by 25 pixels',
    sop: request + ' predicate=Move words="Move the rectangle by 25 pixels"\n' +
      target + ' sort=rectangle\n' +
      '@c w.request.constraint request=$r on=attribute attribute=shape.offset value="25" measure=25 measure_words="25" words="25 pixels"',
  }, {
    text: 'write the heading as “Winter”',
    sop: request + ' predicate=write\n' +
      '@c w.request.constraint request=$r on=attribute attribute=heading.text value=Winter',
  }]);
  const [numeric] = lookup('Move the rectangle by 32.5 pixels.');
  assert.match(numeric.sop, /value="32\.5" measure=32\.5 measure_words="32\.5" words="32\.5 pixels"/);
  assert.match(lookup('write the heading as "Ice Age"')[0].sop, /value="Ice Age"/);
  assert.deepEqual(lookup('Move the rectangle by 32 pixels or a mile'), []);
  assert.deepEqual(lookup('write the heading as "Winter" and clear the page'), []);
});

test('uses scoped world evidence for a closed canonical substitution', () => {
  const lookup = createTransfer([{
    text: 'paint the circle blue',
    sop: request + ' predicate=paint\n' + target + ' sort=circle\n' +
      '@c w.request.constraint request=$r on=attribute attribute=shape.colour value=blue words="blue"',
  }], {
    resolveValue({ type, key, family, attribute, surface }) {
      if (type === 'w.request.constraint' && key === 'value' && family === 'shape' &&
          attribute === 'shape.colour' && surface === 'aqua blue') return 'cyan';
    },
  });
  const [answer] = lookup('paint the circle aqua blue');
  assert.match(answer.sop, /value=cyan words="aqua blue"/);
  assert.deepEqual(lookup('paint the rectangle aqua blue'), []);
});

test('keeps separate readings and declines to reuse prior-turn content', () => {
  const answer = suffix => ({
    text: 'set it up',
    sop: request + ' predicate=set\n' + target + ' sort=' + suffix,
  });
  const context = {
    text: ' set it up',
    sop: answer('history').sop + '\n@p w.request.previous text="delete it"',
    count: 9,
  };
  const lookup = createTransfer([answer('square'), answer('circle'), context], bank);
  assert.equal(lookup('Please, set it up!').length, 2);
  assert.deepEqual(lookup('Please, set it down.'), []);
});

test('transfers a changed predicate only when the same canonical act is independently supported', () => {
  const lookup = createTransfer([{
    text: 'recolour the circle blue',
    sop: request + ' predicate=recolour words="recolour the circle blue"\n' +
      target + ' sort=circle\n' +
      '@c w.request.constraint request=$r on=attribute attribute=shape.colour value=blue',
  }], {
    ...bank,
    resolveValue({ key, act, mode, mood, oldSurface, surface }) {
      if (key === 'predicate' && act === 'change' && !mode && mood === 'do' &&
          oldSurface === 'recolour' && surface === 'paint') return 'change';
      if (key === 'predicate' && surface === 'erase') return 'remove';
    },
  });
  assert.match(lookup('Please, paint the circle blue.')[0].sop, /predicate=paint words="paint the circle blue"/);
  assert.deepEqual(lookup('erase the circle blue'), []);
  assert.deepEqual(lookup('do not paint the circle blue'), []);
});

test('maps orthographic equivalents back to precise input spans', () => {
  const lookup = createTransfer([{
    text: 'Paint the café icon',
    sop: request + ' predicate=Paint words="Paint the café icon"\n' + target + ' sort=icon',
  }], bank);
  const [answer] = lookup('Please, PAINT the cafe\u0301 icon！');
  assert.match(answer.sop, /predicate=PAINT words="PAINT the cafe\u0301 icon"/);
});

test('extracts complete clause circuits with their local targets and constraints', () => {
  const lookup = createTransfer([{
    text: 'paint the circle blue then erase the square',
    sop: request + ' predicate=paint words="paint the circle blue"\n' +
      target + ' sort=circle\n' +
      '@c w.request.constraint request=$r on=attribute attribute=shape.colour value=blue\n' +
      '@r2 w.request.request act=remove mood=do predicate=erase words="erase the square"\n' +
      '@t2 w.request.target request=$r2 family=shape mode=existing sort=square',
    count: 3,
  }], bank);
  const [first] = lookup('paint the circle blue');
  const [second] = lookup('erase the square');
  assert.match(first.sop, /attribute=shape.colour value=blue/);
  assert.doesNotMatch(first.sop, /erase|square/);
  assert.match(second.sop, /act=remove mood=do predicate=erase/);
  assert.doesNotMatch(second.sop, /paint|circle|blue/);
  assert.equal(second.support, 3);
});

test('declines clauses with cross-request references or inherited names', () => {
  const lookup = createTransfer([{
    text: 'draw a circle then reposition it',
    sop: '@r1 w.request.request act=make mood=do predicate=draw words="draw a circle"\n' +
      '@t1 w.request.target request=$r1 family=shape mode=new sort=circle\n' +
      '@r2 w.request.request act=place mood=do predicate=reposition words="reposition it"\n' +
      '@t2 w.request.target request=$r2 family=shape mode=bound name=circle\n' +
      '@r2.l w.request.lookup request=$r2 target=$t1 key=thing from=page',
  }]);
  assert.deepEqual(lookup('reposition it'), []);
  assert.deepEqual(lookup('draw a circle'), []);
});

test('keeps declared filler and contextual framing in exact input spelling', () => {
  const lookup = createTransfer([{
    text: 'move the circle with, uh, care',
    sop: request + ' predicate=move\n' + target + ' sort=circle\n' +
      '@f w.request.filler text=uh',
  }], { fillerPhrases: [...bank.fillerPhrases, { text: 'about the draft', class: 'context' }] });
  const [answer] = lookup('About the Draft, move the circle with, UH, care. Thanks!');
  assert.equal(answer.unread, 'About the Draft');
  assert.match(answer.sop, /w.request.unread text="About the Draft" request=\$r/);
  assert.match(answer.sop, /w.request.filler text=UH/);
  assert.match(answer.sop, /w.request.filler text=Thanks/);
  assert.deepEqual(lookup('About the Draft move the circle with, uh, care'), []);
  assert.deepEqual(lookup("Don't, move the circle with, uh, care"), []);
  assert.deepEqual(lookup('move the circle with, uh, care; delete it'), []);
});

test('keeps a written predicate with adjacent independently typed arguments',()=>{
  const lookup=createTransfer([{
    text:'paint sphere red',
    sop:request+' predicate=paint\n'+target+' sort=sphere\n'+
      '@c w.request.constraint request=$r on=attribute attribute=shape.colour value=red',
  }],{
    typedSlot:field=>field.key==='sort' || field.attribute==='shape.colour',
    resolveValue({key,surface}) {
      if (key==='sort' && surface==='cube') return 'cube';
      if (key==='value' && surface==='deep blue') return 'blue';
    },
  });
  const [found]=lookup('paint cube deep blue');
  assert.match(found.sop,/sort=cube/);
  assert.match(found.sop,/value=blue words="deep blue"/);
  assert.deepEqual(lookup('paint street deep blue'),[]);
  assert.deepEqual(lookup('erase cube deep blue'),[]);
});
