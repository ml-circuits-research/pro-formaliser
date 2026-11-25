import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createReader} from '../src/runtime.mjs';
import {parse} from '../src/schema.mjs';

const get=(wire,key)=>{
  const raw=wire.attrs[key]?.[0];
  return raw?.startsWith('"') ? JSON.parse(raw) : raw;
};
const fields=wires=>Object.fromEntries(wires.filter(wire=>wire.type==='w.request.constraint')
  .map(wire=>[get(wire,'attribute'),get(wire,'value')]));

test('keeps an explicit date, written clock, zone and measured duration on the created meeting',async t=>{
  const reader=createReader();
  t.after(()=>reader.close());
  for (const zone of ['UTC','Europe/Berlin']) {
    const text='just add Planning with ID planning, 2026-11-18 10:00 '+zone+' 30 minutes';
    const {candidates}=await reader.propose(text,{evidence:true});
    const candidate=candidates.find(c=>c.source==='argument-frame');
    assert.ok(candidate,text);
    const wires=parse(candidate.sop);
    assert.deepEqual(fields(wires),{
      'meeting.title':'Planning','meeting.id':'planning','meeting.day':'2026-11-18',
      'meeting.time':'10:00','meeting.timezone':zone,'meeting.length':'30 minutes',
    });
    const duration=wires.find(w=>get(w,'attribute')==='meeting.length');
    assert.equal(get(duration,'measure'),'30');
    assert.equal(get(duration,'unit'),'minute');
    assert.deepEqual(candidate.evidence.missing,[]);
    assert.equal(candidate.evidence.counts.unread,undefined);
    assert.equal(candidate.evidence.counts.uncovered,undefined);
  }
});

test('keeps the existing written target distinct from replacement title, time range and agenda',async t=>{
  const reader=createReader();
  t.after(()=>reader.close());
  const text='I want event review edited: Team review, 2026-11-18, 10:00 to 11:00 UTC, notes Bring draft';
  const {candidates}=await reader.propose(text,{evidence:true});
  const candidate=candidates.find(c=>c.source==='argument-frame');
  assert.ok(candidate);
  const wires=parse(candidate.sop);
  const target=wires.find(w=>w.type==='w.request.target');
  assert.equal(get(target,'mode'),'existing');
  assert.equal(get(target,'name'),'review');
  assert.deepEqual(fields(wires),{
    'meeting.title':'Team review','meeting.day':'2026-11-18','meeting.time':'10:00',
    'meeting.end':'11:00','meeting.timezone':'UTC','meeting.agenda':'Bring draft',
  });
  assert.deepEqual(candidate.evidence.missing,[]);
  assert.equal(candidate.evidence.counts.uncovered,undefined);
});

test('keeps incomplete and invalid date or quantity language out of resolved schedule fields',async t=>{
  const reader=createReader();
  t.after(()=>reader.close());
  for (const text of [
    'add Planning with ID planning',
    'add Planning with ID planning, 2026-02-30 10:00 UTC 30 minutes',
    'add Planning with ID planning, 2026-11-18 25:00 UTC 30 minutes',
    'add Planning with ID planning, 2026-11-18 10:00 unknown 30 minutes',
    'add Planning with ID planning, 2026-11-18 10:00 UTC 30',
    'Do not add Planning with ID planning, 2026-11-18 10:00 UTC 30 minutes',
    'I want event review edited: Team review, 2026-11-18, 10 : 00 to 10:00 UTC, notes Bring draft',
  ]) {
    const {candidates}=await reader.propose(text);
    assert.ok(candidates.every(c=>c.source!=='argument-frame'),text);
  }
  for (const text of [
    'make it an Intro meeting named Main at 3 for 1, notes gone',
    'Schedule an Intro meeting titled Main at 3 for 1, with the same notes.',
  ]) {
    const {candidates}=await reader.propose(text);
    assert.ok(candidates.every(c=>!parse(c.sop).some(w=>w.type==='w.request.intent' &&
      get(w,'words')?.startsWith('for 1'))),text);
  }
});
