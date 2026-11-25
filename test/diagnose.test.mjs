import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hasWire, reviewDecision } from '../eval/diagnose.mjs';
import { checkCircuit } from '../eval/check-circuit.mjs';
import { probeSchema } from '../eval/diagnose-schema.mjs';
import { loadWorlds } from '../src/worlds.mjs';

const accepted = { nativeValid: true, errors: [] };
const review = category => ({ category, scope: 'A single request feature', review: 'Independently assessed intent' });

test('mechanism diagnosis requires a valid witness and a useful contrast', () => {
  const mechanism = review('mechanism');
  const evidence = { witness: accepted, contrast: { heldOut: [], baseline: [], contrast: [2] } };
  assert.equal(reviewDecision(mechanism, evidence), 'mechanism');
  assert.equal(reviewDecision(mechanism, { ...evidence, witness: { ...accepted, errors: ['unlicensed_key'] } }), 'unknown');
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
  const base = [
    '@r w.request.request act=change',
    '@width w.request.constraint request=$r on=attribute attribute=node.width value=10',
    '@height w.request.constraint request=$r on=attribute attribute=node.height',
  ].join('\n');
  const example = {
    type: 'w.request.constraint',
    slot: 'source_constraint',
    extension: '@diagnosis.source core.slot of=w.request.constraint key=source_constraint type=w.request.constraint',
    witness: base + ' source_constraint=$width',
    alternatives: [{ sop: base, nativeValid: true,
      rationale: 'The independent constraints omit the direction of dependence.' }],
  };
  const worlds = loadWorlds({ paths: [] });
  const schema = probeSchema(example, worlds);
  assert.equal(schema.closedSlot, true);
  assert.equal(schema.baselineRejected, true);
  assert.equal(schema.extendedAccepted, true);
  assert.equal(schema.alternatives[0].nativeValid, true);
  const draft = review('schema_expressive_limit');
  assert.equal(reviewDecision(draft, { schema }), 'unknown');
  const claim = { ...draft, schema: { excludedEncodings: 'The independent constraints omit their dependency.' } };
  assert.equal(reviewDecision(claim, { schema }), 'schema_expressive_limit');
  assert.equal(reviewDecision({ ...claim, schema: {} }, { schema }), 'unknown');
  assert.throws(() => probeSchema({ ...example, slot: 'different' }, worlds), /precisely the reviewed slot/);
});

test('annotation needs a distinct accepted witness', () => {
  const annotation = { ...review('annotation'), witness: '@r w.request.request act=make' };
  assert.equal(reviewDecision(annotation, { witness: accepted, annotationDisagrees: true }), 'annotation');
  assert.equal(reviewDecision(annotation, { witness: accepted, annotationDisagrees: false }), 'unknown');
});

test('circuit checks find schema, catalogue and evidence errors without source folders', () => {
  const worlds = loadWorlds({ paths: [] });
  const text = 'change the chart';
  const request = '@r w.request.request act=change predicate=change';
  const target = '@t w.request.target request=$r family=chart mode=existing family_words=chart';
  assert.deepEqual(checkCircuit(text, [request, target].join('\n'), worlds), accepted);
  assert.deepEqual(checkCircuit(text, request + ' unknown_key=yes', worlds).errors, ['native_schema']);
  assert.deepEqual(checkCircuit(text, [request, target.replace('family=chart', 'family=missing')].join('\n'), worlds).errors,
    ['unlicensed_family']);
  assert.deepEqual(checkCircuit(text, [request.replace('predicate=change', 'predicate=move'), target].join('\n'), worlds).errors,
    ['source_evidence']);
});
