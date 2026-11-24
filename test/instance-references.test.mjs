import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { createFormaliser } from '../src/formaliser.mjs';
import { evidenceInText } from '../src/grounding.mjs';
import { parse, validate } from '../src/schema.mjs';
import { loadWorlds } from '../src/worlds.mjs';

const decode = value => value.startsWith('"') ? JSON.parse(value) : value;
const rows = (sop, type) => parse(sop).filter(wire => wire.type === 'w.request.' + type)
  .map(({attrs}) => Object.fromEntries(Object.entries(attrs).map(([key,values]) =>
    [key,values.map(decode)])));

async function proposals(reader,text) {
  const {candidates} = await reader.formalise(text);
  return candidates.filter(candidate => candidate.source === 'instance-reference');
}

test('binds code-shaped IDs and complete coordinated lists without guessing one family', async t => {
  const worlds = loadWorlds();
  const reader = createFormaliser(undefined,worlds);
  t.after(() => reader.close());
  const changed = await proposals(reader,'Change n3 blue');
  assert.equal(changed.length,1);
  assert.deepEqual(rows(changed[0].sop,'target')[0].ids,['n3']);
  assert.deepEqual(rows(changed[0].sop,'constraint')[0].value,['blue']);

  const all = await proposals(reader,'Align A, B, and C');
  assert.ok(new Set(all.map(({sop}) => rows(sop,'target')[0].family[0])).size > 1);
  for (const {sop} of all) assert.deepEqual(rows(sop,'target')[0].ids,['A','B','C']);

  const input = 'Align Process, Done, and n4 centre';
  const [aligned] = await proposals(reader,input);
  assert.deepEqual(rows(aligned.sop,'target')[0].ids,['Process','Done','n4']);
  assert.deepEqual(rows(aligned.sop,'target')[0].family,['node']);
  assert.deepEqual(rows(aligned.sop,'constraint')[0].value,['centre']);
  assert.ok(validate(aligned.sop,worlds));
  assert.ok(evidenceInText(input,aligned.sop,worlds));

  for (const invalid of ['Change z3','Do not change n3','Align n4 and o3','Change "n3"','Move n3 if o4 exists']) {
    assert.deepEqual(await proposals(reader,invalid),[],invalid);
  }
});

test('retains both numbered nominals in a typed spatial placement', async t => {
  const worlds = loadWorlds();
  const reader = createFormaliser({version:1,examples:[],templates:[],lexicon:{
    block:[['target','place','drawn','existing','block',1]],
  }},worlds);
  t.after(() => reader.close());
  const input = 'Move block 12 right of block 10, level top and bottom';
  const grounded = (await proposals(reader,input)).find(({sop}) =>
    rows(sop,'target')[0].family[0] === 'drawn');
  assert.deepEqual(rows(grounded.sop,'target')[0].description,['block 12']);
  assert.equal(rows(grounded.sop,'target')[0].ids,undefined);
  assert.deepEqual(rows(grounded.sop,'constraint').map(({attribute,value,phase}) =>
    [attribute[0],value[0],phase[0]]),[
    ['drawn.relation','right_of','result'],['drawn.anchor','block 10','selector'],
  ]);
  assert.match(rows(grounded.sop,'unread')[0].text[0],/level top and bottom/);
  assert.ok(validate(grounded.sop,worlds));
  assert.ok(evidenceInText(input,grounded.sop,worlds));
});

test('projects a declared shared code prefix into both compatible families', async t => {
  const dir = mkdtempSync(fileURLToPath(new URL('../.cache/instance-reference-test-',import.meta.url)));
  t.after(() => rmSync(dir,{recursive:true,force:true}));
  const overlay = join(dir,'overlay.sop');
  writeFileSync(overlay,`
@workbench std.schema.world name=w.workbench
@panel std.schema.kind of=w.workbench.panel world=w.workbench acts=change
@screen std.schema.kind of=w.workbench.screen world=w.workbench acts=change
@panel.code pro.reader.instance_code family=panel prefix=q
@screen.code pro.reader.instance_code family=screen prefix=q
`);
  const reader = createFormaliser(undefined,loadWorlds({paths:[overlay]}));
  t.after(() => reader.close());
  const candidates = await proposals(reader,'Change q7');
  assert.deepEqual(new Set(candidates.map(({sop}) =>
    rows(sop,'target')[0].family[0])),new Set(['panel','screen']));
  for (const {sop} of candidates) assert.deepEqual(rows(sop,'target')[0].ids,['q7']);
});
