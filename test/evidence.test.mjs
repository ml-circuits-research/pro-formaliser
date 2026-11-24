import test from 'node:test';
import assert from 'node:assert/strict';
import { literalRanges, evidenceReport, originalEvidence } from '../src/evidence.mjs';
import { evidenceInText } from '../src/grounding.mjs';
import { parse } from '../src/schema.mjs';
import { loadWorlds } from '../src/worlds.mjs';
import { compareRequirements } from '../eval/requirements.mjs';

test('literal evidence stays in its clause and on word boundaries',()=>{
  const request='@r w.request.request act=make predicate=set';
  assert.equal(evidenceInText('sunset',request),false);
  assert.equal(evidenceInText('set it then draw',request+' words="then draw"'),false);
  assert.deepEqual(literalRanges('🪐 星星 星','星'),[[6,7]]);
  assert.deepEqual(literalRanges('𐐀x','x'),[]);
  assert.equal(evidenceInText('make blue','@r w.request.request act=make predicate=make\n@c w.request.constraint request=$r on=attribute words=blue value="dark blue"'),false);
});

test('source coverage distinguishes literal retention from semantic evidence and repetition',()=>{
  const wires=parse('@r w.request.request act=make predicate=draw\n@t w.request.target request=$r family=drawn mode=new name="Moon"\n@u w.request.unread request=$r text="over the lake"\n@f w.request.filler text="please"');
  const report=evidenceReport('please draw a Moon over the lake Moon comet',wires,loadWorlds().evidenceVocabulary);
  assert.deepEqual(report.tokens.map(t=>t.status),['filler','grounded','grammar','ambiguous_occurrence','unread','unread','unread','ambiguous_occurrence','uncovered']);
  assert.deepEqual(report.missing,[]);
});

test('changing selector to result counts as an omitted selector and an added result',()=>{
  const sop='@r w.request.request act=change\n@c w.request.constraint request=$r on=attribute attribute=paint.color operator=eq value=blue phase=selector';
  const diff=compareRequirements(parse(sop),parse(sop.replace('phase=selector','phase=result')));
  assert.deepEqual(diff.kept.map(x=>x.role),['action']);
  assert.equal(diff.omitted[0].role,'selector');
  assert.equal(diff.added[0].role,'result');
});

test('catalog distinguishes unknown keys, domains, and explicitly open values',async()=>{
  const {catalogIssues}=await import('../src/catalog.mjs');
  const worlds=loadWorlds();
  const sample=parse('@r w.request.request act=make\n@t w.request.target request=$r family=drawn mode=new\n@c w.request.constraint request=$r on=place attribute=drawn.relation value=not_in_bank');
  assert.deepEqual(catalogIssues(sample,worlds).map(x=>x.code),['outside_value_bank']);
  sample[2].attrs.open_value=['true'];
  assert.equal(catalogIssues(sample,worlds).length,0);
  assert.deepEqual(catalogIssues(sample,worlds,'calendar').map(x=>x.code),['unlicensed_family','unlicensed_key']);
});

test('spelling retains evidence offsets into both original and corrected text',async()=>{
  const {originalEvidence}=await import('../src/evidence.mjs');
  const original='🪐 smal blu moon',text='🪐 small blue moon';
  const report=evidenceReport(text,parse('@r w.request.request act=make predicate=small\n@t w.request.target request=$r family=drawn mode=new name="blue moon"'),loadWorlds().evidenceVocabulary);
  const linked=originalEvidence(report,original,[{start:3,end:7,replacement:'small'},{start:8,end:11,replacement:'blue'}]);
  assert.deepEqual(linked.tokens.map(t=>t.originalText),['smal','blu','moon']);
  assert.deepEqual(linked.spans.find(s=>s.slot==='name').originalRanges,[[8,16]]);
});

test('a recovered space maps each word to its own original letters after earlier edits',()=>{
  const original='😺 Put teh dampsoil here';
  const source='😺 Put the damp soil here';
  const tokens=['damp','soil','here'].map(text=>({text,start:source.indexOf(text),end:source.indexOf(text)+text.length}));
  const projected=originalEvidence({tokens,spans:[]},original,[
    {start:7,end:10,replacement:'the'},{start:11,end:19,replacement:'damp soil'}
  ]);
  assert.deepEqual(projected.tokens.map(t=>t.originalText),['damp','soil','here']);
});
