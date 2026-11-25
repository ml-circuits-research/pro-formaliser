import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { compileFixedProperties, fixedPropertyReadings } from '../src/fixed-properties.mjs';
import { evidenceInText } from '../src/grounding.mjs';
import { tokens } from '../src/lexicon.mjs';
import { quotedSpans } from '../src/literal-roles.mjs';
import { createReader } from '../src/runtime.mjs';
import { parse, validate } from '../src/schema.mjs';
import { loadWorlds } from '../src/worlds.mjs';

const base = loadWorlds();
const native = ['frames-acts-data','closed-classes'].flatMap(shard=>parse(readFileSync(
  new URL('../.cache/knowledge/docs/worlds/w.lang.en/shards/'+shard+'.sop',import.meta.url),'utf8')));
const property = [
  '@signal core.slot of=w.lab.observer key=signal kind=boolean',
  '@display core.word text="pilot lamp" text="pilot lamps" means=signal',
  '@binding pro.reader.fixed_property family=observer attribute=observer.metadata slot=signal on_value=active off_value=idle',
].join('\n');
const key = {family:'observer',name:'observer.metadata',head:'class',values:['active','idle']};
function configured(fixture, keys) {
  const facts=[...native,...parse(fixture)];
  return {...base,fixedProperties:compileFixedProperties(type=>facts.filter(wire=>wire.type===type),keys)};
}
const worlds = configured(property,[key]);
const read = (text, candidate, active=worlds) => fixedPropertyReadings(text,tokens(text),quotedSpans(text),candidate,active);

test('compiles native fixed-value frames and binds a property through an unrelated declared overlay key', () => {
  const [on] = read('Switch on the Pilot Lamp again.');
  const [off] = read('Hide the pilot lamp');
  assert.match(on.sop,/act=change .*predicate="Switch on"/u);
  assert.match(on.sop,/family=observer mode=existing fill=context/u);
  assert.match(on.sop,/attribute=observer\.metadata value=active words="Switch on" key_words="Pilot Lamp"/u);
  assert.match(off.sop,/attribute=observer\.metadata value=idle/u);
  assert.ok(validate(on.sop,base));
  assert.ok(evidenceInText('Switch on the Pilot Lamp again.',on.sop,base));
});

test('uses an exact linked Boolean slot without mapping and refuses an unlicensed equivalent', () => {
  const noMap = property.split('\n').slice(0,2).join('\n');
  const direct = {...key,means:'w.lab.observer.signal',values:['on','off']};
  assert.match(read('Show the pilot lamp',undefined,configured(noMap,[direct]))[0].sop,/value=on/u);
  assert.deepEqual(read('Show the pilot lamp',undefined,configured(noMap,[key])),[]);
  assert.deepEqual(read('Show the pilot lamp',undefined,configured(noMap,[{...key,means:'signal'}])),[]);
  const incompatible = configured(property,[{...key,means:'w.lab.observer.unlinked'}]);
  assert.deepEqual(read('Show the pilot lamp',undefined,incompatible),[]);
});

test('enriches only a compatible result and preserves other evidence', () => {
  const text='Show the pilot lamp again at noon';
  const fixture=[
    '@r w.request.request act=change mood=do predicate=Show',
    '@t w.request.target request=$r family=observer mode=existing fill=context',
    '@p w.request.constraint request=$r on=attribute attribute=observer.schedule value=noon operator=eq phase=result',
    '@u w.request.unread request=$r text="the pilot lamp again"',
  ].join('\n');
  // A separate imperative is not consumed as a property continuation.
  assert.deepEqual(read('Show the pilot lamp; keep green unchanged',{sop:fixture}),[]);
  const [candidate] = read(text,{sop:fixture});
  assert.match(candidate.sop,/attribute=observer\.metadata value=active/u);
  assert.match(candidate.sop,/attribute=observer\.schedule value=noon/u);
  assert.doesNotMatch(candidate.sop,/text="the pilot lamp again"/u);
  assert.deepEqual(read(text,{sop:fixture.replace('family=observer','family=other')}),[]);
  assert.deepEqual(read('Do not show the pilot lamp'),[]);
  assert.deepEqual(read('Show the pilot lamp if ready'),[]);
  assert.deepEqual(read('Show "the pilot lamp"'),[]);
  assert.deepEqual(read('Show the pilot lamp style'),[]);
  assert.deepEqual(read('Hide the pilot lamp?'),[]);
});

