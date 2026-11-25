import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createReader } from '../src/runtime.mjs';
import { parse } from '../src/schema.mjs';
import { loadWorlds } from '../src/worlds.mjs';

function read(wire, key) {
  const value = wire.attrs[key]?.[0];
  return value?.startsWith('"') ? JSON.parse(value) : value;
}

function owns(wire, request) {
  return read(wire, 'request') === '$' + request.id;
}

function intents(wires) {
  return wires.filter(wire => wire.type === 'w.request.intent');
}

function intentFields(wire) {
  return ['role', 'value', 'words', 'want'].map(key =>
    read(wire, key) ?? (key === 'want' ? 'yes' : undefined));
}

test('opposite superlatives on one scale supply a literal ordering requirement',async t=>{
  const reader=createReader();
  t.after(()=>reader.close());
  for (const [text,predicate,object,order] of [
    ['Sort it from highest to lowest.','Sort','it','from highest to lowest'],
    ['Please rank them from the oldest to the youngest.','rank','them','from the oldest to the youngest'],
    ['Order the marks from smallest to largest.','Order','the marks','from smallest to largest'],
    ['Rearrange this chart from lowest to highest.','Rearrange','this chart','from lowest to highest'],
    ['Sort from fastest to slowest.','Sort',undefined,'from fastest to slowest'],
  ]) {
    const {candidates}=await reader.propose(text,{evidence:true});
    const candidate=candidates.find(reading=>reading.sop.includes('mode=order') && reading.sop.includes('on=manner'));
    assert.ok(candidate,text);
    const wires=parse(candidate.sop);
    const request=wires.find(wire=>wire.type==='w.request.request');
    const reference=wires.find(wire=>wire.type==='w.request.lookup');
    const constraint=wires.find(wire=>wire.type==='w.request.constraint');
    assert.deepEqual(['act','mode','predicate'].map(key=>read(request,key)),['change','order',predicate],text);
    assert.equal(owns(constraint,request),true,text);
    assert.deepEqual(['on','value','words'].map(key=>read(constraint,key)),['manner',order,order],text);
    if (object) {
      assert.equal(owns(reference,request),true,text);
      assert.deepEqual(['key','words','from'].map(key=>read(reference,key)),['thing',object,undefined],text);
    } else assert.equal(reference,undefined,text);
    assert.ok(wires.every(wire=>!['w.request.target','w.request.unread','w.request.intent'].includes(wire.type)),text);
    assert.deepEqual(candidate.catalog.issues,[],text);
    assert.deepEqual(candidate.evidence.missing,[],text);
    assert.equal(candidate.evidence.counts.uncovered ?? 0,0,text);
  }
  for (const text of ['Move it from highest to lowest.', 'Sort it from Friday to Monday.',
    'Sort it from highest to youngest.', 'Sort it from largest to biggest.',
    'Sort it from highest to lowest?', 'Do not sort it from highest to lowest.',
    'Sort it from highest to lowest if needed.', 'Sort it from highest to lowest or keep it.',
    'Sort it from highest to lowest speed.', 'Sort it from "highest" to "lowest".']) {
    const {candidates}=await reader.propose(text);
    assert.ok(candidates.every(candidate=>!candidate.sop.includes('on=manner')),text);
  }
  const {candidates}=await reader.propose('Draw a circle and sort it from smallest to biggest.');
  assert.ok(candidates.some(candidate=>candidate.sop.includes('mode=order') &&
    candidate.sop.includes('key=thing words=it') && candidate.sop.includes('from smallest to biggest')),true);
});

test('native modal placement keeps the literal moving subject separate from the destination',async t=>{
  const reader=createReader();
  t.after(()=>reader.close());
  for (const [text,subject,predicate,destination] of [
    ['He should be to the right of the man in the orange hat.','He','should be','to the right of the man in the orange hat'],
    ['It should be next to the box.','It','should be','next to the box'],
    ['They should be on the bench.','They','should be','on the bench'],
    ['She should stand next to her.','She','should stand','next to her'],
  ]) {
    const {candidates}=await reader.propose(text,{evidence:true});
    const candidate=candidates.find(reading=>reading.source==='relative-placement');
    assert.ok(candidate,text);
    const wires=parse(candidate.sop);
    const request=wires.find(wire=>wire.type==='w.request.request');
    const reference=wires.find(wire=>wire.type==='w.request.lookup');
    const [intent]=intents(wires);
    assert.equal(read(request,'predicate'),predicate,text);
    assert.equal(read(request,'act'),'place',text);
    assert.equal(read(reference,'words'),subject,text);
    assert.equal(read(reference,'from'),undefined,text);
    assert.equal(owns(reference,request),true,text);
    assert.equal(read(intent,'role'),'destination',text);
    assert.equal(read(intent,'value'),destination,text);
    assert.equal(owns(intent,request),true,text);
    assert.equal(wires.some(wire=>wire.type==='w.request.target'),false,text);
    assert.deepEqual(candidate.catalog.issues,[],text);
    assert.deepEqual(candidate.evidence.missing,[],text);
    assert.equal(candidate.evidence.counts.uncovered ?? 0,0,text);
  }
  for (const text of ['He is next to the tree.', 'Should he be next to the tree?',
    'He should not be next to the tree.', 'He should be next to the tree if ready.',
    'He should be next to the tree or above the box.', 'He should be on standby.', 'He should be in the know.',
    'It should be in focus on the chart.', 'It should be next to the.']) {
    const {candidates}=await reader.propose(text);
    assert.ok(candidates.every(candidate=>candidate.source!=='relative-placement'),text);
  }
});

