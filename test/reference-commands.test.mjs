import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createReader } from '../src/reader.mjs';
import { createReader as createReaderWithModel } from '../src/runtime.mjs';
import { parse } from '../src/schema.mjs';

const values=(wire,key)=>(wire.attrs[key] ?? []).map(raw=>raw.startsWith('"') ? JSON.parse(raw) : raw);
const referenceCommands=result=>result.candidates.filter(candidate=>candidate.source==='reference-command');

test('public Prolog reader preserves the literal unresolved object of removal and deselection commands',async t=>{
  const reader=await createReader({worldsOnly:true,evidence:true});
  t.after(()=>reader.close());

  for (const [text,pronoun,act] of [
    ['delete that','that','remove'],
    ['take it out','it','remove'],
    ['rub this out','this','remove'],
    ['get rid of them','them','remove'],
    ['Please erase it.','it','remove'],
    ['deselect it','it','deselect'],
  ]) {
    const result=await reader.propose(text);
    assert.equal(result.engine,'prolog',text);
    assert.equal(result.error,null,text);
    const candidates=referenceCommands(result);
    assert.ok(candidates.length,text);

    for (const candidate of candidates) {
      assert.equal(candidate.status,'matched',text);
      assert.deepEqual(candidate.catalog.issues,[],text);
      assert.deepEqual(candidate.evidence.missing,[],text);
      assert.equal(candidate.evidence.counts.unread ?? 0,0,text);
      assert.equal(candidate.evidence.counts.uncovered ?? 0,0,text);

      const wires=parse(candidate.sop);
      const requests=wires.filter(wire=>wire.type==='w.request.request');
      const lookups=wires.filter(wire=>wire.type==='w.request.lookup');
      assert.equal(requests.length,1,text);
      assert.equal(lookups.length,1,text);
      const [request]=requests;
      const [lookup]=lookups;
      assert.deepEqual(values(request,'act'),[act],text);
      assert.deepEqual(values(request,'words'),[text],text);
      assert.deepEqual(values(lookup,'request'),['$'+request.id],text);
      assert.deepEqual(values(lookup,'key'),['thing'],text);
      assert.deepEqual(values(lookup,'words'),[pronoun],text);

      const start=text.lastIndexOf(pronoun);
      assert.deepEqual(candidate.evidence.spans.filter(span=>span.wire===lookup.id && span.slot==='words')
        .map(({text,ranges})=>({text,ranges})),[{text:pronoun,ranges:[[start,start+pronoun.length]]}],text);
      for (const wire of wires) {
        assert.ok(!['w.request.previous','w.request.history','w.request.constraint'].includes(wire.type),text);
        assert.ok(!values(wire,'from').includes('previous'),text);
        for (const key of ['family','sort','name','property','attribute','id','ids']) {
          assert.deepEqual(values(wire,key),[],text);
        }
      }
    }
  }
});

test('reference commands require a standalone affirmative directive with a pronominal object',async t=>{
  const reader=await createReader({worldsOnly:true});
  t.after(()=>reader.close());

  for (const text of [
    'Delete that chart.',
    'Take it out of the chart.',
    '"Delete that."',
    'Delete that?',
    'If it is selected, delete it.',
    'Do not delete that.',
  ]) {
    const result=await reader.propose(text);
    assert.equal(result.error,null,text);
    assert.deepEqual(referenceCommands(result),[],text);
  }
});

test('a split verb can bind the pronoun to a separately grounded antecedent in the same request',async t=>{
  const reader=await createReader({worldsOnly:true});
  t.after(()=>reader.close());
  const result=await reader.propose('Draw an object; take it out.');
  assert.equal(result.error,null);
  const candidates=result.candidates.filter(candidate=>candidate.source==='sequence-reference');
  assert.ok(candidates.some(({sop})=>{
    const wires=parse(sop);
    const request=wires.find(wire=>wire.type==='w.request.request' && values(wire,'act')[0]==='remove');
    if (!request) return false;
    const owned=wires.filter(wire=>values(wire,'request')[0]==='$'+request.id);
    return owned.some(wire=>wire.type==='w.request.target' && values(wire,'mode')[0]==='bound' &&
      values(wire,'family_words')[0]==='it') && owned.every(wire=>wire.type!=='w.request.lookup');
  }));
});

