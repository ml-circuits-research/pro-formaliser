import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createFormaliser } from '../src/formaliser.mjs';
import { evidenceInText } from '../src/grounding.mjs';
import { tokens } from '../src/lexicon.mjs';
import { quotedSpans } from '../src/literal-roles.mjs';
import { namedArgumentCandidates } from '../src/named-arguments.mjs';
import { parse, validate } from '../src/schema.mjs';
import { loadWorlds } from '../src/worlds.mjs';

const decode = value => value.startsWith('"') ? JSON.parse(value) : value;
const constraints = sop => parse(sop).filter(wire => wire.type === 'w.request.constraint')
  .map(({attrs}) => ['attribute','value','phase'].map(key => decode(attrs[key][0])));
const target = sop => parse(sop).find(wire => wire.type === 'w.request.target').attrs;

test('binds both whole endpoint names and retains lexical alternatives', async t => {
  const reader = createFormaliser();
  t.after(() => reader.close());
  for (const [input, left, right] of [
    ['Connect Upper Harbor to Inland Pier. Thanks!', 'Upper Harbor', 'Inland Pier'],
    ['Connect Research and Development to North Pier', 'Research and Development', 'North Pier'],
    ['Please connect from "Pier to Water" to “Sky; and Stars”.', 'Pier to Water', 'Sky; and Stars'],
  ]) {
    const {candidates} = await reader.formalise(input);
    const candidate = candidates.find(candidate => candidate.source === 'named-arguments');
    assert.deepEqual(constraints(candidate.sop), [
      ['link.from',left,'result'], ['link.to',right,'result'],
    ]);
    assert.ok(candidates.some(candidate => candidate.source === 'lexicon'));
  }
});

test('retains multiple name boundaries and keeps separate clauses separate', async t => {
  const reader = createFormaliser();
  t.after(() => reader.close());
  const ambiguous = await reader.formalise('Connect Passage to Water to Harbor');
  assert.deepEqual(ambiguous.candidates.filter(c => c.source === 'named-arguments')
    .map(c => constraints(c.sop).map(([,value]) => value)), [
    ['Passage','Water to Harbor'], ['Passage to Water','Harbor'],
  ]);
  const composite = await reader.formalise('Connect Amber Hall to North Pier; then add a box');
  const boundClause = composite.candidates.find(c => c.source === 'sequence' && c.sop.includes('link.from'));
  assert.deepEqual(constraints(boundClause.sop).slice(0,2), [
    ['link.from','Amber Hall','result'], ['link.to','North Pier','result'],
  ]);
  assert.ok(!composite.candidates.some(c => c.source === 'named-arguments'));
  const negative = await reader.formalise('Do not connect Amber Hall to North Pier');
  assert.ok(!negative.candidates.some(c => c.source === 'named-arguments'));
});

test('loads custom acts, argument keys, argument phases, and markers', async t => {
  const dir = mkdtempSync(join(tmpdir(),'sop-named-arguments-'));
  t.after(() => rmSync(dir,{recursive:true,force:true}));
  const overlay = join(dir,'overlay.sop');
  writeFileSync(overlay,`
@workbench std.schema.world name=w.workbench
@shuttle std.schema.kind of=w.workbench.shuttle world=w.workbench acts=route acts=place
@route k.actions.act name=route
@reroute k.actions.verb act=route text=reroute
@origin w.request.key family=shuttle name=shuttle.origin head=span
@terminus w.request.key family=shuttle name=shuttle.terminus head=span
@routing pro.reader.arguments family=shuttle act=route mode=existing first_key=shuttle.origin first_phase=selector second_key=shuttle.terminus separator="in favor of" prefix=from
@bearing w.request.key family=shuttle name=shuttle.bearing head=class value=left_of
@landmark w.request.key family=shuttle name=shuttle.landmark head="fill+span"
@spatial pro.reader.spatial family=shuttle relation_key=shuttle.bearing anchor_key=shuttle.landmark named_act=place
@prep w.lang.en.prep text="sunward of" rel=left_of space=horizontal arity=1
@place-markers k.actions.role act=place name=place holds=place marker="sunward of"
`);
  const reader = createFormaliser(undefined,loadWorlds({paths:[overlay]}));
  t.after(() => reader.close());
  const {candidates} = await reader.formalise('Reroute from West Annex in favor of Upper Terminal');
  const candidate = candidates.find(c => c.source === 'named-arguments');
  assert.deepEqual(constraints(candidate.sop), [
    ['shuttle.origin','West Annex','selector'], ['shuttle.terminus','Upper Terminal','result'],
  ]);
  const placement = await reader.formalise('Move West Annex to the left of "Upper Terminal"');
  const shuttle = placement.candidates.find(c =>
    c.source === 'named-arguments' && decode(target(c.sop).family[0]) === 'shuttle');
  assert.equal(decode(target(shuttle.sop).name[0]),'West Annex');
  assert.deepEqual(constraints(shuttle.sop), [
    ['shuttle.bearing','left_of','result'], ['shuttle.landmark','Upper Terminal','selector'],
  ]);
  const bare = await reader.formalise('Move aurora sunward of solstice');
  const custom = bare.candidates.find(c =>
    c.source === 'named-arguments' && decode(target(c.sop).family[0]) === 'shuttle');
  assert.equal(decode(target(custom.sop).name[0]),'aurora');
  assert.deepEqual(constraints(custom.sop), [
    ['shuttle.bearing','left_of','result'], ['shuttle.landmark','solstice','selector'],
  ]);
});

