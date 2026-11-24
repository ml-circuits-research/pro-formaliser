import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createReader } from '../src/runtime.mjs';
import { loadWorlds } from '../src/worlds.mjs';
import { parse } from '../src/schema.mjs';

const decode = value => value?.startsWith('"') ? JSON.parse(value) : value;
function properties(wires) {
  return Object.fromEntries(wires.filter(wire => wire.type === 'w.request.constraint')
    .map(wire => ['attribute','value'].map(key => decode(wire.attrs[key]?.[0]))));
}
async function proves(reader,text,expected) {
  const {candidates}=await reader.propose(text,{evidence:true});
  const result=candidates.find(candidate=>{
    if (candidate.source!=='argument-frame') return false;
    const values=properties(parse(candidate.sop));
    return Object.entries(expected).every(([key,value])=>values[key]===value);
  });
  assert.ok(result,text);
  assert.deepEqual(result.evidence.missing,[]);
  assert.deepEqual(result.catalog.issues,[]);
  assert.equal(result.evidence.counts.unread,undefined);
  return result;
}

test('binds analytical chart layouts in either owner order without learned examples', async t => {
  const reader=createReader();
  t.after(()=>reader.close());
  await proves(reader,"I'd like units per transaction, by state as a column chart",
    {'chart.type':'bar','chart.measure':'units per transaction','chart.dimension':'state','chart.orientation':'vertical'});
  const bar=await proves(reader,"I'd like units per transaction, by state as a bar chart",
    {'chart.type':'bar','chart.measure':'units per transaction','chart.dimension':'state'});
  assert.equal(properties(parse(bar.sop))['chart.orientation'],undefined);
  await proves(reader,'We want average advertising spend versus segment as a bar chart',
    {'chart.type':'bar','chart.aggregate':'avg','chart.measure':'advertising spend','chart.dimension':'segment'});
  await proves(reader,'Make a line graph of the summed sales forecast across the months',
    {'chart.type':'line','chart.aggregate':'sum','chart.measure':'sales forecast','chart.period':'month'});
  await proves(reader,'We need a bar chart of month-by-month totals of orders',
    {'chart.type':'bar','chart.period':'month','chart.aggregate':'sum','chart.measure':'orders'});
  await proves(reader,'Draw a line chart of tickets as totals by week',
    {'chart.type':'line','chart.measure':'tickets','chart.aggregate':'sum','chart.period':'week'});
});

test('loads a distinct analytical layout through a normal reader overlay', async t => {
  const dir=mkdtempSync(join(tmpdir(),'analytical-overlay-'));
  t.after(()=>rmSync(dir,{force:true,recursive:true}));
  const path=join(dir,'analysis.sop');
  writeFileSync(path,[
    '@audit std.schema.world name=w.audit',
    '@screen std.schema.kind of=w.audit.screen world=w.audit acts=make',
    '@view w.request.key tab=audit family=screen name=screen.view head=class value=weekly',
    '@operation w.request.key tab=audit family=screen name=screen.combine head=class value=union',
    '@subject w.request.key tab=audit family=screen name=screen.subject head=span',
    '@partition w.request.key tab=audit family=screen name=screen.partition head=span',
    '@style w.request.key tab=audit family=screen name=screen.style head=class value=grid',
    '@frame pro.reader.analytical_frame tab=audit family=screen layout=trailing_owner prefix=build owner="a weekly matrix" owner_key=screen.view owner_value=weekly owner_marker=as measure=screen.subject grouping=screen.partition group_marker=across operation=screen.combine operation_marker=of',
    '@boundary pro.reader.analytical_boundary tab=audit family=screen text="capped at" numeric_modifier=deep',
    '@matrix.style pro.reader.analytical_owner_property tab=audit family=screen owner_key=screen.view owner_value=weekly text="a weekly matrix" key=screen.style value=grid',
    '@union core.word text=unioned means=union of=screen.combine'
  ].join('\n'));
  const reader=createReader(undefined,loadWorlds({paths:[path]}));
  t.after(()=>reader.close());
  await proves(reader,'Build unioned inspection results across delivery teams as a weekly matrix',
    {'screen.view':'weekly','screen.combine':'union','screen.subject':'inspection results','screen.partition':'delivery teams','screen.style':'grid'});
  for (const text of [
    'Build weighted inspection results across delivery teams as a weekly matrix',
    'Build unioned inspection results if asked across delivery teams as a weekly matrix',
    'Build unioned inspection results across delivery teams and delete the plot as a weekly matrix',
    'Build unioned inspection results across delivery teams as a quarterly matrix',
    'Build unioned inspection results across delivery teams capped at ten as a weekly matrix',
    'Build unioned inspection results across 10-deep team strata as a weekly matrix',
  ]) {
    const {candidates}=await reader.propose(text);
    assert.ok(candidates.every(candidate=>candidate.source!=='argument-frame'),text);
  }
});

test('keeps binning and comparison clauses out of open analytical operands', async t => {
  const reader=createReader();
  t.after(()=>reader.close());
  for (const text of [
    'Can you show sales grouped by 500-wide price band as a bar chart?',
    "I'd like sales grouped by 500-wide price band as a bar chart",
    "I'd like sales by 500-wide price band as a bar chart",
    "I'd like sales by year higher than the monthly average as a bar chart",
    'Can you show just sales month by month above the monthly average as a line chart?',
    'Show just sales month by month above the monthly average as a line chart',
  ]) {
    const {candidates}=await reader.propose(text);
    assert.ok(candidates.every(candidate=>candidate.source!=='argument-frame'),text);
    assert.ok(candidates.every(candidate=>properties(parse(candidate.sop))['chart.aggregate']!=='avg'),text);
  }
  await proves(reader,"I'd like grouped sales by 2025 region as a column chart",
    {'chart.type':'bar','chart.measure':'grouped sales','chart.dimension':'2025 region'});
  await proves(reader,"I'd like sales grouped by state as a bar chart",
    {'chart.type':'bar','chart.measure':'sales','chart.dimension':'state'});
});