test('keeps a declared determiner or trailing contextual reference as unread evidence', () => {
  const [candidate] = read('Show both pilot lamps on it.');
  assert.match(candidate.sop,/value=active .*key_words="pilot lamps"/u);
  assert.match(candidate.sop,/w\.request\.unread request=\$r1 text="both"/u);
  assert.match(candidate.sop,/w\.request\.unread request=\$r1 text="on it"/u);
  assert.equal(candidate.status,'partial');
});

test('loads a fixed-value property overlay through the normal reader without a model', async t => {
  const dir = mkdtempSync(fileURLToPath(new URL('../.cache/fixed-overlay-', import.meta.url)));
  t.after(() => rmSync(dir, {recursive:true,force:true}));
  writeFileSync(join(dir,'property.sop'), [
    '@lab std.schema.world name=w.lab',
    '@observer std.schema.kind of=w.lab.observer world=w.lab acts=change',
    '@metadata w.request.key family=observer name=observer.metadata head=class value=active value=idle',
    property,
  ].join('\n'));
  const reader = createReader(undefined,loadWorlds({paths:[dir]}));
  try {
    const {candidates} = await reader.propose('Switch on the Pilot Lamp again.');
    assert.ok(candidates.some(({sop,source})=>source==='fixed-property' &&
      sop.includes('value=active words="Switch on" key_words="Pilot Lamp"')));
    const negated = await reader.propose('Do not switch on the Pilot Lamp.');
    assert.ok(!negated.candidates.some(candidate=>candidate.source==='fixed-property'));
    for (const [text,value,particle] of [
      ['Switch the Pilot Lamp on.','active','on'],
      ['Take the Pilot Lamp away.','idle','away'],
    ]) {
      const result=await reader.propose(text,{evidence:true});
      const candidate=result.candidates.find(reading=>reading.source==='fixed-property' &&
        reading.sop.includes(`value=${value} words="${particle}" key_words="Pilot Lamp"`));
      assert.ok(candidate,text);
      assert.deepEqual(candidate.catalog.issues,[],text);
      assert.deepEqual(candidate.evidence.missing,[],text);
      assert.equal(candidate.evidence.counts.uncovered ?? 0,0,text);
    }
  } finally {
    await reader.close();
  }
});

test('uses a declared terminal particle as exact state evidence without forcing an object interpretation', async t => {
  const reader=createReader();
  t.after(()=>reader.close());
  for (const [text,key,expected] of [
    ['Take the values away.','chart.show_values','hide'],
    ['Turn the grid lines off.','chart.grid','hide'],
    ['Bring the grid back.','chart.grid','show'],
  ]) {
    const {candidates}=await reader.propose(text,{evidence:true});
    const reading=candidates.find(candidate=>candidate.source==='fixed-property' &&
      candidate.sop.includes(`attribute=${key} value=${expected}`));
    assert.ok(reading,text);
    assert.equal(reading.evidence.tokens.at(-1).status,'grounded',text);
    assert.equal(reading.evidence.counts.uncovered ?? 0,0,text);
  }
  for (const text of ['Take the dogs out.', 'Take the values back.', 'Take the values away tomorrow.',
    'Take "the values" away.', 'Take the values away if needed.', 'Do not take the values away.',
    'Take the values away?', 'Take the markers away.']) {
    const {candidates}=await reader.propose(text);
    assert.ok(candidates.every(candidate=>candidate.source!=='fixed-property'),text);
  }
});
