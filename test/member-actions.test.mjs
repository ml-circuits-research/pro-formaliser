import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createReader } from '../src/runtime.mjs';
import { loadWorlds } from '../src/worlds.mjs';
import { parse, validate } from '../src/schema.mjs';
import { evidenceInText } from '../src/grounding.mjs';

const read=x=>x?.startsWith('"') ? JSON.parse(x) : x;
function check(candidates,key,expected,act='group',mode='new',phase='result') {
  const candidate=candidates.find(c=>c.source==='member-action' && c.sop.includes(key));
  assert.ok(candidate);
  const wires=parse(candidate.sop), req=wires.find(w=>w.type==='w.request.request');
  const target=wires.find(w=>w.type==='w.request.target');
  assert.equal(read(req.attrs.act[0]),act);
  assert.equal(read(target.attrs.mode[0]),mode);
  const members=wires.filter(w=>read(w.attrs.attribute?.[0])===key && read(w.attrs.phase?.[0])===phase);
  assert.deepEqual(members.map(w=>read(w.attrs.value[0])),expected);
  if (mode==='existing') assert.deepEqual(target.attrs.ids.map(read),expected);
}

test('reads native grouping verbs with exact written labels and ordered members',async()=>{
  const reader=createReader(undefined,loadWorlds());
  try {
    for(const [text,expected] of [
      ['Group A and B',['A','B']],
      ['please put together Input and Stock together',['Input','Stock']],
      ['Combine n2 with Order Backend',['n2','Order Backend']],
      ['Group “Fish and Chips” and “Salt  Lake”',['Fish and Chips','Salt  Lake']],
      ['Group North  Station and South Depot and C',['North  Station','South Depot','C']]
    ]) {
      const {candidates}=await reader.propose(text);
      check(candidates,'group.ids',expected);
      assert.ok(candidates.some(c=>c.source!=='member-action'),text);
    }
  } finally {await reader.close();}
});

test('rejects open-ended or scoped member lists and unsupported actions',async()=>{
  const reader=createReader(undefined,loadWorlds());
  try {
    for (const text of [
      'Group A and', 'Group A and A', 'Group red boxes and B',
      'Group A and B if ready', 'Never group A and B', 'Group A and B and Delete C',
      'Group A and B from the chart', 'Group A with B in C', 'Open up Desk and Chair'
    ]) {
      const {candidates}=await reader.propose(text);
      assert.ok(candidates.every(c=>c.source!=='member-action'),text);
    }
  } finally {await reader.close();}
});

test('licenses an existing-object member role in an unrelated overlay', async t=>{
  const dir=mkdtempSync(fileURLToPath(new URL('../.cache/member-actions-overlay-',import.meta.url)));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  writeFileSync(join(dir,'member.sop'),[
    '@bench std.schema.world name=w.workbench',
    '@device std.schema.kind of=w.workbench.device world=w.workbench acts=pick',
    '@noun core.word text=quilloscope means=w.workbench.device',
    '@ids w.request.key family=device name=device.ids head=candidate',
    '@verb k.actions.verb text=highlight act=pick',
    '@frame pro.reader.member_action family=device act=pick mode=existing key=device.ids phase=selector separator=plus'
  ].join('\n'));
  const reader=createReader(undefined,loadWorlds({paths:[dir]}));
  try {
    const {candidates}=await reader.propose('Highlight “Quartz 7” plus Basalt');
    check(candidates,'device.ids',['Quartz 7','Basalt'],'pick','existing','selector');
  } finally {await reader.close();}
});

test('binds explicit object lists and applies a finite effect to every selected block', async t=>{
  const worlds=loadWorlds();
  const reader=createReader(undefined,worlds);
  t.after(()=>reader.close());
  for (const [text,key,expected,effect] of [
    ['Underline blocks Intro, 2 and 3 plus Second','block.id',['Intro','2','3','Second'],'underline'],
    ['Bold blocks “Plan and Budget”, 2, and Second','block.id',['Plan and Budget','2','Second'],'bold'],
    ['Select nodes n2 and n5','node.ids',['n2','n5']],
    ['Select objects o3 and o5','drawn.ids',['o3','o5']],
  ]) {
    const {candidates}=await reader.propose(text);
    check(candidates,key,expected,effect ? 'change' : 'pick','existing','selector');
    const {sop}=candidates.find(candidate=>candidate.source==='member-action');
    assert.ok(validate(sop,worlds));
    assert.ok(evidenceInText(text,sop,worlds));
    if (effect) {
      const [result]=parse(sop).filter(wire=>read(wire.attrs.phase?.[0])==='result');
      assert.deepEqual(['attribute','value'].map(slot=>read(result.attrs[slot][0])),['block.mark',effect]);
    }
  }
  for (const text of [
    'Underline Intro and 2', 'Underline blocks Intro and Intro',
    'Underline blocks Intro and 2, then delete the rest',
    'Underline blocks Intro and 2 with Main left enabled',
    'Underline blocks Intro, 2 and final',
    'Underline blocks Intro and 2, final label',
    'Select nodes n2 and e5', 'Select nodes n2 and 5',
    'Select blocks Intro and 2 if ready', 'Do not select blocks Intro and 2',
  ]) {
    const {candidates}=await reader.propose(text);
    assert.ok(candidates.every(candidate=>candidate.source!=='member-action'),text);
  }
});

test('retains a marked adjunct without trimming names or interpreting its effect', async t=>{
  const worlds=loadWorlds();
  const reader=createReader(undefined,worlds);
  t.after(()=>reader.close());
  for (const [text,members,adjunct] of [
    ['please underline blocks Intro, 2 and 3, with the enabled value Main plus attrs Second',
      ['Intro','2','3'],'with the enabled value Main plus attrs Second'],
    ['Bold blocks Intro and “Draft, with notes”, with styling from Appendix.',
      ['Intro','Draft, with notes'],'with styling from Appendix.'],
    ['Bold blocks Intro, 2, and “With Love”',['Intro','2','With Love'],undefined],
  ]) {
    const {candidates}=await reader.propose(text);
    check(candidates,'block.id',members,'change','existing','selector');
    const candidate=candidates.find(candidate=>candidate.source==='member-action');
    const unread=parse(candidate.sop).filter(wire=>wire.type==='w.request.unread');
    assert.deepEqual(unread.map(wire=>read(wire.attrs.text[0])),adjunct ? [adjunct] : []);
    assert.equal(candidate.status,adjunct ? 'partial' : 'matched');
    assert.ok(evidenceInText(text,candidate.sop,worlds));
  }
});
