import assert from 'node:assert/strict';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';
import {createReader} from '../src/runtime.mjs';
import {parse,validate} from '../src/schema.mjs';
import {coordinatedRequestReadings} from '../src/sentence-requests.mjs';
import {loadWorlds} from '../src/worlds.mjs';

const local=fileURLToPath(new URL('../sop-worlds/',import.meta.url));
const worlds=loadWorlds({paths:[local]});
const field=(wire,key)=>{
  const value=wire.attrs[key]?.[0];
  return value?.startsWith('"') ? JSON.parse(value) : value;
};
const coordinated=candidate=>candidate.source==='coordinated-requests';

test('combines separately grounded measures in the same order and keeps their owners',async t=>{
  const reader=createReader(undefined,worlds);
  t.after(()=>reader.close());
  const first='Move the boat three inches left';
  const second='move the house two spaces right';
  const {candidates}=await reader.propose(first+', then '+second,{evidence:true});
  const compound=candidates.find(coordinated);
  assert.ok(compound);
  assert.ok(validate(compound.sop,worlds));
  assert.deepEqual(compound.evidence.missing,[]);
  assert.equal(compound.evidence.counts.uncovered,undefined);
  const wires=parse(compound.sop);
  const requests=wires.filter(wire=>wire.type==='w.request.request');
  assert.deepEqual(requests.map(wire=>field(wire,'words')),[first,second]);
  for (const [i,sort,amount,unit,axis] of [[0,'boat','3','inch','left'],[1,'house','2','space','right']]) {
    const owned=wires.filter(wire=>field(wire,'request')==='$'+requests[i].id);
    const target=owned.find(wire=>wire.type==='w.request.target');
    const movement=owned.find(wire=>field(wire,'attribute')==='drawn.displacement');
    assert.equal(field(target,'sort'),sort);
    assert.deepEqual([field(movement,'measure'),field(movement,'unit')],[amount,unit]);
    assert.ok(owned.some(wire=>field(wire,'attribute')==='drawn.direction' && field(wire,'value')===axis));
  }
});

test('keeps typed landmark lookups and the installed predicate of a reciprocal clause',async t=>{
  const first='draw two kids on the lawn facing each other';
  const second='move it midway between Red Dock and Green Valley.';
  const sop=[
    '@r w.request.request act=make mood=do predicate=draw',
    '@t w.request.target request=$r family=drawn mode=new determiner=quantified sort=kid sort_words=kids count_words=two',
    '@c1 w.request.constraint request=$r on=count attribute=drawn.count words=two operator=eq phase=result',
    '@c2 w.request.constraint request=$r on=place attribute=drawn.relation value=on words="on the lawn" operator=relation phase=result',
    '@c3 w.request.unread request=$r text="facing each other" note=drawn.facing',
    '@c4 w.request.constraint request=$r on=place attribute=drawn.anchor value="the lawn" operator=relation phase=selector',
  ].join('\n');
  const reader=createReader({version:1,templates:[],examples:[{text:first,sop,count:1}]},worlds);
  t.after(()=>reader.close());
  const {candidates}=await reader.propose(first+'; then '+second);
  const compound=candidates.find(candidate=>coordinated(candidate) && candidate.sop.includes('w.relational.reciprocal'));
  assert.ok(compound);
  assert.ok(validate(compound.sop,worlds));
  const wires=parse(compound.sop);
  const pair=wires.find(wire=>wire.type==='w.relational.landmark_pair');
  const reciprocal=wires.find(wire=>wire.type==='w.relational.reciprocal');
  assert.equal(field(reciprocal,'predicate'),'$w.relational.faces');
  assert.notEqual(field(reciprocal,'request'),field(pair,'request'));
  for (const key of ['first','second']) {
    const selector=field(pair,key);
    assert.ok(wires.some(wire=>field(wire,'constraint')===selector && field(wire,'request')===field(pair,'request')));
  }
});

