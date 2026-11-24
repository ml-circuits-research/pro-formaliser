import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parse } from '../src/schema.mjs';
import { createTransfer } from '../src/transfer.mjs';

const decode=value=>value?.startsWith('"') ? JSON.parse(value) : value;
const field=(wire,key)=>decode(wire?.attrs[key]?.[0]);
const atom=JSON.stringify;

function scene(words, fields, item, {predicate, family='gallery'}={}) {
  return {
    text:words+' with a '+item,
    sop:[
      '@r w.request.request act=change mood=do words='+atom(words)+(predicate ? ' predicate='+atom(predicate) : ''),
      '@t w.request.target request=$r family='+family+' mode=existing fill=context',
      '@l w.request.lookup request=$r target=$t key=thing from=page',
      ...fields.map(([key,value,span],i)=>'@c'+i+' w.request.constraint request=$r on=attribute attribute='+
        key+' value='+value+(span ? ' words='+atom(span) : '')+' operator=eq phase=result'),
      '@r2 w.request.request act=make mood=do words='+atom('a '+item),
      '@t2 w.request.target request=$r2 family=artifact mode=new sort='+item,
    ].join('\n'),
  };
}

const place=['gallery.location','courtyard','a courtyard'];
const light=['gallery.light','dawn','before sunrise'];
const sound=['gallery.sound','quiet','in quiet'];
const samples=[
  scene('Prepare a courtyard in quiet',[place,sound],'plaque',{predicate:'Prepare'}),
  scene('Prepare a courtyard in quiet',[place,sound],'lantern',{predicate:'Prepare'}),
  scene('before sunrise',[light],'print'),
  scene('before sunrise',[light],'statue'),
];

test('composes independently attested settings with the original predicate and lexical values',()=>{
  const input='Prepare a courtyard, before sunrise';
  const proposals=createTransfer(samples).sceneHeadings(input);
  assert.equal(proposals.length,1);
  const wires=parse(proposals[0].sop);
  const req=wires.find(w=>w.type==='w.request.request');
  assert.equal(field(req,'predicate'),'Prepare');
  assert.equal(field(req,'words'),input);
  assert.deepEqual(wires.filter(w=>w.type==='w.request.constraint').map(w=>
    [field(w,'attribute'),field(w,'value'),field(w,'words')]),[
    ['gallery.location','courtyard','a courtyard'],
    ['gallery.light','dawn','before sunrise'],
  ]);
});

test('requires independent bodies, compatible roles and complete source coverage',()=>{
  const input='Prepare a courtyard before sunrise';
  assert.deepEqual(createTransfer([samples[0],samples[0],...samples.slice(2)]).sceneHeadings(input),[]);
  const wrongFamily=[...samples.slice(0,2),scene('before sunrise',[light],'print',{family:'archive'}),
    scene('before sunrise',[light],'statue',{family:'archive'})];
  assert.deepEqual(createTransfer(wrongFamily).sceneHeadings(input),[]);
  const transfer=createTransfer(samples);
  for (const text of [
    'Inspect a courtyard before sunrise',
    'Prepare a courtyard without quiet before sunrise',
    'Prepare a courtyard in quiet if before sunrise',
    'Prepare a courtyard near the doorway before sunrise',
    'Prepare a courtyard before sunrise before sunrise',
  ]) assert.deepEqual(transfer.sceneHeadings(text),[],text);
});

test('a setting before the first object can corroborate a local facet only in its established context role',()=>{
  const nearby=['gallery.location','beach','a beach'];
  function embedded(item, other) {
    const scope='a beach with a '+item;
    return {text:scope+', and a '+other,sop:[
      '@r w.request.request act=make mood=do words='+atom(scope),
      '@t w.request.target request=$r family=artifact mode=new sort='+item,
      '@c w.request.constraint request=$r on=attribute attribute='+nearby[0]+' value='+nearby[1]+
        ' words='+atom(nearby[2])+' operator=eq phase=result',
      '@r2 w.request.request act=make mood=do words='+atom('a '+other),
      '@t2 w.request.target request=$r2 family=artifact mode=new sort='+other,
    ].join('\n')};
  }
  const observations=[embedded('sign','sculpture'),embedded('parasol','chest')];
  const input='a beach before sunrise';
  assert.deepEqual(createTransfer([...samples.slice(2),...observations]).sceneHeadings(input),[]);
  assert.deepEqual(createTransfer([...samples,observations[0]]).sceneHeadings(input),[]);
  const [proposal]=createTransfer([...samples,...observations]).sceneHeadings(input);
  assert.match(proposal.sop,/family=gallery mode=existing/);
  assert.match(proposal.sop,/attribute=gallery\.location value=beach/);
  assert.doesNotMatch(proposal.sop,/family=artifact/);
});
