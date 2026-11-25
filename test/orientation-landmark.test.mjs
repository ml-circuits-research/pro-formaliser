import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { catalogIssues } from '../src/catalog.mjs';
import { evidenceInText } from '../src/grounding.mjs';
import { orientationLandmarkReadings } from '../src/orientation-landmark.mjs';
import { createReader } from '../src/runtime.mjs';
import { parse, validate } from '../src/schema.mjs';
import { loadWorlds } from '../src/worlds.mjs';

const overlay=fileURLToPath(new URL('../sop-worlds/vocabulary/orientation.sop',import.meta.url));
const worlds=loadWorlds({paths:[overlay]});
const keep='keeping everything else where it is';
const clause='make the car on the path face the house';
const text=clause+', '+keep;
const base=[
  '@r w.request.request act=change mood=do predicate=make words='+JSON.stringify(clause),
  '@t w.request.target request=$r family=drawn mode=existing determiner=definite sort=car description="the car on the path"',
  '@p w.request.constraint request=$r on=place attribute=drawn.relation value=on words="on the path" operator=relation phase=selector',
  '@a w.request.constraint request=$r on=place attribute=drawn.anchor value="the path" operator=relation phase=selector',
  '@f w.request.constraint request=$r on=attribute attribute=drawn.facing value=house words="the house" key_words=face open_value=true operator=eq phase=result',
].join('\n');

test('grounds the orientation operand separately from subject placement and preservation through the public reader',async t=>{
  assert.ok(!loadWorlds({paths:[]}).orientationLandmarks.bindings.length);
  const reader=createReader({version:1,examples:[{text:clause,sop:base,count:1}],templates:[]},worlds);
  t.after(()=>reader.close());
  const {candidates}=await reader.propose(text);
  const alternative=candidates.find(candidate=>candidate.source==='orientation-landmark' &&
    candidate.sop.includes('drawn.keep'));
  assert.ok(alternative);
  assert.ok(validate(alternative.sop,worlds));
  assert.ok(evidenceInText(text,alternative.sop,worlds));
  const wires=parse(alternative.sop);
  assert.deepEqual(catalogIssues(wires,worlds),[]);
  const orientation=wires.find(wire=>wire.attrs.attribute?.[0]==='drawn.facingTarget');
  assert.deepEqual(orientation.attrs.value,['"the house"']);
  assert.deepEqual(orientation.attrs.phase,['result']);
  assert.ok(wires.some(wire=>wire.type==='w.request.lookup' && wire.attrs.constraint?.[0]==='$'+orientation.id &&
    wire.attrs.key?.[0]==='thing'));
  assert.ok(wires.some(wire=>wire.attrs.attribute?.[0]==='drawn.anchor' && wire.attrs.value?.[0]==='"the path"' &&
    wire.attrs.phase?.[0]==='selector'));
  assert.ok(!wires.some(wire=>wire.attrs.attribute?.[0]==='drawn.facing'));
});

test('requires a local correction or action, complete landmark, and compatible donor evidence',()=>{
  const allow=()=>true;
  const correction='sorry, the cat by the bench faces the house';
  const donor=[
    '@r w.request.request act=pick mood=do predicate=sorry words='+JSON.stringify(correction),
    '@t w.request.target request=$r family=drawn mode=existing determiner=definite sort=cat',
    '@p w.request.constraint request=$r on=place attribute=drawn.relation value=near words=by operator=relation phase=selector',
    '@a w.request.constraint request=$r on=place attribute=drawn.anchor value="the bench" operator=relation phase=selector',
    '@u w.request.unread request=$r text="faces the house"',
  ].join('\n');
  const [bound]=orientationLandmarkReadings(correction,{sop:donor},worlds,allow);
  assert.match(bound.sop,/act=change mood=do predicate="faces"/);
  assert.match(bound.sop,/text="sorry"/);
  assert.match(bound.sop,/attribute=drawn.facingTarget value="the house"/);
  for (const query of [
    'the cat by the bench faces the house',
    'maybe, the cat by the bench faces the house',
    'sorry, the cat by the bench faces right',
    'sorry, the cat by the bench faces one another',
    'sorry, the cat by the bench faces "the house"',
    'sorry, the cat by the bench faces the house and the barn',
  ]) {
    const probe=donor.replace(JSON.stringify(correction),JSON.stringify(query))
      .replace(JSON.stringify('faces the house'),JSON.stringify(query.slice(query.indexOf('faces'))));
    assert.deepEqual(orientationLandmarkReadings(query,{sop:probe},worlds,allow),[],query);
  }
  assert.deepEqual(orientationLandmarkReadings(text,{sop:base},worlds,()=>false),[]);
  assert.deepEqual(orientationLandmarkReadings(text,{sop:base.replace('value=house','value=right')},worlds,allow),[]);
});

test('uses another world’s declared direction key, operand, marker and landmark inventory',async t=>{
  const path=mkdtempSync(join(tmpdir(),'orientation-landmark-'));
  t.after(()=>rmSync(path,{recursive:true,force:true}));
  writeFileSync(join(path,'fleet.sop'),[
    '@fleet std.schema.world name=w.fleet',
    '@turret std.schema.kind of=w.fleet.turret world=w.fleet acts=change',
    '@dir w.request.key family=turret name=turret.direction head=class value=left value=right',
    '@ref w.request.key family=turret name=turret.sightline head="fill+span"',
    '@beacon w.fleet.marker name="wind marker"',
    '@aim pro.reader.orientation family=turret act=change attribute=turret.sightline source_attribute=turret.direction landmark_type=w.fleet.marker text="align towards"',
  ].join('\n'));
  const configured=loadWorlds({paths:[path]});
  const text='make the turret align towards the wind marker';
  const sop=[
    '@r w.request.request act=change mood=do predicate=make',
    '@t w.request.target request=$r family=turret mode=existing sort=turret',
    '@u w.request.unread request=$r text="align towards the wind marker"',
  ].join('\n');
  const reader=createReader({version:1,examples:[{text,sop,count:1}],templates:[]},configured);
  t.after(()=>reader.close());
  const {candidates}=await reader.propose(text);
  const found=candidates.find(c=>c.source==='orientation-landmark');
  assert.ok(found);
  assert.ok(validate(found.sop,configured));
  assert.deepEqual(catalogIssues(parse(found.sop),configured),[]);
  assert.match(found.sop,/attribute=turret.sightline value="the wind marker" key_words="align towards"/);
});