test('requires every coordinated clause to be grounded and respects guarded spans',async t=>{
  const reader=createReader(undefined,worlds);
  t.after(()=>reader.close());
  for (const text of [
    'Move the boat three inches left and do not move the house two spaces right',
    'If it is ready, move the boat three inches left, then move the house two spaces right',
    'Move the boat three inches left, then kalveram it',
    'Did you move the boat three inches left, then move the house two spaces right?',
    'Move the boat three inches left, then print "move the house two spaces right"',
  ]) {
    const {candidates}=await reader.propose(text);
    assert.equal(candidates.some(coordinated),false,text);
  }
});

test('a named endpoint remains an argument of the leading connection predicate',async t=>{
  const reader=createReader(undefined,worlds);
  t.after(()=>reader.close());
  const parts=['Please, add a rectangle labelled Brief','link Brief to Summary. Thanks!'];
  const candidates=await coordinatedRequestReadings(parts,worlds,
    async part=>(await reader.propose(part)).candidates,()=>true);
  const compound=candidates.find(candidate=>candidate.sop.includes('act=connect'));
  assert.ok(compound);
  assert.ok(validate(compound.sop,worlds));
  const wires=parse(compound.sop);
  const [make,connect]=wires.filter(wire=>wire.type==='w.request.request');
  assert.deepEqual([field(make,'act'),field(connect,'act'),field(connect,'predicate')],['make','connect','link']);
  const owned=wires.filter(wire=>field(wire,'request')==='$'+connect.id);
  assert.ok(owned.some(wire=>field(wire,'attribute')==='link.from' && field(wire,'value')==='Brief'));
  assert.ok(owned.some(wire=>field(wire,'attribute')==='link.to' && field(wire,'value')==='Summary'));
  assert.ok(candidates.every(candidate=>!candidate.sop.includes('predicate=Summary')));
});

test('keeps a combination of matched clauses beyond the lexical search limit',async t=>{
  const reader=createReader(undefined,worlds);
  t.after(()=>reader.close());
  const parts=['Move the red boat left','Move the blue cloud right'];
  const candidates=await coordinatedRequestReadings(parts,worlds,async part=>{
    const local=(await reader.propose(part)).candidates.find(candidate=>candidate.source==='directional-result');
    assert.ok(local);
    const direction=part.split(' ').at(-1);
    const prefix=local.sop.split('\n').filter(line=>!line.includes('drawn.direction')).join('\n');
    // These fallback variants attach the direction to a place-like key.
    // Their distinct graphs fill the ordinary beam ahead of two matches.
    const fallback=['eq','relation','region','degree','delta','factor'].map(operator=>({
      sop:prefix+'\n@v w.request.constraint request=$r1 on=place attribute=drawn.anchor value='+direction+
        ' phase=result operator='+operator,
      source:'lexicon',
      status:'partial',
    }));
    return [...fallback,local];
  },()=>true);
  assert.ok(candidates.some(candidate=>parse(candidate.sop).filter(wire=>
    field(wire,'attribute')==='drawn.direction').length===2));
  assert.ok(candidates.some(candidate=>candidate.sop.includes('drawn.anchor')));
});

test('binds a written freshness qualifier to the immediately preceding creation',async t=>{
  const reader=createReader(undefined,worlds);
  t.after(()=>reader.close());
  const first='Connect Seed to Plan';
  const second='colour the new arrow teal';
  const {candidates}=await reader.propose(first+' and '+second);
  const bound=candidates.find(candidate=>candidate.source==='sequence-reference' &&
    candidate.sop.includes('mode=bound family_words="the new arrow"'));
  assert.ok(bound);
  const wires=parse(bound.sop);
  const [create,change]=wires.filter(wire=>wire.type==='w.request.request');
  assert.deepEqual([field(create,'act'),field(change,'act')],['connect','change']);
  const target=wires.find(wire=>field(wire,'mode')==='bound');
  assert.equal(field(target,'family'),'link');
  assert.equal(field(target,'request'),'$'+change.id);
  assert.ok(wires.some(wire=>field(wire,'request')==='$'+change.id &&
    field(wire,'attribute')==='link.colour' && field(wire,'value')==='teal'));
  for (const text of [first+' and colour the arrow teal',first+', then add a box, then '+second]) {
    const {candidates:unsafe}=await reader.propose(text);
    assert.ok(unsafe.every(candidate=>!candidate.sop.includes('mode=bound family_words="the new arrow"')));
  }
});
