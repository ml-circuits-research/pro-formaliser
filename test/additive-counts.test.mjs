import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createReader } from '../src/runtime.mjs';
import { loadWorlds } from '../src/worlds.mjs';
import { nominalNumberReading } from '../src/nominal-number.mjs';
import { quotedSpans } from '../src/literal-roles.mjs';
import { parse } from '../src/schema.mjs';

const field=(wire,key)=>{
  const value=wire?.attrs[key]?.[0];
  return value?.startsWith('"') ? JSON.parse(value) : value;
};
const target='@r w.request.request act=make mood=do predicate=make\n@t w.request.target request=$r family=node mode=new sort=box sort_words=boxes';

test('retains exact additive amounts and ignores approximations, comparisons and quoted payloads',()=>{
  const worlds=loadWorlds();
  const read=(text,sop=target)=>nominalNumberReading(text,{sop},worlds.nominalNumbers,quotedSpans(text));
  for (const [amount,count] of [['two more',2],['Twenty-One additional',21],['4 extra',4],['a pair of',2]]) {
    const candidate=read('make '+amount+' boxes');
    const node=parse(candidate.sop)[1];
    assert.equal(field(node,'count'),String(count));
    assert.equal(field(node,'count_words'),amount);
  }
  for (const text of ['make a couple of boxes','make more boxes','make some more boxes','make two more boxes than last time',
    'make zero more boxes','make -2 more boxes','make 3.5 more boxes','make a label called "two more boxes"']) {
    assert.equal(read(text),undefined,text);
  }
  assert.equal(read('select two more boxes',target.replace('mode=new','mode=existing')),undefined);
});

test('grounds an installed family and native additive marker through the public reader',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'sop-additive-count-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const path=join(dir,'custom.sop');
  writeFileSync(path,`
@bench std.schema.world name=w.workbench
@prop std.schema.kind of=w.workbench.prop world=w.workbench acts=make
@tile pro.reader.target family=prop sort=tile text=tile text=tiles act=make tab=workbench mode=new
@comparison w.lang.en.phrase name=cmp.more item="onward allotment"
@more w.lang.en.det text=renewed kind=quantifier definite=no number=sg meaning=one-more in=acts
`);
  const reader=createReader(undefined,loadWorlds({paths:[path]}));
  t.after(()=>reader.close());
  for (const [input,count,amount] of [
    ['Make one more tile',1,'one more'],
    ['Make two onward allotment tiles',2,'two onward allotment'],
    ['Make renewed tile',1,'renewed'],
    ['Make another tile',1,'another'],
  ]) {
    const {candidates}=await reader.propose(input);
    assert.ok(candidates.some(c=>parse(c.sop).some(w=>w.type==='w.request.target' &&
      field(w,'family')==='prop' && field(w,'mode')==='new' &&
      field(w,'count')===String(count) && field(w,'count_words')===amount)),input);
  }
});
