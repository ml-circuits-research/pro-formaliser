import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createReader } from '../src/runtime.mjs';
import { loadWorlds } from '../src/worlds.mjs';
import { parse } from '../src/schema.mjs';

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
    '@ids w.request.key tab=workbench family=device name=device.ids head=candidate',
    '@verb k.actions.verb text=highlight act=pick',
    '@frame pro.reader.member_action tab=workbench family=device act=pick mode=existing key=device.ids phase=selector separator=plus'
  ].join('\n'));
  const reader=createReader(undefined,loadWorlds({paths:[dir]}));
  try {
    const {candidates}=await reader.propose('Highlight “Quartz 7” plus Basalt');
    check(candidates,'device.ids',['Quartz 7','Basalt'],'pick','existing','selector');
  } finally {await reader.close();}
});
