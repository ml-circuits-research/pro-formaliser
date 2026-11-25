import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createReader } from '../src/reader.mjs';
import { parse } from '../src/schema.mjs';

const values=(wire,key)=>(wire.attrs[key] ?? []).map(raw=>raw.startsWith('"') ? JSON.parse(raw) : raw);

function assertSpan(candidate,wire,slot,text,start,kind='grounded') {
  assert.deepEqual(candidate.evidence.spans.filter(span=>span.wire===wire.id && span.slot===slot),[
    {wire:wire.id,slot,kind,text,ranges:[[start,start+text.length]]},
  ]);
}

test('revision controls ground closed requests and unresolved written objects in the current text',async t=>{
  const reader=await createReader({worldsOnly:true,evidence:true});
  t.after(()=>reader.close());

  for (const [text,act,predicate,object,filler] of [
    ['Redo.','redo','Redo'],
    ['ctrl z','undo','ctrl z'],
    ['undo the undo','redo','undo the undo'],
    ['wait, undo','undo','wait, undo'],
    ['can u redo','redo','can u redo'],
    ['undo the last step','undo','undo the last step'],
    ['undo it','undo','undo','it'],
    ['bring it back','redo','bring it back','it'],
    ['put it back pls','redo','put it back','it','pls'],
  ]) {
    const result=await reader.propose(text);
    assert.equal(result.engine,'prolog',text);
    assert.equal(result.error,null,text);
    const source=object ? 'reference-command' : 'closed-request';
    const candidates=result.candidates.filter(candidate=>candidate.source===source &&
      parse(candidate.sop).some(wire=>wire.type==='w.request.request' && values(wire,'act').includes(act)));
    assert.ok(candidates.length,text);

    for (const candidate of candidates) {
      assert.equal(candidate.status,'matched',text);
      assert.deepEqual(candidate.catalog.issues,[],text);
      assert.deepEqual(candidate.evidence.missing,[],text);
      assert.equal(candidate.evidence.counts.unread ?? 0,0,text);
      assert.equal(candidate.evidence.counts.uncovered ?? 0,0,text);

      const wires=parse(candidate.sop);
      assert.deepEqual(wires.map(wire=>wire.type).sort(),[
        'w.request.request',
        ...(object ? ['w.request.lookup'] : []),
        ...(filler ? ['w.request.filler'] : []),
      ].sort(),text);
      const request=wires.find(wire=>wire.type==='w.request.request');
      assert.deepEqual(values(request,'act'),[act],text);
      assert.deepEqual(values(request,'mood'),['do'],text);
      assert.deepEqual(values(request,'words'),[text],text);
      assert.deepEqual(values(request,'predicate'),[predicate],text);
      assertSpan(candidate,request,'predicate',predicate,text.indexOf(predicate));

      if (object) {
        const lookup=wires.find(wire=>wire.type==='w.request.lookup');
        assert.deepEqual(values(request,'refers'),['thing'],text);
        assert.deepEqual(values(lookup,'request'),['$'+request.id],text);
        assert.deepEqual(values(lookup,'key'),['thing'],text);
        assert.deepEqual(values(lookup,'words'),[object],text);
        assert.deepEqual(values(lookup,'from'),[],text);
        assertSpan(candidate,lookup,'words',object,text.indexOf(object));
      }
      if (filler) {
        const fillerWire=wires.find(wire=>wire.type==='w.request.filler');
        assert.deepEqual(values(fillerWire,'text'),[filler],text);
        assertSpan(candidate,fillerWire,'text',filler,text.indexOf(filler),'filler');
      }
    }
  }
});

test('revision controls require a standalone directive of the supported shape',async t=>{
  const reader=await createReader({worldsOnly:true});
  t.after(()=>reader.close());

  for (const text of [
    'go back',
    'Undo the last rotation step.',
    '"Redo."',
    '"Undo it."',
    'Redo?',
    'Can u redo?',
    'Undo it?',
    'Do not redo.',
    'Do not undo it.',
    'If I ask, redo.',
    'If I ask, undo it.',
  ]) {
    const result=await reader.propose(text);
    assert.equal(result.error,null,text);
    assert.ok(result.candidates.every(candidate=>
      !['closed-request','reference-command'].includes(candidate.source)),text);
  }
});