test('native imperative placement preserves the written object and destination without inventing its family',async t=>{
  const reader=createReader();
  t.after(()=>reader.close());
  for (const [text,object,predicate,destination] of [
    ['Move it under the bridge.','it','Move','under the bridge'],
    ['Put him next to the horse.','him','Put','next to the horse'],
    ['Place that under Red Dock.','that','Place','under Red Dock'],
    ['Move them to the right.','them','Move','to the right'],
  ]) {
    const {candidates}=await reader.propose(text,{evidence:true});
    const reading=candidates.find(candidate=>candidate.source==='relative-placement');
    assert.ok(reading,text);
    const wires=parse(reading.sop);
    const request=wires.find(wire=>wire.type==='w.request.request'), reference=wires.find(wire=>wire.type==='w.request.lookup');
    const [intent]=intents(wires);
    assert.equal(read(request,'act'),'place',text);
    assert.equal(read(request,'predicate'),predicate,text);
    assert.equal(read(reference,'words'),object,text);
    assert.equal(read(reference,'from'),undefined,text);
    assert.equal(owns(reference,request),true,text);
    assert.equal(read(intent,'value'),destination,text);
    assert.equal(owns(intent,request),true,text);
    assert.equal(wires.some(wire=>wire.type==='w.request.target'),false,text);
    assert.deepEqual(reading.catalog.issues,[],text);
    assert.deepEqual(reading.evidence.missing,[],text);
    assert.equal(reading.evidence.counts.uncovered ?? 0,0,text);
  }
  for (const text of ['Move that box under the bridge.', 'Move it from the dock.', 'Move it under the bridge from the dock.',
    'Set it to blue.', 'Move it under the bridge?', 'Do not move it under the bridge.', 'Move it if it fits under the bridge.',
    'Move it to Monday.', 'Put it in presentation mode.', 'Put it on the same row so the group reads as one band.']) {
    const {candidates}=await reader.propose(text);
    assert.ok(candidates.every(candidate=>candidate.source!=='relative-placement'),text);
  }
});

test('a written placement source and destination stay separate in either order',async t=>{
  const reader=createReader();
  t.after(()=>reader.close());
  for (const [text,source,destination] of [
    ['Move it from the dock to the bridge.','from the dock','to the bridge'],
    ['Move it under the bridge from the tree.','from the tree','under the bridge'],
    ['Move it from the tree to the right.','from the tree','to the right'],
    ['Move it to the right from the tree.','from the tree','to the right'],
    ['Move them from Red Dock to Blue Bridge.','from Red Dock','to Blue Bridge'],
  ]) {
    const {candidates}=await reader.propose(text,{evidence:true});
    const reading=candidates.find(candidate=>candidate.source==='placement-with-source');
    assert.ok(reading,text);
    assert.equal(reading.status,'partial',text);
    const wires=parse(reading.sop);
    const request=wires.find(wire=>wire.type==='w.request.request');
    const origin=wires.find(wire=>wire.type==='w.request.unread');
    const reference=wires.find(wire=>wire.type==='w.request.lookup');
    const [intent]=intents(wires);
    assert.equal(read(request,'act'),'place',text);
    assert.equal(read(reference,'words'),text.split(' ')[1],text);
    assert.equal(read(reference,'from'),undefined,text);
    assert.equal(read(origin,'text'),source,text);
    assert.equal(read(origin,'note'),'placement source',text);
    assert.equal(read(intent,'value'),destination,text);
    assert.ok([reference,origin,intent].every(wire=>owns(wire,request)),text);
    assert.deepEqual(reading.catalog.issues,[],text);
    assert.deepEqual(reading.evidence.missing,[],text);
  }
  for (const text of ['Move it from the dock.', 'Move it from the tree to Monday.',
    'Move it from the tree to the bridge from the boat.', 'Put it next to the third figure from the left.']) {
    const {candidates}=await reader.propose(text);
    assert.ok(candidates.every(candidate=>candidate.source!=='placement-with-source'),text);
  }
});

