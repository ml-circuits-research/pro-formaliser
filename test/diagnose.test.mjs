import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hasWire, reviewDecision } from '../eval/diagnose.mjs';
import { releaseCases } from '../eval/diagnose-cases.mjs';
import { probeSchema } from '../eval/diagnose-schema.mjs';
import { loadWorlds } from '../src/worlds.mjs';

const accepted = { nativeValid: true, checker: { errors: [] } };
const review = category => ({ category, scope: 'A single request feature', review: 'Independently assessed intent' });

test('mechanism diagnosis requires a valid witness and a useful contrast', () => {
  const mechanism = review('mechanism');
  const evidence = { witness: accepted, contrast: { heldOut: [], baseline: [], contrast: [2] } };
  assert.equal(reviewDecision(mechanism, evidence), 'mechanism');
  assert.equal(reviewDecision(mechanism, { ...evidence, witness: { ...accepted, checker: { errors: ['key'] } } }), 'unknown');
  assert.equal(reviewDecision(mechanism, { ...evidence, contrast: { heldOut: [], baseline: [1], contrast: [0] } }), 'unknown');
  assert.equal(hasWire('@c w.request.constraint attribute="section.content" value="draft text"',
    { type: 'constraint', attribute: 'section.content', value: 'draft text' }), true);
});

test('knowledge attribution requires the declaration alone to change the contrast', () => {
  const evidence = {
    witness: accepted,
    overlay: { catalogBefore: false, catalogAfter: true, contrast: { before: [], after: [0] } },
  };
  assert.equal(reviewDecision(review('missing_knowledge'), evidence), 'missing_knowledge');
  assert.equal(reviewDecision(review('missing_knowledge'), { ...evidence, overlay: { ...evidence.overlay,
    contrast: { before: [], after: [] } } }), 'unknown');
});

test('a native schema differential demonstrates the scoped missing slot, leaving intent open', () => {
  const example = releaseCases.find(item => item.schema);
  const worlds = loadWorlds({ paths: [] });
  const schema = probeSchema(example.schema, worlds);
  assert.equal(schema.closedSlot, true);
  assert.equal(schema.baselineRejected, true);
  assert.equal(schema.extendedAccepted, true);
  assert.equal(schema.alternatives[0].nativeValid, true);
  assert.equal(reviewDecision(example, { schema }), 'unknown');
  const claim = { ...review('schema_expressive_limit'), schema: {
    excludedEncodings: 'Lookup from previous carries no reference to the specific antecedent wire.',
  } };
  assert.equal(reviewDecision(claim, { schema }), 'schema_expressive_limit');
  assert.equal(reviewDecision({ ...claim, schema: {} }, { schema }), 'unknown');
  assert.throws(() => probeSchema({ ...example.schema, slot: 'different' }, worlds), /precisely the reviewed slot/);
});

test('ambiguity needs a changed selection, and annotation needs a distinct accepted witness', () => {
  const contexts = [
    { actualFamily: 'node', expectedFamily: 'node', selectedIndex: 1 },
    { actualFamily: 'drawn', expectedFamily: 'drawn', selectedIndex: 0 },
  ];
  assert.equal(reviewDecision(review('ambiguous_context'), { witness: accepted, contexts }), 'ambiguous_context');
  assert.equal(reviewDecision(review('ambiguous_context'), { witness: accepted, contexts: contexts.slice(0, 1) }), 'unknown');
  const annotation = { ...review('annotation'), witness: '@r w.request.request act=make' };
  assert.equal(reviewDecision(annotation, { witness: accepted, annotationDisagrees: true }), 'annotation');
  assert.equal(reviewDecision(annotation, { witness: accepted, annotationDisagrees: false }), 'unknown');
});
