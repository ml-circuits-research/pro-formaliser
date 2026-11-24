import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { sequenceReading } from '../src/argument-sequences.mjs';
import { createReader } from '../src/runtime.mjs';
import { parse } from '../src/schema.mjs';
import { loadWorlds } from '../src/worlds.mjs';

const value = raw => raw?.startsWith('"') ? JSON.parse(raw) : raw;
function bindings(sop) {
  return Object.fromEntries(parse(sop).filter(w=>w.type==='w.request.constraint').map(({attrs})=>
    [value(attrs.attribute[0]),[value(attrs.value?.[0]),value(attrs.words?.[0])]]));
}
function hasBindings(candidates,expected) {
  return candidates.some(({sop})=>{
    if (!sop) return false;
    const got=bindings(sop);
    return Object.entries(expected).every(([key,pair])=>
      got[key]?.[0]===pair[0] && got[key]?.[1]===pair[1]);
  });
}

test('native argument sequences bind a canonical aggregate and ordered written spans through propose', async () => {
  const reader=createReader(undefined,loadWorlds());
  try {
    for (const [text,aggregate] of [
      ['Make a bar chart of totals by Customer Region for Net Sales',['sum','totals']],
      ['Make a bar chart of average Net Sales by Customer Region',['avg','average']],
      ['Make a bar chart of the average of Net Sales by Customer Region',['avg','average']]
    ]) {
      const {candidates}=await reader.propose(text);
      assert.ok(hasBindings(candidates,{
        'chart.aggregate':aggregate,'chart.measure':['Net Sales','Net Sales'],
        'chart.dimension':['Customer Region','Customer Region']
      }),text);
      assert.ok(candidates.some(candidate=>candidate.source!=='argument-sequence'),text);
    }
    for (const text of [
      'Make a bar chart of totals by Customer Region for',
      'Make a bar chart of totals by Customer Region for Net Sales if ready',
      'Make a bar chart of totals by Customer Region for “Net Sales”',
      'Remove a bar chart of totals by Customer Region for Net Sales'
    ]) {
      const {candidates}=await reader.propose(text);
      assert.ok(candidates.every(candidate=>candidate.source!=='argument-sequence'),text);
    }
  } finally { await reader.close(); }
});

test('native arguments can be installed for an unrelated catalog through an overlay', async t => {
  const dir=mkdtempSync(fileURLToPath(new URL('../.cache/arg-sequence-overlay-',import.meta.url)));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  writeFileSync(join(dir,'fields.sop'),[
    '@bench std.schema.world name=w.workbench',
    '@device std.schema.kind of=w.workbench.device world=w.workbench acts=make',
    '@noun core.word text="optical quilloscope" means=w.workbench.device',
    '@scheme w.request.key tab=workbench family=device name=device.scheme head=class value=survey',
    '@sample w.request.key tab=workbench family=device name=device.sample head=span',
    '@reference w.request.key tab=workbench family=device name=device.reference head=span',
    '@form core.word text=surveying means=survey of=device.scheme',
    '@frame pro.reader.argument_sequence tab=workbench family=device act=make mode=new prefix="optical quilloscope for" part=device.scheme part=device.sample part=versus part=device.reference'
  ].join('\n'));
  const reader=createReader(undefined,loadWorlds({paths:[dir]}));
  try {
    const text='Make an optical quilloscope for surveying Quartz Ore versus Slate Alloy';
    const {candidates}=await reader.propose(text);
    assert.ok(hasBindings(candidates,{
      'device.scheme':['survey','surveying'],'device.sample':['Quartz Ore','Quartz Ore'],
      'device.reference':['Slate Alloy','Slate Alloy']
    }),text);
  } finally { await reader.close(); }
});

test('an occupied result field and off-anchor target block sequence augmentation', () => {
  const text='Make chart of total Revenue by Account';
  const candidate={sop:[
    '@r w.request.request act=make predicate=Make',
    '@t w.request.target request=$r family=chart mode=new family_words=chart',
    '@u w.request.unread request=$r text="total Revenue by Account"'
  ].join('\n'),status:'partial'};
  const proof={act:'make',family:'chart',mode:'new',anchor:5,start:14,end:text.length,
    bindings:[['chart.aggregate','sum',14,19],['chart.measure','',20,27],['chart.dimension','',31,38]]};
  const output=sequenceReading(text,candidate,proof);
  assert.ok(output);
  assert.equal(output.sop.includes('w.request.unread'),false);
  assert.equal(sequenceReading(text,candidate,{...proof,anchor:11}),undefined);
  const conflict='@c w.request.constraint request=$r on=attribute attribute=chart.aggregate value=sum operator=ne phase=result';
  assert.equal(sequenceReading(text,{...candidate,sop:candidate.sop+'\n'+conflict},proof),undefined);
});
