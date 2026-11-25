import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createReader } from '../src/runtime.mjs';
import { evidenceInText } from '../src/grounding.mjs';
import { parse } from '../src/schema.mjs';
import { loadWorlds } from '../src/worlds.mjs';

const decode = value => value?.startsWith('"') ? JSON.parse(value) : value;
const rows = (answer,kind) => parse(answer.sop).filter(wire => wire.type === 'w.request.' + kind)
  .map(wire => Object.fromEntries(Object.entries(wire.attrs).map(([key,[value]])=>[key,decode(value)])));

test('grounds a whole named replacement before preserving its exact quoted result', async t => {
  const reader = createReader();
  t.after(() => reader.close());
  const input = String.raw`Please swap Lantern with an Amber Shade for "Wait, then add \"copper\".  Do not trim."`;
  const answer = await reader.formalise(input, {tab:'document'});
  assert.equal(rows(answer,'request')[0].act,'change');
  assert.equal(rows(answer,'target')[0].mode,'existing');
  assert.equal(rows(answer,'target')[0].name,'Lantern with an Amber Shade');
  const [result] = rows(answer,'constraint');
  assert.equal(result.value,String.raw`Wait, then add \"copper\".  Do not trim.`);
  assert.equal(result.phase,'result');
  assert.ok(evidenceInText(input,answer.sop));
  assert.ok(new Set([answer,...answer.alternatives].flatMap(reading =>
    rows(reading,'target').filter(target => target.name === 'Lantern with an Amber Shade')
      .map(target=>target.family))).size > 1);
});

test('keeps a creation title separate from its literal content', async t => {
  const reader = createReader();
  t.after(() => reader.close());
  const input = 'Could you create a document titled Tide Almanac containing “Under the pier? At 04:30.”';
  const answer = await reader.formalise(input,{tab:'document'});
  assert.equal(rows(answer,'request')[0].act,'make');
  assert.equal(rows(answer,'target')[0].mode,'new');
  assert.deepEqual(rows(answer,'constraint').map(({attribute,value})=>[attribute,value]), [
    ['text.title','Tide Almanac'],['text.content','Under the pier? At 04:30.'],
  ]);
  assert.ok(evidenceInText(input,answer.sop));
});

test('reads a replacement-first verb with separate old and new quoted values', async t => {
  const reader = createReader();
  t.after(() => reader.close());
  const input = "substitute 'Current text.' for 'Draft text?'";
  const answer = await reader.formalise(input,{tab:'document'});
  assert.equal(rows(answer,'request')[0].words,undefined);
  assert.deepEqual(rows(answer,'constraint').map(({phase,value})=>[phase,value]), [
    ['selector','Draft text?'],['result','Current text.'],
  ]);
  assert.ok(evidenceInText(input,answer.sop));
});

test('retains a written title even when its opening is also a catalogue noun', async t => {
  const reader = createReader();
  t.after(() => reader.close());
  for (const [input,name,value,fillers] of [
    ['Let us replace Chapter summaries with "We will review the draft tomorrow.". That would help.',
      'Chapter summaries','We will review the draft tomorrow.',['Let us','That would help.']],
    ['Hey, replace Story with "Please confirm these updated details.".',
      'Story','Please confirm these updated details.',['Hey']],
  ]) {
    const {candidates} = await reader.propose(input,{evidence:true});
    const candidate = candidates.find(reading => reading.status==='matched' && rows(reading,'target').some(target =>
      target.family==='section' && target.mode==='existing' && target.fill==='written' && target.name===name) &&
      rows(reading,'constraint').some(result => result.attribute==='section.content' && result.value===value &&
        result.phase==='result'));
    assert.ok(candidate,input);
    assert.deepEqual(rows(candidate,'filler').map(row=>row.text),fillers);
    assert.deepEqual(candidate.evidence.missing,[]);
    assert.deepEqual(candidate.catalog.issues,[]);
    assert.ok(!candidate.evidence.counts.unread && !candidate.evidence.counts.uncovered);
    assert.ok(candidates.some(reading=>rows(reading,'target').some(target=>target.fill==='context')));
  }
  const negative = await reader.propose('Do not replace Chapter summaries with "New.".');
  assert.ok(negative.candidates.every(reading=>!rows(reading,'constraint').some(result=>result.value==='New.')));
});

test('uses an explicitly named span key from a novel schema family', async t => {
  const cache = fileURLToPath(new URL('../.cache/', import.meta.url));
  const dir = mkdtempSync(join(cache,'literal-roles-test-'));
  t.after(() => rmSync(dir,{recursive:true,force:true}));
  const file = join(dir,'overlay.sop');
  writeFileSync(file,`
@smithwork std.schema.world name=w.smithwork
@stamp std.schema.kind of=w.smithwork.stamp world=w.smithwork acts=change acts=make
@inscription w.request.key tab=diagram family=stamp name=stamp.inscription head=span
@impression w.request.key tab=diagram family=stamp name=stamp.impression head=span
@serial w.request.key tab=diagram family=stamp name=stamp.serial head=span
@impression.role pro.reader.literal family=stamp attribute=stamp.impression role=payload
@serial.role pro.reader.literal family=stamp attribute=stamp.serial role=name text=marked
`);
  const reader = createReader(undefined,loadWorlds({paths:[file]}));
  t.after(() => reader.close());
  const input = 'Replace the stamp inscription with ‘Copper; not brass.’';
  const answer = await reader.formalise(input);
  assert.equal(rows(answer,'target')[0].family,'stamp');
  assert.equal(rows(answer,'constraint')[0].attribute,'stamp.inscription');
  assert.equal(rows(answer,'constraint')[0].value,'Copper; not brass.');
  assert.ok(evidenceInText(input,answer.sop));

  const creation = 'Create a stamp marked Aurora containing “Copper; not brass.”';
  const created = await reader.formalise(creation);
  assert.equal(rows(created,'target')[0].family,'stamp');
  assert.deepEqual(rows(created,'constraint').map(({attribute,value})=>[attribute,value]), [
    ['stamp.serial','Aurora'],['stamp.impression','Copper; not brass.'],
  ]);
  assert.ok(evidenceInText(creation,created.sop));
  const replacement = 'Replace the stamp with “Tin.”';
  const replaced = await reader.formalise(replacement);
  assert.equal(rows(replaced,'constraint')[0].attribute,'stamp.impression');

  const named = await reader.propose('Replace Stamp archive with “Tin.”');
  assert.ok(named.candidates.some(reading=>rows(reading,'target').some(row=>
    row.family==='stamp' && row.name==='Stamp archive') && rows(reading,'constraint').some(row=>
    row.attribute==='stamp.impression' && row.value==='Tin.')));
  const property = await reader.propose('Replace Stamp inscription with “Tin.”');
  assert.ok(property.candidates.every(reading=>rows(reading,'target').every(row=>row.name!=='Stamp inscription')));
});
