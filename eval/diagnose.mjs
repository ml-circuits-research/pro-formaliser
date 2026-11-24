import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { DATASET, DATASET_REVISION } from '../src/corpus.mjs';
import { createEstimator } from '../src/estimate.mjs';
import { createReader } from '../src/runtime.mjs';
import { parse, validate } from '../src/schema.mjs';
import { loadWorlds } from '../src/worlds.mjs';
import { releaseCases } from './diagnose-cases.mjs';
import { probeSchema } from './diagnose-schema.mjs';
import { signatures } from '../src/signatures.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const cache = join(root, '.cache');
const knowledge = join(cache, 'knowledge');
const areas = new Set(['avatar', 'calendar', 'diagram', 'document', 'drawing']);
const categories = new Set(['mechanism', 'missing_knowledge', 'schema_expressive_limit',
  'ambiguous_context', 'annotation', 'unknown']);
const keyOf = row => row.source + ':' + row.row;
const csvField = value => '"' + value.replaceAll('"', '""') + '"';
const decode = value => value.startsWith('"') ? JSON.parse(value) : value;
const candidatesOf = prediction => [prediction, ...(prediction.alternatives ?? [])].filter(candidate => candidate.sop);

export function hasWire(sop, { type, ...fields }) {
  return Boolean(sop) && parse(sop).some(wire => wire.type === 'w.request.' + type &&
    Object.entries(fields).every(([key, value]) => wire.attrs[key]?.some(token => decode(token) === value)));
}

export function reviewDecision(review, evidence) {
  if (!categories.has(review.category) || !review.scope?.trim() || !review.review?.trim()) {
    throw Error('Diagnostic review requires a category, scoped claim and review rationale');
  }
  const accepted = evidence.witness?.nativeValid && evidence.witness.checker?.errors.length === 0;
  const noFeature = probe => !probe.heldOut.length && !probe.baseline.length && probe.contrast.length > 0;
  let supported = false;
  switch (review.category) {
    case 'mechanism':
      supported = accepted && Boolean(evidence.contrast && noFeature(evidence.contrast));
      break;
    case 'missing_knowledge':
      supported = accepted && Boolean(evidence.overlay &&
        !evidence.overlay.catalogBefore && evidence.overlay.catalogAfter &&
        !evidence.overlay.contrast.before.length && evidence.overlay.contrast.after.length);
      break;
    case 'schema_expressive_limit':
      // Negative schema witnesses alone do not establish an expressive limit.
      // Require reviewer-owned alternative encodings and a scoped schema contrast.
      supported = Boolean(evidence.schema?.closedSlot && evidence.schema.baselineRejected &&
        evidence.schema.extendedAccepted && evidence.schema.alternativesConsistent &&
        review.schema?.excludedEncodings?.trim());
      break;
    case 'ambiguous_context':
      supported = accepted && Boolean(evidence.contexts?.length > 1 &&
        evidence.contexts.every(item => item.actualFamily === item.expectedFamily) &&
        new Set(evidence.contexts.map(item => item.selectedIndex)).size > 1 &&
        new Set(evidence.contexts.map(item => item.expectedFamily)).size > 1);
      break;
    case 'annotation':
      supported = accepted && review.witness !== 'annotation' && Boolean(evidence.annotationDisagrees);
      break;
  }
  return supported ? review.category : 'unknown';
}

function checkedWitnesses(directory, fixtures, { dataset, revision }) {
  if (!fixtures.length) return new Map();
  const checker = join(directory, 'check.mjs');
  writeFileSync(checker, execFileSync('git', ['-C', dataset, 'show', revision + ':tools/check.mjs']));
  const byFile = new Map();
  for (const [index, fixture] of fixtures.entries()) {
    if (!areas.has(fixture.tab)) throw Error('Unknown checker area: ' + fixture.tab);
    const name = fixture.tab + '/witness-' + index + '.csv';
    mkdirSync(join(directory, fixture.tab), { recursive: true });
    writeFileSync(join(directory, name), 'text,sop\n' + [fixture.text, fixture.sop].map(csvField).join(',') + '\n');
    byFile.set(name, { key: fixture.key, errors: [] });
  }
  const out = join(directory, 'checker.json');
  const result = spawnSync(process.execPath, [checker, '--knowledge', knowledge, '--dataset', directory,
    '--examples', String(fixtures.length), '--json', out], { encoding: 'utf8' });
  if (result.error || ![0, 1].includes(result.status)) throw result.error ?? Error(result.stderr);
  const report = JSON.parse(readFileSync(out, 'utf8'));
  if (report.total !== fixtures.length) throw Error('Checker did not read all diagnostic witnesses');
  for (const group of report.groups) {
    if (group.n !== group.examples.length) throw Error('Checker truncated diagnostic witness evidence');
    for (const example of group.examples) byFile.get(example.where).errors.push(group.violation);
  }
  return new Map([...byFile.values()].map(({ key, errors }) => [key, { errors }]));
}

