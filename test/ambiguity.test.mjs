import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { createReader } from '../src/runtime.mjs';
import { parse } from '../src/schema.mjs';
import { loadWorlds } from '../src/worlds.mjs';

const familyOf = ({sop}) => parse(sop).find(wire => wire.type === 'w.request.target')?.attrs.family[0];

test('proposal preserves every declared family hypothesis before context ranks it', async t => {
  const cache = fileURLToPath(new URL('../.cache/',import.meta.url));
  const dir = mkdtempSync(join(cache,'reader-ambiguity-'));
  t.after(() => rmSync(dir,{recursive:true,force:true}));
  const familyNames = Array.from({length:14},(_,i)=>'instrument_' + (i+1));
  const file = join(dir,'overlay.sop');
  writeFileSync(file,familyNames.map((family,i) =>
    '@fixture.'+family+' pro.reader.target family='+family+' tab=workbench_'+(i+1)+
    ' act=place mode=existing sort=calibrand text=calibrand',
  ).join('\n'));
  const worlds = loadWorlds({paths:[file]});
  const blank = {version:1,examples:[],templates:[]};
  const neutral = createReader(blank,worlds);
  t.after(() => neutral.close());
  const text = 'move the calibrand';
  const proposal = await neutral.propose(text);
  const families = proposal.candidates.map(familyOf).filter(Boolean);
  assert.deepEqual(new Set(families),new Set(familyNames));
  assert.equal(proposal.candidateCount,proposal.candidates.length);
  assert.equal(proposal.multipleInterpretations,true);

  // Give the old context model a large family weight for a lower-ranked reading.
  // The proposal generator must use the same utterance-only order.
  const promoted = families.at(-1);
  const tab = 'workbench_' + (familyNames.indexOf(promoted)+1);
  const stale = createReader({...blank,context:{
    calibrand:[['family:'+promoted,1000],['family:removed_family',1000]],
  }},worlds);
  t.after(() => stale.close());
  assert.deepEqual(await stale.propose(text),proposal);

  const pipeline = await stale.formalise(text,{tab});
  assert.equal(familyOf(pipeline),promoted);
  assert.deepEqual(new Set([pipeline,...pipeline.alternatives].map(c=>c.sop)),
    new Set(proposal.candidates.map(c=>c.sop)));
  assert.equal(pipeline.candidateCount,proposal.candidateCount);
});
