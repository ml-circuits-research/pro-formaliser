import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { createReader } from '../src/runtime.mjs';
import { loadWorlds } from '../src/worlds.mjs';
import { parse, validate } from '../src/schema.mjs';
import { evidenceInText } from '../src/grounding.mjs';
import { compileOwnedEffects, ownedEffectReadings } from '../src/owned-effects.mjs';

const moduleFacts=parse(readFileSync(new URL('../sop-worlds/pro.reader/owned-effects.sop',import.meta.url),'utf8'));
const comparisonFacts=parse(readFileSync(new URL('../.cache/knowledge/docs/worlds/k.values/shards/scales.sop',import.meta.url),'utf8'));
const compiler=(worlds,extra=[])=>compileOwnedEffects(type=>
  [...moduleFacts,...comparisonFacts,...extra].filter(wire=>wire.type===type),worlds.requestKeys,worlds.ownerPropertyLabels);

test('uses for as property ownership when a typed value and existing owner are grounded',async t=>{
  const reader=createReader();
  t.after(()=>reader.close());
  for (const [text,owner,key,value] of [
    ['a sad face for the man','the man','drawn.expression','sad'],
    ['a happy face for the woman','the woman','drawn.expression','happy'],
    ['a left legend for the chart','the chart','chart.legend','left'],
  ]) {
    const {candidates}=await reader.propose(text,{evidence:true});
    const reading=candidates.find(c=>c.source==='owned-effects' && c.sop.includes('description="'+owner+'"') &&
      c.sop.includes('attribute="'+key+'"') && c.sop.includes('value='+value));
    assert.ok(reading,text);
    assert.deepEqual(reading.evidence.missing,[]);
    assert.equal(reading.evidence.counts.unread,undefined);
    assert.equal(reading.evidence.counts.uncovered,undefined);
  }
  for (const text of ['a sad face for the notes','not a sad face for the man','Create a chart for the board']) {
    const {candidates}=await reader.propose(text);
    assert.ok(candidates.every(candidate=>candidate.source!=='owned-effects'),text);
  }
  const {candidates}=await reader.propose('Create a chart for the board');
  assert.ok(candidates.some(candidate=>candidate.sop.includes('role=purpose value="the board"')));
});

test('keeps the exact titled owner separate from both quoted text and coordinated effects',()=>{
  const worlds=loadWorlds({paths:['sop-worlds']});
  const grammar=compiler(worlds);
  const inputs=[
    ['Could you title the Seasonal orders chart "Q4 — as promised" and hide the grid?',
      /description="the Seasonal orders chart"/u,/attribute="chart.title".*value="Q4 — as promised"/u,
      /attribute="chart.grid".*value=hide/u],
    ['Operating costs: grid lines dotted; put the y axis on the right',
      /name="Operating costs"/u,/attribute="chart.gridStyle".*value=dotted/u,
      /attribute="chart.axisSide".*value=right/u],
    ['The font on Shipping trends should be bigger and then do the grid lines dashed on Shipping trends',
      /name="Shipping trends"/u,/attribute="chart.fontSize".*operator=delta step=more/u,
      /attribute="chart.gridStyle".*value=dashed/u],
    ['The bars on Revenue by department should be horizontal',
      /name="Revenue by department"/u,/attribute="chart.horizontal".*value=on/u],
    ['Move the legend to the left of the Revenue chart',
      /description="the Revenue chart"/u,/attribute="chart.legend".*value=left/u],
    ['Move the colour bar position to the bottom of the Revenue chart',
      /description="the Revenue chart"/u,/attribute="chart.colourBarPosition".*value=bottom/u],
  ];
  for (const [text,...expected] of inputs) {
    const [candidate]=ownedEffectReadings(text,worlds,grammar);
    assert.ok(candidate,text);
    for (const pattern of expected) assert.match(candidate.sop,pattern);
    assert.ok(validate(candidate.sop,worlds));
    assert.ok(evidenceInText(text,candidate.sop,worlds));
    assert.equal(parse(candidate.sop).filter(wire=>wire.type==='w.request.target').length,1);
  }
  for (const text of [
    'Do not title the Orders chart "Q4"',
    'Could you title the Orders chart "Q4" if the numbers come in?',
    'What does title the Orders chart "Q4" mean?',
    'Title the Orders chart "Q4" and hide the grid on the Costs chart',
    'Title the Orders chart "Q4" and remove the Costs chart',
    'Title the Orders chart "Q4" and title "Q5"',
    'Could you title "Q4"?',
    'The cost bars on Revenue by department should be horizontal',
    'The revenue bars on Revenue by department should be horizontal',
  ]) assert.deepEqual(ownedEffectReadings(text,worlds,grammar),[],text);
});

test('requires a real catalog key and supports a separately loaded owner family',async t=>{
  const directory=mkdtempSync(fileURLToPath(new URL('../.cache/owned-effects-',import.meta.url)));
  t.after(()=>rmSync(directory,{recursive:true,force:true}));
  const path=join(directory,'rig.sop');
  const schema=`
@rig std.schema.world name=w.rig
@modulator std.schema.kind of=w.rig.modulator world=w.rig acts=change
@target pro.reader.target of=w.rig.modulator family=rig mode=existing act=change text=modulator
@tag w.request.key tab=rig family=rig name=rig.tag head=span
@rate w.request.key tab=rig family=rig name=rig.rate head=number
`;
  const newSenses=`
@signal pro.reader.effect_sense family=rig key=rig.tag text=stamp property_command=true
@alternate pro.reader.effect_sense family=rig key=rig.tag text=inscribe property_command=true
@pulse pro.reader.effect_sense family=rig key=rig.rate text=pulse
@invalid pro.reader.effect_sense family=rig key=rig.absent text=pace
`;
  writeFileSync(path,schema+'\n'+newSenses);
  const worlds=loadWorlds({paths:['sop-worlds',path]});
  const grammar=compiler(worlds,parse(newSenses));
  const text='Stamp the main modulator "Ready and waiting" and set the pulse to six';
  const [candidate]=ownedEffectReadings(text,worlds,grammar);
  assert.ok(candidate,text);
  assert.match(candidate.sop,/family="rig".*description="the main modulator"/u);
  assert.match(candidate.sop,/attribute="rig.tag".*value="Ready and waiting"/u);
  assert.match(candidate.sop,/attribute="rig.rate".*value=6/u);
  assert.ok(validate(candidate.sop,worlds));
  assert.ok(evidenceInText(text,candidate.sop,worlds));
  const reader=createReader(undefined,worlds);
  t.after(()=>reader.close());
  for (const verb of ['Stamp','Inscribe']) {
    const query=text.replace('Stamp',verb);
    const {candidates}=await reader.propose(query);
    assert.ok(candidates.some(c=>c.source==='owned-effects' && c.sop.includes('attribute="rig.tag"') &&
      c.sop.includes('attribute="rig.rate"')),query);
  }
  assert.deepEqual(ownedEffectReadings('Stamp the main modulator "Ready" and set the pace to six',worlds,grammar),[]);
});
