import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createReader } from '../src/runtime.mjs';
import { loadWorlds } from '../src/worlds.mjs';
import { parse } from '../src/schema.mjs';

const pilot=name=>fileURLToPath(new URL('../sop-worlds/'+name+'/',import.meta.url));
const get=(wire,key)=>{
  const value=wire.attrs[key]?.[0];
  return value?.startsWith('"') ? JSON.parse(value) : value;
};
const targets=result=>result.candidates.flatMap(c=>parse(c.sop).filter(w=>w.type==='w.request.target'));

test('an opt-in inventory grounds native drawables and noun-local expression in a worlds-only reader',async t=>{
  const expression=pilot('expression-pilot'),inventory=pilot('drawable-inventory-pilot');
  const baseline=createReader(undefined,loadWorlds({paths:[expression]}));
  const reader=createReader(undefined,loadWorlds({paths:[inventory,expression]}));
  t.after(()=>Promise.all([reader.close(),baseline.close()]));
  const text='Draw a boy with a happy face';
  assert.ok(targets(await baseline.propose(text)).every(w=>get(w,'sort')!=='boy'));
  for (const [surface,sort,value] of [
    ['a boy','boy','happy'],['a lad','boy','happy'],['a boy','boy','upset'],
    ['an explorer','explorer','happy'],['a knight','knight','upset']
  ]) {
    const input='Draw '+surface+' with '+(value==='upset' ? 'an' : 'a')+' '+value+' face';
    const {candidates}=await reader.propose(input,{evidence:true});
    const complete=candidates.find(c=>{
      const wires=parse(c.sop);
      const target=wires.find(w=>w.type==='w.request.target' && get(w,'family')==='drawn' &&
        get(w,'mode')==='new' && get(w,'sort')===sort);
      return target && wires.some(w=>get(w,'request')===get(target,'request') &&
        get(w,'attribute')==='drawn.expression' && get(w,'phase')==='result' && get(w,'value')===value);
    });
    assert.ok(complete,input);
    assert.deepEqual(complete.evidence.missing,[]);
  }
  for (const [noun,sort] of [['penguin','penguin'],['trombone','trombone'],['acrobat','acrobat']]) {
    const found=targets(await reader.propose('Draw a '+noun));
    assert.ok(found.some(w=>get(w,'family')==='drawn' && get(w,'sort')===sort),noun);
  }
});

test('joins only registered inventory identities and preserves homonymous families',async t=>{
  const dir=mkdtempSync(fileURLToPath(new URL('../.cache/native-target-inventory-',import.meta.url)));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  writeFileSync(join(dir,'world.sop'),`
@bench std.schema.world name=w.workbench
@device std.schema.kind of=w.workbench.device world=w.workbench acts=make acts=change
@other std.schema.kind of=w.workbench.instrument world=w.workbench acts=make
@item core.type of=k.workbench.device extends=k.workbench.named
@named core.type of=k.workbench.named
@name core.slot of=k.workbench.named key=name kind=atom id=true
@template core.type of=k.workbench.template extends=k.workbench.named
@descriptor core.type of=k.workbench.descriptor
@descriptor.name core.slot of=k.workbench.descriptor key=name kind=string
@profile core.slot of=k.workbench.device key=profile kind=atom type=k.workbench.template by=name
@template.active k.workbench.template name=standard
@nonentity k.workbench.descriptor name=missing
@device.good k.workbench.device name=quilloscope profile=standard
@device.missing k.workbench.device name=unlicensed profile=missing
@device.derived k.workbench.device name=inferred profile=standard derived=true
@device.label core.word of=k.workbench.device.name means=quilloscope text=box text=quilloscopes
@unrelated.label core.word of=k.workbench.template.name means=quilloscope text=polished
@other.box pro.reader.target tab=workbench family=instrument act=make sort=container text=box
@inventory pro.reader.target_inventory tab=workbench family=device act=make mode=new provider=k.workbench.device identity=name requires=profile
@untyped pro.reader.target_inventory tab=workbench family=device act=make mode=new provider=k.workbench.descriptor identity=name
@unlicensed-act pro.reader.target_inventory tab=workbench family=device act=remove mode=existing provider=k.workbench.device identity=name requires=profile
@unlicensed-mode pro.reader.target_inventory tab=workbench family=device act=change mode=new provider=k.workbench.device identity=name requires=profile
`);
  const worlds=loadWorlds({paths:[dir]});
  const reader=createReader(undefined,worlds);t.after(()=>reader.close());
  const projected=(surface,act='make')=>worlds.lookup(surface).filter(([role,verb,family])=>
    role==='target' && verb===act && family==='device');
  assert.deepEqual(projected('quilloscope'),[['target','make','device','new','quilloscope',0]]);
  assert.deepEqual(projected('quilloscopes'),projected('quilloscope'));
  for (const input of ['unlicensed','missing','inferred','polished','standard']) assert.deepEqual(projected(input),[],input);
  assert.deepEqual(projected('quilloscope','remove'),[]);
  assert.deepEqual(projected('quilloscope','change'),[]);
  const interpretations=targets(await reader.propose('Create a box'));
  assert.ok(interpretations.some(w=>get(w,'family')==='device' && get(w,'sort')==='quilloscope'));
  assert.ok(interpretations.some(w=>get(w,'family')==='instrument' && get(w,'sort')==='container'));
});