test('a declared separable verb keeps a written inventory noun between the verb and particle',async t=>{
  const reader=await createReader({worldsOnly:true,evidence:true});
  t.after(()=>reader.close());
  const first=(wire,key)=>values(wire,key)[0];
  for (const [text,head,act,sort,noun,colour,filler] of [
    ['Rub the grass out.','Rub the grass out','remove','grass'],
    ['Take this puppy out.','Take this puppy out','remove','dog','puppy'],
    ['Pick the red daffodils out.','Pick the red daffodils out','pick','daffodil','daffodils','red'],
    ['Please rub the grass out.','rub the grass out','remove','grass',undefined,undefined,'Please'],
  ]) {
    const result=await reader.propose(text);
    assert.equal(result.error,null,text);
    const candidate=result.candidates.find(c=>c.source==='split-target-frame');
    assert.ok(candidate,text);
    assert.equal(candidate.status,'matched',text);
    const wires=parse(candidate.sop);
    const request=wires.find(w=>w.type==='w.request.request');
    const target=wires.find(w=>w.type==='w.request.target');
    assert.equal(first(request,'act'),act,text);
    assert.equal(first(request,'predicate'),head,text);
    assert.equal(first(target,'request'),'$'+request.id,text);
    assert.equal(first(target,'family'),'drawn',text);
    assert.equal(first(target,'mode'),'existing',text);
    assert.equal(first(target,'sort'),sort,text);
    if (noun) assert.equal(first(target,'sort_words'),noun,text);
    if (colour) assert.ok(wires.some(w=>w.type==='w.request.constraint' && first(w,'value')===colour &&
      first(w,'phase')==='selector'),text);
    assert.deepEqual(wires.filter(w=>w.type==='w.request.filler').map(w=>first(w,'text')),filler?[filler]:[],text);
    assert.deepEqual(candidate.catalog.issues,[],text);
    assert.deepEqual(candidate.evidence.missing,[],text);
    assert.equal(candidate.evidence.counts.uncovered ?? 0,0,text);
  }

  const quantified=await reader.propose('Take all the clouds out.');
  assert.ok(quantified.candidates.some(candidate=>candidate.source==='universal-target' &&
    candidate.status==='matched' && !candidate.sop.includes('w.request.unread') &&
    candidate.sop.includes('predicate="Take all the clouds out"') && candidate.sop.includes('quantifier=all')));

  for (const text of [
    'Take it out.', 'Take out the grass.', 'Take the grass out of the drawing.',
    'Do not rub the grass out.', 'Did you rub the grass out?', 'Rub the grass out if it is dry.',
    'Rub the grass out or leave it.', 'Rub "the grass" out.', 'Rub the grass away.',
    'Turn the light off.', 'Put the box in.', 'Take the Start box out.', 'Take the last two dogs out.',
  ]) {
    const result=await reader.propose(text);
    assert.equal(result.error,null,text);
    assert.ok(result.candidates.every(c=>c.source!=='split-target-frame'),text);
  }
});

test('an ordinal within a split command qualifies its existing nominal target',async t=>{
  const reader=await createReader({worldsOnly:true,evidence:true});
  t.after(()=>reader.close());
  for (const [text,act,ordinal] of [
    ['Put the last step back','place','last'],
    ['Take the first dog out','remove','first'],
    ['Take the last red flower out','remove','last'],
  ]) {
    const result=await reader.propose(text);
    assert.equal(result.error,null,text);
    const candidate=result.candidates.find(c=>c.source==='split-target-frame');
    assert.ok(candidate,text);
    const wires=parse(candidate.sop);
    const target=wires.find(w=>w.type==='w.request.target');
    assert.deepEqual(values(target,'ordinal'),[ordinal],text);
    assert.deepEqual(values(target,'determiner'),['definite'],text);
    assert.deepEqual(values(wires[0],'predicate'),[text],text);
    assert.deepEqual(values(wires[0],'act'),[act],text);
    assert.equal(wires.some(w=>w.type==='w.request.unread'),false,text);
    assert.deepEqual(candidate.evidence.missing,[],text);
    assert.deepEqual(candidate.catalog.issues,[],text);
  }
});

test('a complete split predicate supersedes equivalent learned meaning with incomplete evidence',async t=>{
  const text='Rub the grass out';
  const reader=createReaderWithModel({version:1,templates:[],examples:[{text,count:1,sop:[
    '@r w.request.request act=remove mood=do predicate=Rub',
    '@t w.request.target request=$r family=drawn mode=existing determiner=definite fill=description sort=grass',
  ].join('\n')}]});
  t.after(()=>reader.close());
  const result=await reader.propose(text,{evidence:true});
  const reading=result.candidates.find(candidate=>candidate.source==='split-target-frame');
  assert.ok(reading);
  assert.equal(reading.status,'matched');
  assert.deepEqual(values(parse(reading.sop)[0],'predicate'),[text]);
  assert.equal(reading.evidence.tokens.at(-1).status,'grounded');
  assert.ok(result.candidates.every(candidate=>candidate.source!=='example'));
});
