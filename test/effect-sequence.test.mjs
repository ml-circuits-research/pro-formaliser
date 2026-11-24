import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createEffectSequence } from '../src/effect-sequence.mjs';
import { ownedEffectReadings } from '../src/owned-effects.mjs';
import { parse } from '../src/schema.mjs';
import { loadWorlds } from '../src/worlds.mjs';

const worlds=loadWorlds();
const scale='set the colour bar scale logarithmic';
const font='make the font bigger';
const grid='set the grid lines off';
const aside='that completes the adjustment';
const example=(left,right,lead='')=>({
  text:left+', '+aside+', '+lead+right,
  sop:'@r1 w.request.request act=change mood=do words='+JSON.stringify(left)+'\n'+
    '@r2 w.request.request act=change mood=do words='+JSON.stringify(right)+'\n'+
    '@f w.request.filler text='+JSON.stringify(aside),
});
const readNative=part=>{
  const [first,...alternatives]=ownedEffectReadings(part,worlds);
  return first && {...first,alternatives};
};
const field=(wire,key)=>{
  const value=wire.attrs[key]?.[0];
  return value?.startsWith('"') ? JSON.parse(value) : value;
};
const fields=(sop,type,key)=>parse(sop).filter(w=>w.type==='w.request.'+type).map(w=>field(w,key));

test('composes standalone typed effects across sentence punctuation',async()=>{
  const read=createEffectSequence(worlds);
  const input=scale+'. '+font;
  const proposals=await read(input,readNative);
  assert.equal(proposals.length,1);
  const {sop}=proposals[0];
  assert.deepEqual(fields(sop,'request','words'),[input]);
  assert.deepEqual(fields(sop,'constraint','attribute'),['chart.colourBarScale','chart.fontSize']);
  assert.deepEqual(fields(sop,'constraint','operator'),['eq','delta']);
  assert.deepEqual(fields(sop,'target','fill'),['context']);
});

test('keeps a corroborated interlude without learning it from one repeated example',async()=>{
  const one=example(grid,font,'could you also ');
  const input=scale+', '+aside+', '+grid;
  const insufficient=createEffectSequence(worlds,[one,one]);
  assert.deepEqual(await insufficient(input,readNative),[]);
  const read=createEffectSequence(worlds,[one,example(font,scale)]);
  const [proposal]=await read(input,readNative);
  assert.deepEqual(fields(proposal.sop,'filler','text'),[aside]);
  assert.deepEqual(fields(proposal.sop,'constraint','attribute'),['chart.colourBarScale','chart.gridlines']);
  assert.deepEqual(await read(scale+', move the table, '+grid,readNative),[]);
  assert.deepEqual(await read(scale+', "'+aside+', '+grid+'"',readNative),[]);
  assert.deepEqual(await read('if appropriate, '+scale+'. '+font,readNative),[]);
});

function namedCandidate(text,reading,owner,head) {
  const native=readNative(reading).sop.replace('words='+JSON.stringify(reading),'words='+JSON.stringify(text));
  return {sop:native.replace('fill=context',owner ? 'fill=written name='+JSON.stringify(owner) : 'fill=context')
    .replace(/predicate="[^"]+"/u,'predicate='+JSON.stringify(head))};
}

test('keeps separate named owners and grounds an explicit anaphor only on a preceding owner',async()=>{
  const first='set the colour bar scale logarithmic for Claims';
  const other='make the font bigger on Revenue';
  const linked='make it a bigger font';
  const elliptical='font bigger';
  const read=createEffectSequence(worlds);
  const clauses={
    [first]:namedCandidate(first,scale,'Claims','set'),
    [other]:namedCandidate(other,font,'Revenue','make'),
    [linked]:namedCandidate(linked,font,undefined,'make'),
    [elliptical]:{sop:namedCandidate(elliptical,font,undefined,'make').sop.replace(' predicate="make"','')},
  };
  const [separate]=await read(first+'; '+other,part=>clauses[part]);
  assert.deepEqual(fields(separate.sop,'target','name'),['Claims','Revenue']);
  assert.equal(fields(separate.sop,'request','act').length,2);
  const [shared]=await read(first+'; '+linked,part=>clauses[part]);
  assert.deepEqual(fields(shared.sop,'target','name'),['Claims']);
  assert.equal(fields(shared.sop,'constraint','attribute').length,2);
  const [withEllipsis]=await read(first+'. '+elliptical,part=>clauses[part]);
  assert.deepEqual(fields(withEllipsis.sop,'target','name'),['Claims']);
  assert.deepEqual(await read(first+'; '+font,part=>clauses[part] ?? readNative(part)),[]);
});

test('rejects a partial learned packet that silently drops substantive words',async()=>{
  const tail=font+' and disable highlights';
  const [native]=ownedEffectReadings(font,worlds);
  const ungrounded={...native,source:'template'};
  const run=createEffectSequence(worlds);
  const proposals=await run(scale+'. '+tail,part=>part===tail ? ungrounded : readNative(part));
  assert.deepEqual(proposals,[]);
});

test('an open flag in a donor cannot promote a colour into a closed line-style value',async()=>{
  const text='set the grid lines purple';
  const bad=readNative('set the grid lines to solid').sop.replaceAll('set the grid lines to solid',text)
    .replace('words="solid"','words="purple"').replace('value=solid','value=purple open_value=true');
  const read=createEffectSequence(worlds);
  assert.deepEqual(await read(text+'. '+font,part=>part===text ? {sop:bad} : readNative(part)),[]);
});