test('keeps a named target and anchor in each spatial family and respects request scope', async t => {
  const reader = createFormaliser();
  t.after(() => reader.close());
  const {candidates} = await reader.formalise('Move "West to East Annex" to the left of Upper Terminal');
  const spatial = candidates.filter(c => c.source === 'named-arguments');
  assert.deepEqual(new Set(spatial.map(c => decode(target(c.sop).family[0]))), new Set(['node','drawn']));
  for (const {sop} of spatial) {
    assert.equal(decode(target(sop).name[0]),'West to East Annex');
    assert.deepEqual(constraints(sop).map(([,value,phase])=>[value,phase]), [
      ['left_of','result'], ['Upper Terminal','selector'],
    ]);
    const lookup = parse(sop).find(wire => wire.type === 'w.request.lookup');
    assert.equal(lookup.attrs.constraint[0], '$r1.c2');
    assert.equal(lookup.attrs.key[0], 'thing');
  }
  for (const input of [
    'Did we move West Annex to the left of Upper Terminal?',
    'Move West Annex to the left of Upper Terminal?',
    'Do not move West Annex to the left of Upper Terminal',
    'Move the orange token to the left of Upper Terminal',
    'Move this red token to the left of Upper Terminal',
  ]) {
    const {candidates} = await reader.formalise(input);
    assert.ok(!candidates.some(c => c.source === 'named-arguments'),input);
  }
  const coded = await reader.formalise('Move n17 to the left of Upper Terminal');
  assert.ok(coded.candidates.some(c => c.source === 'named-arguments' &&
    decode(target(c.sop).name[0]) === 'n17'));
});

test('binds two bare written names without an instance inventory', async t => {
  const reader = createFormaliser();
  t.after(() => reader.close());
  const input = 'I need you to move mango to the left of pear. I appreciate it.';
  const {candidates} = await reader.formalise(input);
  const spatial = candidates.filter(c => c.source === 'named-arguments');
  assert.deepEqual(new Set(spatial.map(c=>target(c.sop).family[0])),new Set(['drawn','node']));
  for (const {sop} of spatial) {
    assert.equal(target(sop).name[0],'mango');
    assert.equal(constraints(sop)[1][1],'pear');
  }
  for (const bounded of [
    'Move mango to the left of her',
    'Move mango to the left of the pear',
    'Move mango to the left of Pear with apples',
    'Move mango to the left of pear to the left of Peach',
    'Move ripe mango to the left of pear',
    'Move 17 to the left of pear',
  ]) {
    const result = await reader.formalise(bounded);
    assert.ok(!result.candidates.some(c=>c.source==='named-arguments'),bounded);
  }
});

test('uses a contextual lower-case name only in its spatial family', () => {
  const worlds = loadWorlds();
  for (const [input, name, anchor] of [
    ['put dog below bench','dog','bench'],
    ['put lamp 2 below street','lamp 2','street'],
  ]) {
    const read = names => namedArgumentCandidates(input,tokens(input),quotedSpans(input),worlds,undefined,names);
    assert.deepEqual(read(new Map()),[]);
    assert.deepEqual(read(new Map([['drawn',new Set([name.toUpperCase()])]])),[]);
    const candidates = read(new Map([['drawn',new Set([name])]]));
    assert.ok(candidates.length,input);
    for (const {sop} of candidates) {
      const attrs = target(sop);
      assert.equal(attrs.family[0],'drawn');
      assert.equal(attrs.mode[0],'existing');
      assert.equal(attrs.fill[0],'written');
      assert.equal(decode(attrs.name[0]),name);
      assert.deepEqual(constraints(sop),[
        ['drawn.relation','below','result'],['drawn.anchor',anchor,'selector'],
      ]);
      assert.ok(validate(sop,worlds));
      assert.ok(evidenceInText(input,sop,worlds));
    }
  }
});

test('keeps a proper name with a final number and emits only distinct relation wording', async t => {
  const reader = createFormaliser();
  t.after(() => reader.close());
  for (const [marker,words] of [['below',undefined],['to the left of','to the left of']]) {
    const {candidates} = await reader.formalise('Move Amber Hall 4 '+marker+' North Pier 12. Thanks!');
    const reading=candidates.find(c=>c.source==='named-arguments' && target(c.sop).family[0]==='drawn');
    assert.ok(reading,marker);
    assert.equal(decode(target(reading.sop).name[0]),'Amber Hall 4');
    assert.equal(constraints(reading.sop)[1][1],'North Pier 12');
    const relation=parse(reading.sop).find(wire=>wire.attrs.attribute?.[0]==='drawn.relation');
    assert.equal(relation.attrs.words?.[0] && decode(relation.attrs.words[0]),words);
  }
  for (const input of ['Move Amber Hall below pier 12','Move Amber Hall below 12','Move Amber Hall below North 12 Pier']) {
    const {candidates}=await reader.formalise(input);
    assert.ok(!candidates.some(c=>c.source==='named-arguments'),input);
  }
});
