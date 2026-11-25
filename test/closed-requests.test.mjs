import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createReader} from '../src/reader.mjs';
import {parse} from '../src/schema.mjs';

const decode=value=>value.startsWith('"') ? JSON.parse(value) : value;

test('reads closed selection requests without targets or history', async t => {
  const reader=await createReader({worldsOnly:true,evidence:true});
  t.after(()=>reader.close());

  for (const text of [
    'nothing selected please',
    'No thing highlighted, pls',
    'Clear the selection.',
    'clear my selection pls',
    'Deselect everything.',
    'Unhighlight all, please.',
  ]) {
    const result=await reader.propose(text);
    assert.equal(result.error,null,text);
    const candidates=result.candidates.filter(candidate=>candidate.source==='closed-request');
    assert.ok(candidates.length,text);
    for (const candidate of candidates) {
      assert.equal(candidate.status,'matched',text);
      assert.deepEqual(candidate.catalog.issues,[],text);
      assert.deepEqual(candidate.evidence.missing,[],text);
      assert.equal(candidate.evidence.counts.unread ?? 0,0,text);
      assert.equal(candidate.evidence.counts.uncovered ?? 0,0,text);

      const wires=parse(candidate.sop);
      const requests=wires.filter(wire=>wire.type==='w.request.request');
      assert.equal(requests.length,1,text);
      assert.deepEqual(requests[0].attrs.act?.map(decode),['deselect'],text);
      assert.deepEqual(requests[0].attrs.words?.map(decode),[text],text);
      assert.ok(wires.every(wire=>!['w.request.target','w.request.previous','w.request.history'].includes(wire.type)),text);
      assert.ok(wires.every(wire=>wire.type!=='w.request.lookup' ||
        !wire.attrs.from?.map(decode).includes('previous')),text);
    }
  }

  for (const text of [
    'Nothing selected?',
    'nothing selected',
    "Don't clear the selection",
    'If I ask, clear the selection',
    'deselect it',
    'unselected',
    '"Clear the selection."',
    '"nothing selected please"',
  ]) {
    const result=await reader.propose(text);
    assert.equal(result.error,null,text);
    assert.ok(result.candidates.every(candidate=>candidate.source!=='closed-request'),text);
  }
});
