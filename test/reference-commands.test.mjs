import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createReader } from '../src/reader.mjs';
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
