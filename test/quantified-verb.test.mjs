import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { createReader } from '../src/runtime.mjs';
import { evidenceInText } from '../src/grounding.mjs';
import { parse, validate } from '../src/schema.mjs';
import { loadWorlds } from '../src/worlds.mjs';

const proposal=async (reader,text)=> (await reader.propose(text)).candidates
  .filter(candidate=>candidate.source==='quantified-verb');

test('binds a relative signed change to every member of a contextual group',async t=>{
  const worlds=loadWorlds({paths:['sop-worlds']});
  const reader=createReader(undefined,worlds);
  t.after(()=>reader.close());
  const text='I want to slant all of them by 15';
  const choices=await proposal(reader,text);
  assert.equal(choices.length,1);
  const [{sop}]=choices, [request,target,lookup,effect]=parse(sop);
  assert.deepEqual(request.attrs.predicate,['"slant"']);
  assert.deepEqual(target.attrs.mode,['bound']);
  assert.deepEqual(target.attrs.fill,['context']);
  assert.deepEqual(target.attrs.quantifier,['"all"']);
  assert.deepEqual(lookup.attrs.from,['previous']);
  assert.deepEqual(effect.attrs.attribute,['"drawn.skew"']);
  assert.deepEqual(effect.attrs.operator,['delta']);
  assert.deepEqual(effect.attrs.step,['more']);
  assert.deepEqual(effect.attrs.value,['"15"']);
  assert.equal(effect.attrs.unit,undefined);
  assert.ok(evidenceInText(text,sop,worlds));
  assert.ok(validate(sop,worlds));
  for (const [text,operator,step,value,unit] of [
    ['Slant it by -15','delta','less','15',undefined],
    ['Slant it to -15','eq',undefined,'-15',undefined],
    ['Skew them by six degrees','delta','more','six degrees','degree'],
  ]) {
    const [candidate]=await proposal(reader,text);
    assert.ok(candidate,text);
    const result=parse(candidate.sop).find(w=>w.type==='w.request.constraint');
    assert.equal(result.attrs.operator[0],operator);
    assert.equal(result.attrs.step?.[0],step);
    assert.equal(JSON.parse(result.attrs.value[0]),value);
    assert.equal(result.attrs.unit ? JSON.parse(result.attrs.unit[0]) : undefined,unit);
  }
  for (const text of [
    'Do not slant them by 15', 'Slant them by 15 if needed', 'Slant all of it by 15',
    'Slant them by 15 seconds', 'Slant them by the gate', 'What does slant them by 15 mean?',
    'They slant them by 15', 'Slant them by 15 and delete them',
  ]) assert.deepEqual(await proposal(reader,text),[],text);
});

test('reuses native comparative verb senses for independently identified owners',async t=>{
  const reader=createReader(undefined,loadWorlds({paths:['sop-worlds']}));
  t.after(()=>reader.close());
  const choices=await proposal(reader,'Narrow the box by two inches');
  assert.ok(choices.some(choice=>choice.sop.includes('attribute="node.width" operator=delta') &&
    choice.sop.includes('step=less measure=2 unit="inch"')));
  assert.deepEqual(await proposal(reader,'Narrow the box by -2'),[]);
});

test('reads an unrelated declaration with its own authorized object, markers, and scale',async t=>{
  const directory=mkdtempSync(fileURLToPath(new URL('../.cache/quantified-verb-',import.meta.url)));
  t.after(()=>rmSync(directory,{recursive:true,force:true}));
  const overlay=join(directory,'overlay.sop');
  writeFileSync(overlay,`
@weave std.schema.world name=w.weave
@loom std.schema.kind of=w.weave.loom world=w.weave acts=change
@flux w.request.key tab=weave family=loom name=loom.flux head=number
@quantitative pro.reader.quantified_verb family=loom key=loom.flux step=less text=relax
@relative pro.reader.quantified_marker operator=delta text=via
@exact pro.reader.quantified_marker operator=eq text=at
`);
  const worlds=loadWorlds({paths:['sop-worlds',overlay]});
  const reader=createReader(undefined,worlds);
  t.after(()=>reader.close());
  for (const [text,operator] of [['Relax the loom via 7','delta'],['Relax the loom at 7','eq']]) {
    const [alt]=await proposal(reader,text);
    assert.ok(alt,text);
    assert.ok(alt.sop.includes('attribute="loom.flux" operator='+operator));
    assert.equal(alt.sop.includes('step=less'),operator==='delta');
    assert.ok(validate(alt.sop,worlds));
  }
  assert.deepEqual(await proposal(reader,'Relax the kettle via 7'),[]);
});
