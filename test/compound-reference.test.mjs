import assert from 'node:assert/strict';
import { test } from 'node:test';
import { catalogIssues } from '../src/catalog.mjs';
import { createCompoundReferenceReader } from '../src/compound-reference.mjs';
import { evidenceInText } from '../src/grounding.mjs';
import { tokens } from '../src/lexicon.mjs';
import { quotedSpans } from '../src/literal-roles.mjs';
import { parse, validate } from '../src/schema.mjs';
import { loadWorlds } from '../src/worlds.mjs';

const frame = {family:'link',firstKey:'link.from',secondKey:'link.to',delimiter:'-'};
const worlds = {...loadWorlds(),compoundReferences:[frame]};
const reader = createCompoundReferenceReader(worlds);
const read = (text, readWith=reader) => readWith(text,tokens(text),quotedSpans(text));

test('selects existing compound objects from compact ordered labels and the native noun', () => {
  for (const [text,act,from,to] of [
    ['Start-Finish arrow, pick it','pick','Start','Finish'],
    ['Pick the n1-n2 link.','pick','n1','n2'],
    ['Could you delete Shipping-Deploy edge!','remove','Shipping','Deploy']
  ]) {
    const candidates=read(text);
    assert.equal(candidates.length,1,text);
    const {sop}=candidates[0];
    assert.ok(validate(sop,worlds),sop);
    assert.ok(evidenceInText(text,sop,worlds),sop);
    assert.deepEqual(catalogIssues(parse(sop),worlds),[]);
    assert.match(sop,new RegExp('act="'+act+'"'));
    assert.ok(sop.includes('attribute="link.from" value="'+from+'" operator=eq phase=selector'));
    assert.ok(sop.includes('attribute="link.to" value="'+to+'" operator=eq phase=selector'));
  }
});

test('declared ordered slots and a compact delimiter work for an unrelated family', () => {
  const family='route', firstKey='route.start',secondKey='route.end';
  const overlay={...worlds,
    lookup:text=>text==='route' ? [['target','pick',family,'existing','']] : worlds.lookup(text),
    requestKeys:[...worlds.requestKeys,...[firstKey,secondKey].map(name=>({name,family,head:'fill+span',values:[]}))],
    compoundReferences:[{family,firstKey,secondKey,delimiter:'-to-'}]};
  const readOverlay=createCompoundReferenceReader(overlay);
  const [candidate]=read('Pick North-to-South route',readOverlay);
  assert.match(candidate.sop,/family="route" mode=existing/);
  assert.match(candidate.sop,/attribute="route.start" value="North"/);
  assert.match(candidate.sop,/attribute="route.end" value="South"/);
  assert.deepEqual(read('Pick North-South route',readOverlay),[]);
});

test('rejects nonlocal, ambiguous, quoted, negative or non-existing references', () => {
  for (const text of [
    'pick a double-headed arrow', 'pick Start - Finish arrow', 'do not pick Start-Finish arrow',
    'pick Start-Finish arrow if ready', 'make Start-Finish arrow', 'pick "Start-Finish arrow"',
    'pick Start-Finish arrow and not the other one', 'Start-Finish arrow, pick other',
    'Start-Finish arrow, pick that one', 'pick Start-Finish-Next arrow', 'pick Start-Finish box',
    'pick Start-Finish arrow?'
  ]) assert.deepEqual(read(text),[],text);
  const ambiguous=createCompoundReferenceReader({...worlds,compoundReferences:[
    frame,{...frame,firstKey:'link.to',secondKey:'link.from'}
  ]});
  assert.deepEqual(read('Pick Start-Finish arrow',ambiguous),[]);
  const invalid=createCompoundReferenceReader({...worlds,compoundReferences:[
    {...frame,firstKey:'link.toX'}
  ]});
  assert.deepEqual(read('Pick Start-Finish arrow',invalid),[]);
});