async function diagnoseProbes(row, review, witness, checker, resources) {
  const { reader, estimator, model, worlds, directory } = resources;
  const candidates = candidatesOf(row.prediction);
  const baseline = candidatesOf(await reader.formalise(row.text));
  const sops = readings => JSON.stringify(readings.map(candidate => candidate.sop));
  const evidence = { reproducedCandidates: sops(candidates) === sops(baseline) };
  if (witness) {
    evidence.witness = { nativeValid: validate(witness, worlds), checker };
    evidence.annotationDisagrees = JSON.stringify(signatures(parse(witness), true)) !==
      JSON.stringify(signatures(parse(row.sop), true));
  }
  const positions = (readings, wire) => readings.flatMap((candidate, index) => hasWire(candidate.sop, wire) ? [index] : []);
  const probes = review.probes ?? {};
  if (review.schema) evidence.schema = probeSchema(review.schema, worlds);
  if (probes.contrast) {
    const { text, wire } = probes.contrast;
    const contrast = await reader.formalise(text);
    evidence.contrast = { text, wire, heldOut: positions(candidates, wire),
      baseline: positions(baseline, wire), contrast: positions(candidatesOf(contrast), wire) };
  }
  if (probes.overlay) {
    const { sop, surface, family, contrast, wire } = probes.overlay;
    const overlayFile = join(directory, 'probe-overlay.sop');
    writeFileSync(overlayFile, sop + '\n');
    const expanded = loadWorlds({ paths: [overlayFile] });
    const overlayReader = createReader(model, expanded);
    const catalogHas = snapshot => snapshot.lookup(surface).some(([role, , itemFamily, value]) =>
      role === 'constraint' && family === itemFamily && hasWire('@c w.request.constraint ' + value, wire));
    try {
      evidence.overlay = {
        surface, wire, catalogBefore: catalogHas(worlds), catalogAfter: catalogHas(expanded),
        original: {
          heldOut: positions(candidates, wire),
          before: positions(baseline, wire),
          after: positions(candidatesOf(await overlayReader.formalise(row.text)), wire),
        },
        contrast: {
          text: contrast,
          before: positions(candidatesOf(await reader.formalise(contrast)), wire),
          after: positions(candidatesOf(await overlayReader.formalise(contrast)), wire),
        },
      };
    } finally { await overlayReader.close(); }
  }
  if (probes.contexts) {
    evidence.contexts = [];
    for (const { context, family } of probes.contexts) {
      const result = await estimator.estimate(candidates, context);
      const selected = candidates[result.selectedIndex];
      const matches = selected && hasWire(selected.sop, { type: 'target', family });
      evidence.contexts.push({ context, expectedFamily: family, actualFamily: matches ? family : null,
        selectedIndex: result.selectedIndex, decision: result.decision, candidateCount: candidates.length });
    }
  }
  return evidence;
}

export async function diagnose(rows, cases, model, { dataset = DATASET, revision = DATASET_REVISION } = {}) {
  const disagreements = rows.filter(row => !row.semanticWireMatch);
  const byKey = new Map(disagreements.map(row => [keyOf(row), row]));
  const claims = cases.filter(review => byKey.has(keyOf(review)));
  if (new Set(claims.map(keyOf)).size !== claims.length) throw Error('Duplicate diagnostic review for a held-out row');
  const directory = mkdtempSync(join(cache, 'diagnosis-'));
  const worlds = loadWorlds({ paths: [] });
  const reader = createReader(model, worlds);
  const estimator = createEstimator(worlds);
  try {
    const fixtures = claims.flatMap(review => {
      const row = byKey.get(keyOf(review));
      const sop = review.witness === 'annotation' ? row.sop : review.witness;
      return sop ? [{ key: keyOf(row), text: row.text, tab: row.family, sop }] : [];
    });
    const witnessSops = new Map(fixtures.map(fixture => [fixture.key, fixture.sop]));
    const checked = checkedWitnesses(directory, fixtures, { dataset, revision });
    const reviewed = [];
    for (const review of claims) {
      const key = keyOf(review), row = byKey.get(key);
      if (row.prediction.estimation) throw Error('Use text-only held-out details for diagnostic probes: ' + key);
      const evidence = await diagnoseProbes(row, review, witnessSops.get(key), checked.get(key),
        { reader, estimator, model, worlds, directory });
      reviewed.push({ key, text: row.text, scope: review.scope, review: review.review,
        proposed: review.category, classification: reviewDecision(review, evidence), evidence });
    }
    const counts = Object.fromEntries([...categories].map(category => [category, 0]));
    counts.unknown = disagreements.length - reviewed.length;
    for (const item of reviewed) counts[item.classification]++;
    return { rows: rows.length, disagreements: disagreements.length, reviewed: reviewed.length,
      unreviewed: disagreements.length - reviewed.length, counts, cases: reviewed };
  } finally {
    try { await Promise.all([reader.close(), estimator.close()]); }
    finally { rmSync(directory, { recursive: true, force: true }); }
  }
}

async function main() {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { model: { type: 'string' }, cases: { type: 'string' } },
  });
  if (positionals.length !== 1 || !values.model) {
    throw Error('Usage: node eval/diagnose.mjs DETAILS.jsonl --model MODEL.json [--cases PLAN.mjs]');
  }
  const rows = readFileSync(positionals[0], 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
  const cases = values.cases ? (await import(pathToFileURL(resolve(values.cases)))).cases : releaseCases;
  const model = JSON.parse(readFileSync(values.model, 'utf8'));
  console.log(JSON.stringify(await diagnose(rows, cases, model), null, 2));
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  await main();
}
