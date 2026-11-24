import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { createFormaliser } from '../src/formaliser.mjs';
import { quotedLiteralCleanup } from '../src/literal-attachment.mjs';
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

function copiedLiteral(family, key, value, extra = '') {
  return {source:'alignment',status:'matched',sop:[
    '@r w.request.request act=make mood=do predicate=add',
    '@t w.request.target request=$r family='+family+' mode=new',
    '@c w.request.constraint request=$r on=attribute attribute='+key+' operator=eq phase=result value='+JSON.stringify(value),
    extra
  ].filter(Boolean).join('\n')};
}

test('cleans a quoted display payload and keeps grounded placement', async t => {
  const worlds=loadWorlds();
  assert.ok(!worlds.literalGrammar.bindings.some(binding=>binding.family==='drawn' && binding.role==='payload' && binding.attribute==='drawn.text'));
  const text="add the word 'BAKERY' above the gate";
  const candidate=copiedLiteral('drawn','drawn.text',"the word 'BAKERY'",[
    '@p w.request.constraint request=$r on=place attribute=drawn.relation value=above operator=relation phase=result',
    '@a w.request.constraint request=$r on=place attribute=drawn.anchor value="the gate" operator=relation phase=selector'
  ].join('\n'));
  const reader=createFormaliser({version:1,examples:[{text,sop:candidate.sop,count:1}],templates:[],lexicon:{}},worlds);
  t.after(()=>reader.close());
  const result=await reader.formalise(text);
  const cleaned=result.candidates.find(c=>c.source==='quoted-literal-cleanup');
  assert.ok(cleaned);
  assert.ok(hasField(cleaned,'drawn.text','BAKERY'));
  for (const id of ['p','a']) assert.deepEqual(parse(cleaned.sop).find(w=>w.id===id).attrs,
    parse(candidate.sop).find(w=>w.id===id).attrs);
  assert.ok(evidenceInText(text,cleaned.sop,worlds));
  assert.ok(validate(cleaned.sop,worlds));
});

test('requires a uniquely located authored quote, licensed introducer and bound literal role', t=>{
  const dir=mkdtempSync(fileURLToPath(new URL('../.cache/quoted-cleanup-test-',import.meta.url)));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const overlay=join(dir,'press.sop');
  writeFileSync(overlay,`
@press std.schema.world name=w.press
@poster std.schema.kind of=w.press.poster world=w.press acts=make
@title w.request.key tab=diagram family=poster name=poster.heading head=span
@title.role pro.reader.literal family=poster attribute=poster.heading role=payload text=headline
`);
  const worlds=loadWorlds({paths:[overlay]});
  const value='the headline “Café & scones!”';
  const text='add '+value;
  const candidate=copiedLiteral('poster','poster.heading',value);
  const cleaned=quotedLiteralCleanup(text,candidate,worlds);
  assert.ok(hasField(cleaned,'poster.heading','Café & scones!'));
  assert.ok(validate(cleaned.sop,worlds));
  assert.ok(evidenceInText(text,cleaned.sop,worlds));
  for (const [text,key,value] of [
    ['add the headline “Saved”','poster.unknown','the headline “Saved”'],
    ['add the title “Saved”','poster.heading','the title “Saved”'],
    ['add every headline “Saved”','poster.heading','every headline “Saved”'],
    ['add the headline “Some ‘nested’ text”','poster.heading','the headline “Some ‘nested’ text”'],
    ['add the headline “Saved”','poster.heading','the headline “Different”'],
    ['add the headline “Saved” on top','poster.heading','the headline “Saved” on top'],
    ['add the headline “Saved” then add the headline “Saved”','poster.heading','the headline “Saved”'],
    ['add “the headline ‘Saved’”','poster.heading','the headline ‘Saved’'],
  ]) assert.equal(quotedLiteralCleanup(text,copiedLiteral('poster',key,value),worlds),undefined,text);
});