test('a verb-specific replacement marker keeps the operand out of purpose', async t => {
  const reader=createReader();
  t.after(()=>reader.close());
  const cases=[
    ['Substitute a crown for the hat.','for the hat'],
    ['Swap the box for the circle.','for the circle'],
    ['Exchange the chart for the table.','for the table'],
    ['Move the circle, then swap the box for the chart.','for the chart'],
    ['Swap the box in red for the circle, then move it.','for the circle'],
  ];
  for (const [text,words] of cases) {
    const {candidates}=await reader.propose(text);
    assert.ok(candidates.length,text);
    assert.ok(candidates.every(candidate=>intents(parse(candidate.sop)).every(intent=>
      read(intent,'role')!=='purpose' || read(intent,'words')!==words)),text);
  }
  for (const [text,value] of [
    ['Draw a box for the workshop.','the workshop'],
    ['Replace the title with "Welcome" for the workshop.','the workshop'],
  ]) {
    const {candidates}=await reader.propose(text);
    assert.ok(candidates.some(candidate=>intents(parse(candidate.sop)).some(intent=>
      read(intent,'role')==='purpose' && read(intent,'value')===value)),text);
  }
});

test('attaches a later purpose when the same request already proves a property state',async t=>{
  const reader=createReader();
  t.after(()=>reader.close());
  for (const [text,purpose] of [
    ['Switch the grid off for the workshop.','the workshop'],
    ['Switch off the grid for the board.','the board'],
    ['Switch the grid off to improve readability.','improve readability'],
  ]) {
    const {candidates}=await reader.propose(text,{evidence:true});
    assert.ok(candidates.some(candidate=>{
      const wires=parse(candidate.sop);
      const request=wires.find(wire=>wire.type==='w.request.request');
      return request && wires.some(wire=>wire.type==='w.request.constraint' && owns(wire,request) &&
        read(wire,'attribute')==='chart.grid' && read(wire,'value')==='hide') &&
        intents(wires).some(wire=>owns(wire,request) && read(wire,'role')==='purpose' && read(wire,'value')===purpose) &&
        !wires.some(wire=>wire.type==='w.request.unread') && !candidate.evidence.counts.uncovered;
    }),text);
  }
  for (const text of ['Switch the grid for the workshop.', 'Switch the chart for the table.', 'Set the grid to improve readability.']) {
    const {candidates}=await reader.propose(text);
    assert.ok(candidates.every(candidate=>intents(parse(candidate.sop)).every(wire=>read(wire,'role')!=='purpose')),text);
  }
});

test('delivers purpose and destination on the independent analytical request', async t => {
  const reader = createReader();
  t.after(() => reader.close());
  const text = 'Create a sales chart, then calculate total revenue to explain the change to the board and put that answer on the summary slide';
  const { candidates } = await reader.propose(text, { evidence: true });
  const expected = [
    ['purpose', 'explain the change to the board', 'to explain the change to the board', 'yes'],
    ['destination', 'the summary slide', 'and put that answer on the summary slide', 'yes'],
  ];
  const candidate = candidates.find(candidate => {
    const wires = parse(candidate.sop);
    const requests = wires.filter(wire => wire.type === 'w.request.request');
    const chart = requests.find(wire => read(wire, 'predicate')?.toLowerCase() === 'create');
    const analysis = requests.find(wire => read(wire, 'predicate')?.toLowerCase() === 'calculate');
    if (requests.length !== 2 || !chart || !analysis || read(analysis, 'question') !== 'total' ||
        read(analysis, 'asked_words') !== 'total revenue') return false;
    if (!wires.some(wire => wire.type === 'w.request.target' &&
      owns(wire, chart) && read(wire, 'family') === 'chart')) return false;
    const relations = intents(wires);
    return relations.length === expected.length && relations.every(wire => owns(wire, analysis)) &&
      expected.every(fields => relations.some(wire =>
        intentFields(wire).every((field, index) => field === fields[index])));
  });
  assert.ok(candidate, text);
  assert.deepEqual(candidate.catalog.issues, []);
  assert.deepEqual(candidate.evidence.missing, []);
});

