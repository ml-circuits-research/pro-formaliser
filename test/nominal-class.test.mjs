import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createReader } from '../src/runtime.mjs';
import { nominalClassReading } from '../src/nominal-class.mjs';
import { tokens } from '../src/lexicon.mjs';
import { quotedSpans } from '../src/literal-roles.mjs';
import { loadWorlds } from '../src/worlds.mjs';

const circuit=(sort='chart')=>({sop:'@r w.request.request act=make mood=do\n@t w.request.target request=$r mode=new family=chart sort='+sort});
const worlds=loadWorlds();
const read=(text,c=circuit())=>nominalClassReading(text,tokens(text),quotedSpans(text),c,worlds);

test('a declared compound noun keeps its target and supplies its catalog value',()=>{
  const answer=read('Make a scatter plot of events',circuit('plot'));
  assert.match(answer.sop,/attribute=chart.type value=scatter words="scatter plot"/);
  assert.ok(!read('Make a chart titled “bar chart”'));
  assert.ok(!read('Make a chart from the line',circuit()));
  assert.ok(!read('Make a zinc chart',circuit()));
  assert.ok(!read('Make a line chart and a bar chart',circuit()));
});

test('an installed world can classify a new target noun without a training model',async t=>{
  const dir=mkdtempSync(fileURLToPath(new URL('../.cache/noun-kind-',import.meta.url)));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  writeFileSync(join(dir,'roles.sop'),[
    '@bench std.schema.world name=w.workbench',
    '@device std.schema.kind of=w.workbench.device world=w.workbench acts=make',
    '@probe core.word text=quilloscope means=w.workbench.device',
    '@key w.request.key tab=workbench family=device name=device.medium head=candidate value=quartz value=silicon',
    '@kind pro.reader.nominal_class tab=workbench family=device attribute=device.medium noun="quilloscope"',
  ].join('\n'));
  const reader=createReader(undefined,loadWorlds({paths:[dir]}));
  try {
    const {candidates}=await reader.propose('Make a quartz quilloscope');
    assert.ok(candidates.some(c=>c.sop.includes('device.medium') && c.sop.includes('quartz')));
  } finally { await reader.close(); }
});
