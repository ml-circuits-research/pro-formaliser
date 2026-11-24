import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createReader} from '../src/runtime.mjs';
import {loadWorlds} from '../src/worlds.mjs';

test('applies both closed values to one existing object while preserving its full description',async t=>{
  const reader=createReader();t.after(()=>reader.close());
  const read=async text=>(await reader.propose(text)).candidates.filter(c=>c.source==='coordinated-effects');
  const answers=await read('make the Crush box bold and italic');
  assert.ok(answers.some(c=>c.sop.includes('description="the Crush box"') &&
    c.sop.includes('attribute=node.slant value=italic') && c.sop.includes('attribute=node.fontWeight value=bold')));
  for (const text of ['make the box italic and normal if ready','make the box bold and italic and remove it',
    'make the box bold or italic','make the box bold and italic on another box']) assert.equal((await read(text)).length,0,text);
});

test('new properties and wording can be installed in a world',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'sop-effects-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  writeFileSync(join(dir,'world.sop'),[
    '@work std.schema.world name=w.bench',
    '@kind std.schema.kind of=w.bench.device world=w.bench acts=change',
    '@noun core.word text=quilloscope means=w.bench.device',
    '@gain w.request.key tab=bench family=device name=device.gain head=class value=loud value=quiet',
    '@temp w.request.key tab=bench family=device name=device.power head=class value=cool value=hot',
    '@form pro.reader.coordinated_effects part=adjust part=owner part=to part=effect part=join part=effect'
  ].join('\n'));
  const reader=createReader(undefined,loadWorlds({paths:[dir]})); t.after(()=>reader.close());
  const {candidates}=await reader.propose('adjust the quilloscope to loud and hot');
  assert.ok(candidates.some(c=>c.source==='coordinated-effects' && c.sop.includes('device.gain value=loud') &&
    c.sop.includes('device.power value=hot')));
});
