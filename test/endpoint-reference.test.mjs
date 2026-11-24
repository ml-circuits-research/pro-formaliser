import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { catalogIssues } from '../src/catalog.mjs';
import { evidenceInText } from '../src/grounding.mjs';
import { createReader } from '../src/runtime.mjs';
import { parse, validate } from '../src/schema.mjs';
import { loadWorlds } from '../src/worlds.mjs';

const local=fileURLToPath(new URL('../sop-worlds/',import.meta.url));
const field=(wire,key)=>{
  const value=wire?.attrs[key]?.[0];
  return value?.startsWith('"') ? JSON.parse(value) : value;
};

async function find(reader,text,worlds,tab) {
  const {candidates}=await reader.propose(text);
  const reading=candidates.find(item=>item.source==='endpoint-reference');
  assert.ok(reading,text);
  assert.ok(validate(reading.sop,worlds),reading.sop);
  assert.ok(evidenceInText(text,reading.sop,worlds),reading.sop);
  const wires=parse(reading.sop);
  assert.deepEqual(catalogIssues(wires,worlds,tab),[]);
  return {reading,wires};
}

function check(wires,act,family,effects) {
  const [request]=wires.filter(w=>w.type==='w.request.request');
  const targets=wires.filter(w=>w.type==='w.request.target');
  assert.equal(field(request,'act'),act);
  assert.equal(targets.length,1);
  assert.equal(field(targets[0],'family'),family);
  assert.equal(field(targets[0],'mode'),'existing');
  const constraints=wires.filter(w=>w.type==='w.request.constraint');
  assert.equal(constraints.length,effects.length);
  assert.equal(new Set(constraints.map(w=>field(w,'request'))).size,1);
  assert.deepEqual(constraints.map(w=>['phase','attribute','value'].map(key=>field(w,key))),effects);
}

test('binds exact written ordered endpoints and a separate result via the public reader',async ()=>{
  const worlds=loadWorlds({paths:[local]});
  const reader=createReader(undefined,worlds);
  try {
    const text='it overlaps a box, make the Auth to n4 line right-angled';
    const {reading,wires}=await find(reader,text,worlds,'diagram');
    check(wires,'change','link',[
      ['selector','link.from','Auth'],['selector','link.to','n4'],['result','link.route','orthogonal']
    ]);
    assert.equal(reading.status,'partial');
    assert.equal(field(wires.find(w=>w.type==='w.request.unread'),'text'),'it overlaps a box');
    assert.equal(field(wires.find(w=>w.type==='w.request.request'),'words'),'make the Auth to n4 line right-angled');
    const {wires:counter}=await find(reader,'make the Intake to n42 arrow dotted',worlds,'diagram');
    check(counter,'change','link',[
      ['selector','link.from','Intake'],['selector','link.to','n42'],['result','link.style','dotted']
    ]);
    const {wires:quoted}=await find(reader,'pick the "Ring to Gate" to n4 line',worlds,'diagram');
    check(quoted,'pick','link',[
      ['selector','link.from','Ring to Gate'],['selector','link.to','n4']
    ]);
    for (const text of [
      'make the Intake above n42 arrow dotted',
      'make the Intake to n42 box dotted',
      'make the Intake to n42 arrow dotted if clear',
      'make the Intake to n42 arrow dotted and delete it',
      'do not make the Intake to n42 arrow dotted',
      'make the Intake to n42 arrow unlicensed',
      'make the Intake to xyz42 arrow dotted',
      'delete it, make the Intake to n42 arrow dotted'
    ]) {
      const {candidates}=await reader.propose(text);
      assert.ok(!candidates.some(item=>item.source==='endpoint-reference'),text);
    }
  } finally { await reader.close(); }
});

test('uses independently declared ordered keys and connector in an unrelated world',async t=>{
  const path=mkdtempSync(join(tmpdir(),'pro-reader-endpoints-'));
  t.after(()=>rmSync(path,{recursive:true,force:true}));
  writeFileSync(join(path,'shipyard.sop'),[
    '@yard std.schema.world name=w.shipyard',
    '@conduit std.schema.kind of=w.shipyard.conduit world=w.shipyard acts=change',
    '@noun core.word text="cargo conduit" means=w.shipyard.conduit',
    '@first w.request.key tab=shipyard family=conduit name=conduit.origin head="fill+span"',
    '@second w.request.key tab=shipyard family=conduit name=conduit.destination head="fill+span"',
    '@grade w.request.key tab=shipyard family=conduit name=conduit.grade head=class value=taut',
    '@pair pro.reader.compound_reference family=conduit first_key=conduit.origin second_key=conduit.destination delimiter="|"',
    '@sequence pro.reader.arguments tab=shipyard family=conduit act=change mode=existing first_key=conduit.origin second_key=conduit.destination prefix=from separator=through'
  ].join('\n'));
  const worlds=loadWorlds({paths:[path]});
  const reader=createReader(undefined,worlds);
  try {
    const {wires}=await find(reader,'Make the Loading Gate through Delivery Hatch cargo conduit taut',worlds,'shipyard');
    check(wires,'change','conduit',[
      ['selector','conduit.origin','Loading Gate'],['selector','conduit.destination','Delivery Hatch'],
      ['result','conduit.grade','taut']
    ]);
  } finally { await reader.close(); }
});
