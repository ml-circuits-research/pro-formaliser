import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createReader } from '../src/runtime.mjs';
import { validate } from '../src/schema.mjs';
import { loadWorlds } from '../src/worlds.mjs';

const model={version:1,examples:[],templates:[]};
const related=async (reader,text)=>{
  const result=await reader.propose(text,{evidence:true});
  return result.candidates.filter(candidate=>candidate.source==='contextual-effects');
};

test('typed property commands defer their omitted owner, retaining authored property and value',async t=>{
  const worlds=loadWorlds(), reader=createReader(model,worlds);
  t.after(()=>reader.close());
  for (const [text,attribute,value] of [
    ['Now move the legend to the bottom','chart.legend','bottom'],
    ['Try the colour bar scale logarithmic','chart.colourBarScale','log'],
    ['Move the x axis on the top','chart.xAxis','top'],
  ]) {
    const [candidate]=await related(reader,text);
    assert.ok(candidate,text);
    assert.equal(candidate.status,'matched');
    assert.match(candidate.sop,/family="chart" mode=existing fill=context\b/u);
    assert.match(candidate.sop,/w.request.lookup request=\$r target=\$t key=thing from=page/u);
    assert.ok(candidate.sop.includes('attribute="'+attribute+'" phase=result'));
    assert.ok(candidate.sop.trimEnd().endsWith('value='+value));
    assert.ok(validate(candidate.sop,worlds));
    assert.deepEqual(candidate.catalog.issues,[]);
    assert.deepEqual(candidate.evidence.missing,[]);
    assert.equal(candidate.evidence.counts.uncovered ?? 0,0);
  }

  const [combined]=await related(reader,'Set the grid lines to solid and legend on the right');
  assert.ok(combined);
  assert.equal(combined.sop.match(/w.request.target\b/gu)?.length,1);
  assert.match(combined.sop,/attribute="chart.gridStyle".*value=solid/u);
  assert.match(combined.sop,/attribute="chart.legend".*value=right/u);

  for (const text of [
    'Move the legend to the bottom of the Sales chart',
    'Do not move the x axis on the top',
    'Move the x axis on the top if needed',
    'Move the "x axis" on the top',
    'Make the legend blue',
    'Title "Quarterly results"',
    'Move the legend to the bottom and legend on the right',
  ]) assert.deepEqual(await related(reader,text),[],text);
});

test('an unrelated world uses the same deferred owner and closed property grammar',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'contextual-effects-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  writeFileSync(join(dir,'console.sop'),[
    '@w.console std.schema.world name=w.console',
    '@instrument std.schema.kind of=w.console.instrument world=w.console acts=change',
    '@noun pro.reader.target of=w.console.instrument family=instrument act=change mode=existing text=instrument',
    '@dial w.request.key tab=console family=instrument name=instrument.dialPosition head=class value=top value=bottom',
    '@dial_phrase pro.reader.effect_sense family=instrument key=instrument.dialPosition text=dial',
    '@panel std.schema.kind of=w.console.panel world=w.console acts=change',
    '@panel_noun pro.reader.target of=w.console.panel family=panel act=change mode=existing text=panel',
    '@panel_dial w.request.key tab=console family=panel name=panel.dial head=class value=top value=bottom',
    '@panel_phrase pro.reader.effect_sense family=panel key=panel.dial text=dial',
  ].join('\n'));
  const worlds=loadWorlds({paths:[dir]}), reader=createReader(model,worlds);
  t.after(()=>reader.close());
  const alternatives=await related(reader,'Move the dial to the bottom');
  const candidate=alternatives.find(c=>c.sop.includes('family="instrument"'));
  assert.ok(alternatives.some(c=>c.sop.includes('family="panel"') && c.sop.includes('attribute="panel.dial"')));
  assert.ok(candidate);
  assert.match(candidate.sop,/family="instrument" mode=existing fill=context/u);
  assert.match(candidate.sop,/attribute="instrument.dialPosition".*value=bottom/u);
  assert.deepEqual(candidate.catalog.issues,[]);
  assert.ok(validate(candidate.sop,worlds));
  assert.deepEqual(await related(reader,'Move the dial to the left'),[]);
});
