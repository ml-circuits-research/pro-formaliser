import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createReader } from '../src/runtime.mjs';
import { parse } from '../src/schema.mjs';
import { loadWorlds } from '../src/worlds.mjs';

function valuesOf(sop) {
  return Object.fromEntries(parse(sop ?? '').filter(wire => wire.type === 'w.request.constraint').map(wire => {
    const value = item => item?.startsWith('"') ? JSON.parse(item) : item;
    return [value(wire.attrs.attribute?.[0]), value(wire.attrs.value?.[0])];
  }));
}

test('reads a chart measure and grouping through the normal API without a training model', async () => {
  const reader = createReader(undefined, loadWorlds());
  try {
    const {candidates} = await reader.propose('Make a bar chart of Net Sales grouped by Customer Region');
    assert.ok(candidates.some(({sop}) => {
      const values = valuesOf(sop);
      return values['chart.measure'] === 'Net Sales' && values['chart.dimension'] === 'Customer Region';
    }));
  } finally {
    await reader.close();
  }
});

test('loads a nominal pair from an overlay and preserves its arbitrary text arguments', async t => {
  const dir = mkdtempSync(fileURLToPath(new URL('../.cache/open-pair-overlay-', import.meta.url)));
  t.after(() => rmSync(dir, {recursive:true,force:true}));
  writeFileSync(join(dir,'fields.sop'), [
    '@bench std.schema.world name=w.workbench',
    '@device std.schema.kind of=w.workbench.device world=w.workbench acts=make',
    '@specimen core.word text=quilloscope means=w.workbench.device',
    '@material w.request.key family=device name=device.specimen head=span',
    '@calibration w.request.key family=device name=device.reference head=span',
    '@frame pro.reader.arguments family=device act=make mode=new anchor=nominal first_key=device.specimen second_key=device.reference prefix="quilloscope for" separator="calibrated against"',
  ].join('\n'));
  const reader = createReader(undefined, loadWorlds({paths:[dir]}));
  try {
    const text = 'Make a quilloscope for "Quartz calibrated against Basalt" calibrated against Slate Alloy';
    const {candidates} = await reader.propose(text);
    assert.ok(candidates.some(({sop}) => {
      const values = valuesOf(sop);
      return values['device.specimen'] === 'Quartz calibrated against Basalt' &&
        values['device.reference'] === 'Slate Alloy';
    }));
  } finally {
    await reader.close();
  }
});
