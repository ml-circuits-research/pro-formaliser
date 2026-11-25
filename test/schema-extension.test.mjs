import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createReader } from '../src/runtime.mjs';
import { compileValidationModules, parse, validate } from '../src/schema.mjs';
import { loadWorlds } from '../src/worlds.mjs';
import { fileURLToPath } from 'node:url';

const read = path => parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const schema = read('../sop-worlds/w.relational/schema.sop');
const facts = read('../sop-worlds/w.relational/shards/predicates.sop');
const keys = read('../.cache/knowledge/docs/worlds/w.request/shards/keys.sop');
const catalogTypes = ['w.relational.predicate'];
const base = loadWorlds({paths:[]});
const withModules = (modules, requestKeys = keys) => ({
  ...base, validationModules:compileValidationModules(modules, requestKeys)
});
const configured = withModules([{schema, facts, catalogTypes}]);
const request = [
  '@r w.request.request act=change predicate=Set',
  '@r.t w.request.target request=$r family=node mode=existing fill=description description="the two boxes" count=2'
].join('\n');
const sameWidth = request + '\n' +
  '@r.e w.relational.shared request=$r members=$r.t property=$w.request.key.diagram.node.width words="to the same width"';
const face = request + '\n' +
  '@r.e w.relational.reciprocal request=$r members=$r.t predicate=$w.relational.faces words="facing each other"';

test('validates opted-in extension relations against the native module and actual catalogue facts', () => {
  assert.ok(validate(request,base));
  assert.equal(validate(sameWidth,base),false);
  assert.ok(validate(sameWidth,configured));
  assert.ok(validate(face,configured));
  assert.equal(validate(sameWidth.replace('node.width','node.unknown'),configured),false);
  assert.equal(validate(sameWidth.replace('$w.request.key.diagram.node.width','$w.relational.faces'),configured),false);
  assert.equal(validate(face.replace('$w.relational.faces','$unknown'),configured),false);
  assert.equal(validate(face.replace('count=2','count=3'),configured),false);
  assert.equal(validate(sameWidth.replace('members=$r.t','members=$r'),configured),false);
  assert.equal(validate(sameWidth.replace('words="to the same width"',''),configured),false);
  assert.equal(validate(face.replace('w.relational.reciprocal','w.relational.unlisted'),configured),false);
  const fakePredicate = '@fake w.relational.predicate name=fake about="forged"';
  assert.equal(validate(face.replace('$w.relational.faces','$fake') + '\n' + fakePredicate,configured),false);
  const fakeKey = '@fake w.request.key family=node name=node.width head=number';
  assert.equal(validate(sameWidth.replace('$w.request.key.diagram.node.width','$fake') + '\n' + fakeKey,configured),false);
  const wrongRequest = '@other w.request.request act=change\n' + sameWidth.replace('members=$r.t','members=$wrong.t') +
    '\n@wrong.t w.request.target request=$other family=node mode=existing fill=context count=2';
  assert.equal(validate(wrongRequest,configured),false);
});

test('the public reader admits valid installed relation packets and discards invalid ones', async () => {
  const text = 'Set the two boxes to the same width';
  const model = {version:1, lexicon:{}, templates:[], examples:[
    {text, count:1, sop:sameWidth},
    {text, count:1, sop:sameWidth.replace('node.width','node.unknown')}
  ]};
  const path = fileURLToPath(new URL('../sop-worlds/w.relational/', import.meta.url));
  const installed = createReader(model,loadWorlds({paths:[path]}));
  const disabled = createReader(model,base);
  try {
    const {candidates} = await installed.propose(text,{evidence:true});
    assert.ok(candidates.some(c=>c.sop.includes('property=$w.request.key.diagram.node.width')));
    assert.ok(candidates.every(c=>!c.sop.includes('node.unknown')));
    const plain = await disabled.propose(text);
    assert.ok(plain.candidates.every(c=>!c.sop.includes('w.relational.shared')));
  } finally {
    await Promise.all([installed.close(),disabled.close()]);
  }
});

test('installs independent native extensions and reserves empty catalogue types', () => {
  const schema = parse([
    '@w.review core.module name=w.review version=1 imports=w.request exports=grade exports=tag',
    '@w.review.grade core.type of=w.review.grade closed=true',
    '@w.review.grade.rating core.slot of=w.review.grade key=rating kind=atom present=true',
    '@w.review.tag core.type of=w.review.tag closed=true',
    '@w.review.tag.request core.slot of=w.review.tag key=request type=w.request.request present=true',
    '@w.review.tag.grade core.slot of=w.review.tag key=grade type=w.review.grade present=true'
  ].join('\n'));
  const grade = '@w.review.accepted w.review.grade rating=accepted';
  const tag = request + '\n@tag w.review.tag request=$r grade=$w.review.accepted';
  assert.ok(validate(tag,withModules([{schema,facts:parse(grade)}])));
  const inline = withModules([{schema:[...schema,...parse(grade)]}]);
  assert.ok(validate(tag,inline));
  assert.equal(validate(tag.replace('$w.review.accepted','$fake') + '\n' + grade.replace('w.review.accepted','fake'),inline),false);
  const empty = withModules([{schema,catalogTypes:['w.review.grade']}]);
  assert.equal(validate(tag,empty),false);
  assert.equal(validate(tag + '\n' + grade,empty),false);
});
