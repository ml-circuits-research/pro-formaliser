import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
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
    '@ordered pro.reader.analytical_frame tab=audit family=screen layout=ordered_fields prefix=assemble owner="a weekly matrix" owner_key=screen.view owner_value=weekly pattern="{$owner} for {screen.subject}, partitioned across {screen.partition}, combined by {screen.combine}"',
    '@adjacent pro.reader.analytical_frame tab=audit family=screen layout=ordered_fields prefix=merge owner="a weekly matrix" owner_key=screen.view owner_value=weekly pattern="{$owner} for {screen.subject} {screen.partition}"',
    '@boundary pro.reader.analytical_boundary tab=audit family=screen text="capped at" numeric_modifier=deep',
    '@matrix.style pro.reader.analytical_owner_property tab=audit family=screen owner_key=screen.view owner_value=weekly text="a weekly matrix" key=screen.style value=grid',
    '@union core.word text=unioned means=union of=screen.combine'
  ].join('\n'));
  const reader=createReader(undefined,loadWorlds({paths:[path]}));
  t.after(()=>reader.close());
  await proves(reader,'Build unioned inspection results across delivery teams as a weekly matrix',
    {'screen.view':'weekly','screen.combine':'union','screen.subject':'inspection results','screen.partition':'delivery teams','screen.style':'grid'});
  await proves(reader,'Assemble a weekly matrix for repair results, partitioned across shift teams, combined by unioned',
    {'screen.view':'weekly','screen.combine':'union','screen.subject':'repair results','screen.partition':'shift teams','screen.style':'grid'});
  for (const text of [
    'Merge a weekly matrix for result groups',
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

test('opt-in scatter field mappings preserve axis semantics without creating axis titles',async t=>{
  const path=new URL('../sop-worlds/scatter-fields-pilot/',import.meta.url);
  const original=createReader();
  const reader=createReader(undefined,loadWorlds({paths:[fileURLToPath(path)]}));
  t.after(async()=>{await original.close();await reader.close()});
  const source='Make a scatter plot of defect rate against elapsed minutes, colored by repair crew';
  const expected={
    'chart.type':'scatter','chart.xField':'elapsed minutes','chart.yField':'defect rate','chart.colourBy':'repair crew',
  };
  const result=await proves(reader,source,expected);
  const props=properties(parse(result.sop));
  for (const key of ['chart.x','chart.y','chart.xLabel','chart.yLabel','chart.measure','chart.dimension']) {
    assert.equal(props[key],undefined,key);
  }
  assert.ok((await original.propose(source)).candidates.every(candidate=>
    !properties(parse(candidate.sop))['chart.xField']));

  await proves(reader,'Display net repairs against technician tenure, coloured by office in a scatter plot',{
    'chart.type':'scatter','chart.xField':'technician tenure','chart.yField':'net repairs','chart.colourBy':'office',
  });
  await proves(reader,'Draw a scatter plot with heater load on the x axis, fuel draw on the y axis, coloured by unit',{
    'chart.type':'scatter','chart.xField':'heater load','chart.yField':'fuel draw','chart.colourBy':'unit',
  });
  for (const [x,y] of [['heater load','fuel draw'],['fuel draw','heater load']]) {
    await proves(reader,'Draw a scatter plot of heater load versus fuel draw, coloured by unit',{
      'chart.type':'scatter','chart.xField':x,'chart.yField':y,'chart.colourBy':'unit',
    });
  }

  for (const text of [
    'Make a scatter plot of defect rate against elapsed minutes shown together, colored by repair crew',
    'Make a scatter plot of defect rate against elapsed minutes, labeled by repair crew',
    'Make a scatter plot of defect rate against elapsed minutes, colored by repair crew if asked',
    'Make a line plot of defect rate against elapsed minutes, colored by repair crew',
    'Do not make a scatter plot of defect rate against elapsed minutes, colored by repair crew',
  ]) {
    const {candidates}=await reader.propose(text);
    assert.ok(candidates.every(candidate=>!properties(parse(candidate.sop))['chart.xField']),text);
  }
  const followup=await reader.propose(source+' and delete the plot');
  const mappings=followup.candidates.filter(candidate=>properties(parse(candidate.sop))['chart.xField']);
  assert.ok(mappings.length);
  assert.ok(mappings.every(({sop})=>{
    const wires=parse(sop);
    return properties(wires)['chart.colourBy']==='repair crew' &&
      wires.some(wire=>wire.type==='w.request.request' && decode(wire.attrs.act?.[0])==='remove' ||
        wire.type==='w.request.unread' && decode(wire.attrs.text?.[0]).includes('delete the plot'));
  }));

});

test('a fronted location survives an addressed request as a separate source span',async t=>{
  const path=fileURLToPath(new URL('../sop-worlds/scatter-fields-pilot/',import.meta.url));
  const reader=createReader(undefined,loadWorlds({paths:[path]}));
  t.after(()=>reader.close());
  const body='make a scatter plot of salary against tenure, coloured by department';
  const {candidates}=await reader.propose('On the regional slide, could you '+body+'?',{evidence:true});
  const result=candidates.find(c=>properties(parse(c.sop))['chart.xField']==='tenure');
  assert.ok(result);
  assert.equal(result.status,'partial');
  assert.deepEqual(result.evidence.missing,[]);
  assert.deepEqual(result.catalog.issues,[]);
  const wires=parse(result.sop);
  assert.equal(properties(wires)['chart.yField'],'salary');
  assert.ok(wires.some(w=>w.type==='w.request.unread' && decode(w.attrs.text[0])==='On the regional slide'));
  for (const lead of ['If the summary changes, could you','Did you','On the regional slide, did you']) {
    const {candidates}=await reader.propose(lead+' '+body+'?');
    assert.ok(candidates.every(c=>!properties(parse(c.sop))['chart.xField']),lead);
  }
});
