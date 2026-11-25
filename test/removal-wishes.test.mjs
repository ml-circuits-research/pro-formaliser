import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createReader } from '../src/reader.mjs';
import { parse } from '../src/schema.mjs';

const values=(wire,key)=>(wire.attrs[key] ?? []).map(raw=>raw.startsWith('"') ? JSON.parse(raw) : raw);
const removalWishes=result=>result.candidates.filter(candidate=>candidate.source==='removal-wish');

test('public Prolog reader retains the written noun and request in removal wishes',async t=>{
  const reader=await createReader({worldsOnly:true,evidence:true});
  t.after(()=>reader.close());

  for (const [text,sort,sortWords,description,filler] of [
    ["i don't want grass anymore",'grass','grass','grass'],
    ['I do not want the house any more.','house','house','the house'],
    ['Please, I don’t want the House any more.','house','House','the House','Please'],
    ["I don't want grass anymore, please.",'grass','grass','grass','please'],
  ]) {
    const result=await reader.propose(text);
    assert.equal(result.engine,'prolog',text);
    assert.equal(result.error,null,text);
    const candidates=removalWishes(result);
    assert.ok(candidates.length,text);

    for (const candidate of candidates) {
      assert.equal(candidate.status,'matched',text);
      assert.deepEqual(candidate.catalog.issues,[],text);
      assert.deepEqual(candidate.evidence.missing,[],text);
      assert.equal(candidate.evidence.counts.unread ?? 0,0,text);
      assert.equal(candidate.evidence.counts.uncovered ?? 0,0,text);

      const wires=parse(candidate.sop);
      const requests=wires.filter(wire=>wire.type==='w.request.request');
      const targets=wires.filter(wire=>wire.type==='w.request.target');
      assert.equal(requests.length,1,text);
      assert.equal(targets.length,1,text);
      const [request]=requests;
      const [target]=targets;
      assert.deepEqual(values(request,'act'),['remove'],text);
      assert.deepEqual(values(request,'words'),[text],text);
      assert.deepEqual(values(target,'request'),['$'+request.id],text);
      assert.deepEqual(values(target,'mode'),['existing'],text);
      assert.deepEqual(values(target,'sort'),[sort],text);
      assert.deepEqual(values(target,'sort_words'),[sortWords],text);
      assert.deepEqual(values(target,'description'),[description],text);
      assert.deepEqual(wires.filter(wire=>wire.type==='w.request.filler')
        .flatMap(wire=>values(wire,'text')),filler ? [filler] : [],text);
      for (const key of ['ids','name','count','count_words','quantifier']) {
        assert.deepEqual(values(target,key),[],text);
      }
      assert.ok(wires.every(wire=>![
        'w.request.previous','w.request.history','w.request.lookup','w.relational.source_scope',
      ].includes(wire.type)),text);
    }
  }

  for (const text of [
    "I don't want the house.",
    "I don't want to remove the house",
    "I don't want to remove the house anymore.",
    "I don't want quibblo anymore.",
    '"I do not want the house anymore."',
    'I do not want the house anymore?',
    "If I don't want the house anymore, what happens?",
    "I don't want it anymore.",
  ]) {
    const result=await reader.propose(text);
    assert.equal(result.error,null,text);
    assert.deepEqual(removalWishes(result),[],text);
  }
});