for (const {text, destination, expectedIntents} of [
  {
    text: 'Calculate total revenue for the board appendix, to go on the summary slide of the deck.',
    destination: 'to go on the summary slide of the deck',
    expectedIntents: [['purpose', 'the board appendix', 'for the board appendix', 'yes']],
  },
  {
    text: 'Calculate total revenue to go on the summary slide.',
    destination: 'to go on the summary slide',
    expectedIntents: [],
  },
]) {
  test(`keeps the result destination unread in "${text}"`, async t => {
    const reader = createReader();
    t.after(() => reader.close());
    const { candidates } = await reader.propose(text, { evidence: true });
    const readings = candidates.map(candidate => ({candidate, wires: parse(candidate.sop)}));
    const swallowed = readings.flatMap(({wires}) => intents(wires))
      .filter(wire => read(wire, 'value')?.includes(destination));
    assert.deepEqual(swallowed, []);
    const reading = readings.find(({wires}) => {
      const request = wires.find(wire => wire.type === 'w.request.request' &&
        read(wire, 'act') === 'ask' && read(wire, 'predicate') === 'Calculate' &&
        read(wire, 'question') === 'total' && read(wire, 'asked_words') === 'total revenue');
      if (!request) return false;
      const unread = wires.filter(wire => wire.type === 'w.request.unread' && owns(wire, request));
      const relations = intents(wires);
      return unread.length === 1 && read(unread[0], 'text') === destination &&
        relations.length === expectedIntents.length && relations.every((wire, index) =>
          owns(wire, request) && intentFields(wire).every((field, slot) => field === expectedIntents[index][slot]));
    });
    assert.ok(reading, text);
    assert.equal(reading.candidate.status, 'partial');
    assert.deepEqual(reading.candidate.catalog.issues, []);
    assert.deepEqual(reading.candidate.evidence.missing, []);
  });
}

test('keeps independent owners and excludes quantification from purpose', async t => {
  const reader = createReader();
  t.after(() => reader.close());
  const text = 'Create a chart for the board, then compute total refunds to compare the regions.';
  const { candidates } = await reader.propose(text, { evidence: true });
  assert.ok(candidates.some(candidate => {
    const wires = parse(candidate.sop);
    const chart = wires.find(wire => read(wire, 'predicate') === 'Create');
    const result = wires.find(wire => read(wire, 'predicate') === 'compute');
    return chart && result && intents(wires).some(wire => owns(wire, chart) && read(wire, 'value') === 'the board') &&
      intents(wires).some(wire => owns(wire, result) && read(wire, 'value') === 'compare the regions') &&
      !candidate.evidence.counts.unread && !candidate.evidence.counts.uncovered;
  }));
  const quantified = await reader.propose('Create a chart for each district.');
  assert.ok(quantified.candidates.every(candidate => !intents(parse(candidate.sop)).length));
});

test('keeps a counted noun phrase as purpose and a standalone quantity unread', async t => {
  const reader = createReader();
  t.after(() => reader.close());
  for (const value of ['the client briefing', 'two client briefings', '24 project reviews']) {
    const { candidates } = await reader.propose(`Calculate total revenue for ${value}.`, { evidence: true });
    const candidate = candidates.find(candidate => {
      const wires = parse(candidate.sop);
      const request = wires.find(wire => read(wire, 'asked_words') === 'total revenue');
      return request && intents(wires).some(wire => owns(wire, request) &&
        read(wire, 'value') === value && read(wire, 'words') === `for ${value}`);
    });
    assert.ok(candidate, value);
    assert.equal(candidate.status, 'matched');
    assert.deepEqual(candidate.catalog.issues, []);
    assert.deepEqual(candidate.evidence.missing, []);
  }
  for (const [text, adjunct] of [
    ['Create a meeting for 1.', 'for 1'],
    ['Add a meeting for two hours.', 'for two hours'],
    ['Calculate total revenue for 2.5.', 'for 2.5'],
  ]) {
    const { candidates } = await reader.propose(text, { evidence: true });
    const candidate = candidates.find(candidate => {
      const wires = parse(candidate.sop);
      const request = wires.find(wire => wire.type === 'w.request.request');
      return request && wires.some(wire => wire.type === 'w.request.unread' && owns(wire, request) &&
        read(wire, 'text') === adjunct && read(wire, 'note') === 'unresolved quantity');
    });
    assert.ok(candidate, text);
    assert.equal(candidate.status, 'partial');
    assert.deepEqual(candidate.evidence.missing, []);
    assert.ok(candidates.every(candidate => !intents(parse(candidate.sop)).some(wire =>
      read(wire, 'words') === adjunct)), text);
  }
});

