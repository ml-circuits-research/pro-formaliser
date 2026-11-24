import assert from 'node:assert/strict';
import {test} from 'node:test';
import {numberedQualifierReadings} from '../src/numbered-qualifier.mjs';
import {loadWorlds} from '../src/worlds.mjs';
import {parse} from '../src/schema.mjs';

const worlds=loadWorlds();
const fields=(candidate,type)=>parse(candidate.sop).filter(wire=>wire.type==='w.request.'+type)
  .map(wire=>Object.fromEntries(Object.entries(wire.attrs).map(([slot,[value]])=>
    [slot,value.startsWith('"') ? JSON.parse(value) : value])));
const request='@r w.request.request ';
const target='@t w.request.target request=$r ';
const unread='@u w.request.unread request=$r text=';
const read=(text,sop,w=worlds)=>numberedQualifierReadings(text,{sop},w);

test('grounds each explicit numeric result for an independently bound node',()=>{
  const text='set n1 width 180 height ninety';
  const sop=request+'act=change mood=do predicate=set\n'+target+'family=node mode=existing fill=written ids=n1\n'+
    unread+'"width 180 height ninety"';
  const [candidate]=read(text,sop);
  assert.equal(fields(candidate,'target')[0].ids,'n1');
  assert.deepEqual(fields(candidate,'constraint').map(({attribute,value,words,phase})=>[attribute,value,words,phase]),
    [['node.width','180',undefined,'result'],['node.height','90','ninety','result']]);
  assert.deepEqual(fields(candidate,'unread'),[]);
});

test('offers compatible contextual families for a written pronoun and a numeric destination',()=>{
  const text='shift it to x=-150.25';
  const sop=request+'act=place mood=do predicate=shift refers=thing\n'+unread+'"to x=-150.25"';
  const options=read(text,sop);
  assert.deepEqual(options.map(candidate=>fields(candidate,'target')[0].family).sort(),['drawn','node']);
  for (const candidate of options) {
    const [owner]=fields(candidate,'target');
    assert.equal(owner.fill,'context');
    assert.equal(fields(candidate,'lookup')[0].from,'page');
    assert.equal(fields(candidate,'constraint')[0].value,'-150.25');
  }
});

test('uses a numeric selector for a named removal and leaves incompatible row unresolved',()=>{
  const sop=request+'act=remove mood=do predicate=delete\n'+target+'family=part mode=existing fill=written name=Intro';
  const [candidate]=read('delete the part "Intro", index 2',sop);
  assert.deepEqual(fields(candidate,'constraint').map(({attribute,phase,value})=>[attribute,phase,value]),
    [['part.index','selector','2']]);
  assert.deepEqual(read('delete the part Intro, row 2',sop),[]);
});

test('does not infer targets, conflicting values, quoted labels, units, or scoped negatives',()=>{
  const text='set n1 width 180 height 90';
  const sop=request+'act=change mood=do predicate=set\n'+target+'family=node mode=existing fill=written ids=n1';
  assert.deepEqual(read(text,request+'act=change mood=do predicate=set'),[]);
  assert.deepEqual(read(text,sop.replace('act=change','act=place')),[]);
  assert.deepEqual(read(text,sop+'\n@c w.request.constraint request=$r on=attribute attribute=node.width value="190" operator=eq phase=result'),[]);
  for (const input of ['set n1 width 180 width 190','set n1 "width 180"','set n1 width 180 inches',
    'set n1 width 180 if possible','set n1 width 180 and height 90','set n1 width 1/8']) {
    assert.deepEqual(read(input,sop),[],input);
  }
});

test('new objects retain their bound literal and independently labelled numeric results',()=>{
  const base=request+'act=make mood=do predicate=add\n'+target+'family=node mode=new sort=rectangle\n'+
    '@label w.request.constraint request=$r on=attribute attribute=node.label value=Step operator=eq phase=result key_words=labelled';
  const [candidate]=read('add a rectangle, labelled Step, at x 240, y 110',base+'\n'+unread+'", at x 240, y 110"');
  assert.deepEqual(fields(candidate,'constraint').map(({attribute,value})=>[attribute,value]),
    [['node.label','Step'],['node.x','240'],['node.y','110']]);
  assert.deepEqual(fields(candidate,'unread'),[]);
  assert.deepEqual(read('add a rectangle, labelled Step, at x 240',base.replace('sort=rectangle','sort=Step')),[]);
  assert.deepEqual(read('add a rectangle beside another object labelled Step, at x 240',base),[]);
  assert.deepEqual(read('add a rectangle, labelled Step, at x 240 if needed',base),[]);
});
