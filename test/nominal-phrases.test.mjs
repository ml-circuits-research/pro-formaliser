import assert from 'node:assert/strict';
import test from 'node:test';
import { tokens } from '../src/lexicon.mjs';
import { quotedSpans } from '../src/literal-roles.mjs';
import { createNominalPhraseLearner, nativeNominalPhraseReadings, nominalPhraseReadings, nominalPositionForms } from '../src/nominal-phrases.mjs';
import { evidenceInText } from '../src/grounding.mjs';
import { parse, validate } from '../src/schema.mjs';
import { loadWorlds } from '../src/worlds.mjs';

const worlds = loadWorlds();
const request = '@r w.request.request act=make mood=do predicate=draw';
const target = sort => '@t w.request.target request=$r family=drawn mode=new sort=' + sort;
const placement = (attribute, value, phase) => '@c.' + attribute + ' w.request.constraint request=$r on=place attribute=drawn.' +
  attribute + ' value=' + value + ' operator=relation phase=' + phase;

function learn(witnesses) {
  const learner = createNominalPhraseLearner();
  for (const [sort, predicate, attribute = 'arrangement', value = 'row'] of witnesses) {
    const [req, noun, property] = parse([
      request, target(sort),
      '@c w.request.constraint request=$r on=attribute attribute=drawn.' + attribute +
      ' value=' + value + ' words="in a row" operator=eq phase=result',
    ].join('\n'));
    learner.observe(predicate + ' ' + sort + ' in a row', noun, property, req);
  }
  return learner.finish();
}

const forms = learn([['birds','draw'], ['houses','make']]);
const read = (text, sop, trained = forms) => nominalPhraseReadings(text,tokens(text),quotedSpans(text),{sop},trained,worlds);

test('learns independently repeated noun-local meanings while retaining exact evidence', () => {
  assert.deepEqual(learn([['birds','draw'], ['birds','make']]), {});
  assert.deepEqual(learn([['birds','draw'], ['houses','make'], ['boxes','draw','arrangement','grid']]), {});
  const text = 'Draw stars IN a Row under the bridge';
  const [result] = read(text, [
    request.replace('predicate=draw', 'predicate=Draw'), target('stars'),
    '@u w.request.unread request=$r text="IN a Row under the bridge"',
  ].join('\n'));
  assert.match(result.sop, /attribute=drawn\.arrangement value=row words="IN a Row"/);
  assert.match(result.sop, /w\.request\.unread request=\$r text="under the bridge"/);
  assert.ok(validate(result.sop,worlds));
  assert.ok(evidenceInText(text,result.sop,worlds));
});

test('requires independently repeated evidence before accepting a conflicting majority', () => {
  const witnesses = Array.from({length:49}, (_, i) => [i % 2 ? 'birds' : 'houses', 'draw ' + i]);
  const dissent = ['boxes','draw','arrangement','grid'];
  const learned = learn([...witnesses, dissent]);
  assert.deepEqual(learned, forms);
  assert.deepEqual(learn([...witnesses.slice(0,-1), dissent]), {});
  assert.deepEqual(learn([...Array(100).fill(['birds','DRAW']), ['houses','draw'], dissent]), {});
  const conflictingDuplicate = [...witnesses[0], 'arrangement', 'grid'];
  assert.deepEqual(learn([...witnesses, conflictingDuplicate]), {});
  assert.deepEqual(learn([...witnesses, ['houses','draw extra'], conflictingDuplicate]), forms);
});

test('reinterprets only an exact relation and anchor pair, preserving following placement', () => {
  const text = 'draw stars in a row above the tree';
  const sop = [
    request,target('stars'),
    placement('relation','in','result'),
    placement('anchor','"a row"','selector'),
    '@a w.request.lookup request=$r constraint=$c.anchor key=thing from=page',
    placement('relation','above','result').replace('@c.relation','@c.other'),
    placement('anchor','"the tree"','selector').replace('@c.anchor','@c.other.anchor'),
    '@b w.request.lookup request=$r constraint=$c.other.anchor key=thing from=page',
  ].join('\n');
  const [result] = read(text,sop);
  assert.match(result.sop,/attribute=drawn\.arrangement value=row words="in a row"/);
  assert.doesNotMatch(result.sop,/value=(?:in|"a row") operator=relation/);
  assert.match(result.sop,/value=above operator=relation/);
  assert.match(result.sop,/constraint=\$c\.other\.anchor/);
  assert.ok(validate(result.sop,worlds));
  assert.ok(evidenceInText(text,result.sop,worlds));
  assert.deepEqual(read(text,sop.replace('value="a row"','value="row above"')),[]);
});

test('declines negated, quoted, ambiguously repeated, and unlicensed readings', () => {
  const sop = [request, target('stars'), '@u w.request.unread request=$r text="in a row"'].join('\n');
  assert.deepEqual(read('do not draw stars in a row',sop),[]);
  assert.deepEqual(read('draw "stars in a row"',sop),[]);
  assert.deepEqual(read('draw stars in a row near the stars',sop),[]);
  assert.deepEqual(read('draw stars in a row formation',sop),[]);
  assert.deepEqual(read('draw stars in a row of circles',sop),[]);
  assert.deepEqual(read('draw stars in a row',sop.replace('act=make','act=place')),[]);
  assert.deepEqual(read('draw stars in a row',sop +
    '\n@c w.request.constraint request=$r on=attribute attribute=drawn.arrangement value=grid'),[]);
});

test('native family bindings read a row and an adjacent region without replacing the landmark',()=>{
  const byType=new Map();
  for (const wire of parse(`
@spatial pro.reader.spatial family=drawn region_key=drawn.at arrangement_key=drawn.arrangement
@row w.lang.en.arrangement text="in a row" layout=row
@bottom w.lang.en.cue on=place value=bottom relation=at lead="at the bottom" takes=none
@above w.lang.en.cue on=place value=top relation=at lead="above the bridge" takes=thing
`)) byType.set(wire.type,[...(byType.get(wire.type) ?? []),wire]);
  const index=nominalPositionForms(type=>byType.get(type) ?? [],worlds.requestKeys);
  const text='draw stars in a row at the bottom above the tree';
  const candidate={sop:[
    request,target('stars'),
    placement('relation','in','result'),
    placement('anchor','"a row"','selector'),
    '@a w.request.lookup request=$r constraint=$c.anchor key=thing from=page',
    '@u w.request.unread request=$r text="at the bottom"',
    placement('relation','above','result').replace('@c.relation','@c.other'),
    placement('anchor','"the tree"','selector').replace('@c.anchor','@c.other.anchor'),
    '@b w.request.lookup request=$r constraint=$c.other.anchor key=thing from=page',
  ].join('\n')};
  const [reading]=nativeNominalPhraseReadings(text,tokens(text),quotedSpans(text),candidate,index,worlds);
  assert.match(reading.sop,/attribute=drawn\.arrangement value=row words="in a row" operator=eq/);
  assert.match(reading.sop,/attribute=drawn\.at value=bottom words="at the bottom" operator=region/);
  assert.match(reading.sop,/constraint=\$c\.other\.anchor/);
  assert.doesNotMatch(reading.sop,/value="a row"/);
  assert.match(candidate.sop,/value="a row"/);
  assert.ok(validate(reading.sop,worlds));
  assert.ok(evidenceInText(text,reading.sop,worlds));
});
