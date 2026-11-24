import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { createFormaliser } from '../src/formaliser.mjs';
import { evidenceInText } from '../src/grounding.mjs';
import { parse, validate } from '../src/schema.mjs';
import { loadWorlds } from '../src/worlds.mjs';

const hasField = (proposal, key, value) => parse(proposal.sop).some(wire =>
  wire.type === 'w.request.constraint' && wire.attrs.attribute?.[0] === key &&
  wire.attrs.value?.[0] === JSON.stringify(value));

async function propose(reader, text) {
  const {candidates} = await reader.formalise(text);
  return candidates.filter(candidate => candidate.source === 'literal-attachment');
}

test('attaches explicit unquoted labels and preserves separately grounded placement', async t => {
  const worlds = loadWorlds();
  const reader = createFormaliser({version:1,examples:[],templates:[],lexicon:{
    diamond:[['target','make','node','new','diamond',1]],
    box:[['target','make','node','new','box',1]],
    create:[['act','make','do',1]],
    tree:[['target','make','drawn','new','tree',1],['target','place','drawn','existing','tree',1]],
  }},worlds);
  t.after(() => reader.close());
  for (const [text,key,value] of [
    ['make a diamond labelled Depts','node.label','Depts'],
    ['add a paragraph saying Hello readers','section.content','Hello readers'],
    ['create a box called Nimbus beside the tree','node.label','Nimbus'],
  ]) {
    const proposals = await propose(reader,text);
    const grounded = proposals.find(p => hasField(p,key,value));
    assert.ok(grounded,text);
    assert.ok(evidenceInText(text,grounded.sop,worlds));
    assert.ok(validate(grounded.sop,worlds));
    if (text.includes('beside')) assert.match(grounded.sop,/attribute=node\.anchor/);
  }
  for (const text of [
    'create a box called Nimbus and remove the triangle',
    'create a box called Nimbus without a shadow',
    'create a box with a shadow',
  ]) assert.ok(!(await propose(reader,text)).some(p => parse(p.sop).some(wire =>
    wire.type === 'w.request.constraint' && wire.attrs.attribute?.[0] === 'node.label' &&
    /without a shadow|and remove|a shadow/u.test(wire.attrs.value?.[0] ?? ''))),text);
});

test('reads a literal cue and field contributed by an independently declared family', async t => {
  const dir = mkdtempSync(fileURLToPath(new URL('../.cache/literal-attachment-test-',import.meta.url)));
  t.after(() => rmSync(dir,{recursive:true,force:true}));
  const overlay = join(dir,'overlay.sop');
  writeFileSync(overlay,`
@smithwork std.schema.world name=w.smithwork
@stamp std.schema.kind of=w.smithwork.stamp world=w.smithwork acts=make
@serial w.request.key tab=diagram family=stamp name=stamp.serial head=span
@serial.role pro.reader.literal family=stamp attribute=stamp.serial role=name text=marked
`);
  const worlds = loadWorlds({paths:[overlay]});
  const reader = createFormaliser(undefined,worlds);
  t.after(() => reader.close());
  const text = 'create a stamp marked copper 37';
  const proposals = await propose(reader,text);
  const grounded = proposals.find(p => hasField(p,'stamp.serial','copper 37'));
  assert.ok(grounded);
  assert.ok(evidenceInText(text,grounded.sop,worlds));
  assert.ok(validate(grounded.sop,worlds));
});
