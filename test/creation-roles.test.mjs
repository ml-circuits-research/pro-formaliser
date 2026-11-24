import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createReader } from '../src/runtime.mjs';
import { parse } from '../src/schema.mjs';
import { loadWorlds } from '../src/worlds.mjs';

const get=(wire,key)=>{
  const value=wire.attrs[key]?.[0];
  return value?.startsWith('"') ? JSON.parse(value) : value;
};

function readings(candidates,requirements) {
  return candidates.filter(({sop})=>{
    if (!sop) return false;
    const wires=parse(sop);
    const targets=wires.filter(w=>w.type==='w.request.target');
    return requirements.every(({family,sort,key,value})=>targets.some(t=>
      get(t,'family')===family && get(t,'sort')===sort && get(t,'mode')==='new' &&
      wires.some(w=>w.type==='w.request.constraint' && get(w,'request')===get(t,'request') &&
        get(w,'attribute')===key && get(w,'value')===value && get(w,'phase')==='result')));
  });
}
const node=(sort,value)=>({family:'node',sort,key:'node.label',value});
const section=(sort,value)=>({family:'section',sort,key:'section.content',value});

test('uses the whole unquoted creation complement and native target sort',async()=>{
  const reader=createReader();
  try {
    for (const [text,expected] of [
      ['Could you create an ellipse labelled Survey chart?',node('ellipse','Survey chart')],
      ['Create a circle named North-East Survey 2026',node('circle','North-East Survey 2026')],
      ['Add a heading called Florist thanks',section('heading','Florist thanks')],
      ['Add a paragraph saying “Wait, should we continue?”',section('paragraph','Wait, should we continue?')]
    ]) {
      const {candidates}=await reader.propose(text);
      assert.ok(readings(candidates,[expected]).some(c=>c.source==='literal-creation'),text);
    }
  } finally {await reader.close();}
});

test('preserves independently scoped named and quoted blocks during normal composition',async()=>{
  const reader=createReader();
  try {
    const text='Let us create a heading called Florist thanks; then add a paragraph saying "The delivery arrived this morning."; then add a quote saying "The delivery arrived this morning.". That would help.';
    const {candidates}=await reader.propose(text);
    assert.ok(readings(candidates,[
      section('heading','Florist thanks'),section('paragraph','The delivery arrived this morning.'),
      section('quote','The delivery arrived this morning.')
    ]).length);
  } finally {await reader.close();}
});

test('accepts an independently installed creation role and guards unsupported tails',async t=>{
  const dir=mkdtempSync(fileURLToPath(new URL('../.cache/creation-role-',import.meta.url)));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  writeFileSync(join(dir,'test.sop'),[
    '@bench std.schema.world name=w.workbench',
    '@device std.schema.kind of=w.workbench.device world=w.workbench acts=make',
    '@device.word core.word text="optical quilloscope" means=w.workbench.device',
    '@label w.request.key tab=workbench family=device name=device.label head=span',
    '@role pro.reader.creation_role tab=workbench family=device attribute=device.label text=engraved'
  ].join('\n'));
  const reader=createReader(undefined,loadWorlds({paths:[dir]}));
  try {
    const {candidates}=await reader.propose('Create an optical quilloscope engraved Quartz Survey');
    assert.ok(readings(candidates,[{family:'device',sort:undefined,key:'device.label',value:'Quartz Survey'}])
      .some(c=>c.source==='literal-creation'));
    for (const text of [
      'Create an optical quilloscope engraved Quartz Survey if ready',
      'Create an optical quilloscope engraved Quartz Survey at the office',
      'Create an optical quilloscope engraved Quartz Survey without its frame',
      'Create an optical quilloscope engraved Quartz Survey, review the label',
      'Create an optical quilloscope engraved Quartz Survey plus "proof"',
      'Create the optical quilloscope engraved Quartz Survey',
      'Do not create an optical quilloscope engraved Quartz Survey',
      'Create an optical quilloscope engraved'
    ]) {
      const {candidates}=await reader.propose(text);
      assert.ok(candidates.every(c=>c.source!=='literal-creation'),text);
    }
  } finally {await reader.close();}
});
