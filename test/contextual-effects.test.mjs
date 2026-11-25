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
    '@dial w.request.key family=instrument name=instrument.dialPosition head=class value=top value=bottom',
    '@dial_phrase pro.reader.effect_sense family=instrument key=instrument.dialPosition text=dial',
    '@caption w.request.key family=instrument name=instrument.caption head=span',
    '@caption_phrase pro.reader.effect_sense family=instrument key=instrument.caption text=caption property_command=true',
    '@panel std.schema.kind of=w.console.panel world=w.console acts=change',
    '@panel_noun pro.reader.target of=w.console.panel family=panel act=change mode=existing text=panel',
    '@panel_dial w.request.key family=panel name=panel.dial head=class value=top value=bottom',
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
  const [anaphor]=await related(reader,'Move the dial to the top and give it the caption Bench seven');
  assert.ok(anaphor);
  assert.match(anaphor.sop,/attribute="instrument.caption".*value="Bench seven"/u);
  assert.match(anaphor.sop,/attribute="instrument.dialPosition".*value=top/u);
  assert.ok(validate(anaphor.sop,worlds));
});

test('retains a shared chart across named and anaphoric property effects',async t=>{
  const worlds=loadWorlds(), reader=createReader(model,worlds);
  t.after(()=>reader.close());
  const named='The colour bar scale on Sensor readings by depth want to be logarithmic';
  for (const text of [named,named+'. Font bigger',
    'The colour bar scale on Coastal freight in July wants to be linear. Font bigger']) {
    const {candidates}=await reader.propose(text);
    const reading=candidates.find(candidate=>candidate.source==='owned-effects');
    assert.ok(reading,text);
    const name=text.includes('Sensor') ? 'Sensor readings by depth' : 'Coastal freight in July';
    assert.ok(reading.sop.includes('fill=written name="'+name+'"'),text);
    assert.match(reading.sop,/attribute="chart.colourBarScale".*operator=eq value=(?:log|linear)/u);
    assert.equal(reading.sop.includes('attribute="chart.fontSize"'),text.endsWith('Font bigger'));
    assert.ok(validate(reading.sop,worlds));
  }

  const primary='Set the colour bar scale logarithmic, and could you also give it the title Sensor readings';
  const [context]=await related(reader,primary);
  assert.ok(context);
  assert.equal(context.status,'matched');
  assert.match(context.sop,/attribute="chart.title".*value="Sensor readings"/u);
  assert.match(context.sop,/attribute="chart.colourBarScale".*value=log/u);
  assert.equal(context.sop.match(/w.request.target\b/gu)?.length,1);
  assert.ok(validate(context.sop,worlds));
  assert.deepEqual(context.catalog.issues,[]);

  const [unseen]=await related(reader,'Set the colour bar scale linear and please give it the title "North and South"');
  assert.ok(unseen);
  assert.match(unseen.sop,/attribute="chart.title".*value="North and South"/u);
  const [isolated]=await related(reader,'Give it the title Sensor readings');
  assert.ok(isolated);
  assert.match(isolated.sop,/family="chart" mode=existing fill=context/u);
  assert.match(isolated.sop,/attribute="chart.title".*value="Sensor readings"/u);
  for (const text of [
    'Set the colour bar scale linear and give them the title Sensor readings',
    'Set the colour bar scale linear, that is the glossary, give it the title Later',
    "Set the colour bar scale linear, that's not the tweak, could you give it the title Sensor readings",
    'Set the colour bar scale linear and give it the title Sensor readings font bigger',
    'Set the colour bar scale linear and give it the title Sensor readings if that works',
    'Set the colour bar scale linear and give it the title Sensor readings move the legend',
  ]) assert.deepEqual(await related(reader,text),[],text);

  const {candidates}=await reader.propose(named+'. The font on Freight costs should be bigger');
  assert.ok(candidates.every(candidate=>candidate.source!=='owned-effects' ||
    !(candidate.sop.includes('chart.fontSize') && candidate.sop.includes('chart.colourBarScale'))));
});