test('distinguishes declared coordinate assignments from a purpose clause', async t => {
  const reader = createReader();
  t.after(() => reader.close());
  const placement = 'uh push the node named Valid? to position x=340, y=110';
  const { candidates } = await reader.propose(placement);
  assert.ok(candidates.some(candidate => parse(candidate.sop).some(wire =>
    wire.type === 'w.request.target' && read(wire, 'family') === 'node')));
  assert.ok(candidates.every(candidate => !intents(parse(candidate.sop)).length));

  const purpose = await reader.propose('Move the node to position the chart on the page.');
  assert.ok(purpose.candidates.some(candidate => intents(parse(candidate.sop)).some(wire =>
    read(wire, 'value') === 'position the chart on the page')));

  const both = await reader.propose('Move the node to position x=-340, y=+110 for the talk.');
  const values = both.candidates.flatMap(candidate => intents(parse(candidate.sop)))
    .map(wire => read(wire, 'value'));
  assert.deepEqual(new Set(values), new Set(['the talk']));
});

test('uses an installed role frame and preserves negative delivery with written evidence', async t => {
  const overlay = await mkdtemp(join(tmpdir(), 'request-intents-'));
  await writeFile(join(overlay, 'intents.sop'),
    '@intent.test pro.reader.request_intent_frame text="with the aim to" role=purpose form=verbal owner=request want=yes\n');
  const reader = createReader(undefined, loadWorlds({ paths: [overlay] }));
  t.after(async () => { await reader.close(); await rm(overlay, {recursive: true}); });
  const text = 'Compute total refunds with the aim to compare the regions and do not put the result in the appendix.';
  const { candidates } = await reader.propose(text, { evidence: true });
  assert.ok(candidates.some(candidate => {
    const wires = parse(candidate.sop);
    const owner = wires.find(wire => read(wire, 'predicate') === 'Compute');
    const relations = intents(wires);
    return owner && relations.length === 2 && relations.every(wire => owns(wire, owner)) &&
      relations.some(wire => read(wire, 'words') === 'with the aim to compare the regions') &&
      relations.some(wire => read(wire, 'value') === 'the appendix' && read(wire, 'want') === 'no') &&
      !candidate.evidence.counts.unread && !candidate.evidence.counts.uncovered;
  }), text);
});

test('uses an installed result-destination boundary without a comma', async t => {
  const overlay = await mkdtemp(join(tmpdir(), 'request-intents-'));
  await writeFile(join(overlay, 'intents.sop'),
    '@intent.test pro.reader.request_intent_frame text="slated for" role=destination form=nominal owner=answer want=yes resolution=unresolved\n');
  const reader = createReader(undefined, loadWorlds({ paths: [overlay] }));
  t.after(async () => { await reader.close(); await rm(overlay, {recursive: true}); });
  const text = 'Compute total refunds for the audit slated for the front page.';
  const { candidates } = await reader.propose(text, { evidence: true });
  assert.ok(candidates.some(candidate => {
    const wires = parse(candidate.sop);
    const request = wires.find(wire => wire.type === 'w.request.request' &&
      read(wire, 'predicate') === 'Compute' && read(wire, 'asked_words') === 'total refunds');
    return candidate.status === 'partial' && request &&
      intents(wires).some(wire => owns(wire, request) && read(wire, 'value') === 'the audit') &&
      wires.some(wire => wire.type === 'w.request.unread' && owns(wire, request) &&
        read(wire, 'text') === 'slated for the front page') &&
      !candidate.evidence.missing.length;
  }), text);
});

test('grounds a negated purpose on an affirmative creation request', async t => {
  const reader = createReader();
  t.after(() => reader.close());
  const text = 'Make a bar chart of revenue by region, not for social media.';
  const { candidates } = await reader.propose(text, { evidence: true });
  const candidate = candidates.find(candidate => {
    const wires = parse(candidate.sop);
    const request = wires.find(wire => wire.type === 'w.request.request' && read(wire, 'act') === 'make');
    if (!request || !wires.some(wire => wire.type === 'w.request.target' &&
      owns(wire, request) && read(wire, 'family') === 'chart')) return false;
    const relations = intents(wires);
    return relations.length === 1 && owns(relations[0], request) &&
      read(relations[0], 'role') === 'purpose' &&
      read(relations[0], 'value') === 'social media' &&
      read(relations[0], 'words') === 'not for social media' &&
      read(relations[0], 'want') === 'no';
  });
  assert.ok(candidate, text);
  assert.deepEqual(candidate.catalog.issues, []);
  assert.deepEqual(candidate.evidence.missing, []);
});
