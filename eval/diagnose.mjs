import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { delimiter, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { referencesOf } from '../src/corpus.mjs';
import { createReader } from '../src/runtime.mjs';
import { parse } from '../src/schema.mjs';
import { loadWorlds } from '../src/worlds.mjs';
import { checkCircuit } from './check-circuit.mjs';
import { releaseCases } from './diagnose-cases.mjs';
import { probeSchema } from './diagnose-schema.mjs';
import { validReferencesOf } from './reference-circuits.mjs';
import { signatures } from '../src/signatures.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const cache = join(root, '.cache');
const categories = new Set(['mechanism', 'missing_knowledge', 'schema_expressive_limit',
  'annotation', 'unknown']);
const keyOf = row => row.source + ':' + row.row;
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
  const accepted = evidence.witness?.nativeValid && evidence.witness.errors.length === 0;
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
    case 'annotation':
      supported = accepted && review.witness !== 'annotation' && Boolean(evidence.annotationDisagrees);
      break;
  }
  return supported ? review.category : 'unknown';
}

async function diagnoseProbes(row, review, witness, resources) {
  const { reader, model, worlds, paths, directory } = resources;
  const candidates = candidatesOf(row.prediction);
  const baseline = candidatesOf(await reader.formalise(row.text));
  const sops = readings => JSON.stringify(readings.map(candidate => candidate.sop));
  const evidence = { reproducedCandidates: sops(candidates) === sops(baseline) };
  if (witness) {
    evidence.witness = checkCircuit(row.text, witness, worlds);
    if (evidence.witness.nativeValid) {
      const shape=JSON.stringify(signatures(parse(witness),true));
      evidence.annotationDisagrees=!validReferencesOf(row).some(({sop})=>
        shape===JSON.stringify(signatures(parse(sop),true)));
    }
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
    const expanded = loadWorlds({ paths: [...paths, overlayFile] });
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
  return evidence;
}

export async function diagnose(rows, cases, model) {
  const disagreements = rows.filter(row => !row.semanticWireMatch && !row.alternativeSemanticMatch);
  const byKey = new Map(disagreements.map(row => [keyOf(row), row]));
  const claims = cases.filter(review => byKey.has(keyOf(review)));
  if (new Set(claims.map(keyOf)).size !== claims.length) throw Error('Duplicate diagnostic review for a held-out row');
  const directory = mkdtempSync(join(cache, 'diagnosis-'));
  const paths = (process.env.SOP_WORLDS ?? '').split(delimiter).filter(Boolean);
  const worlds = loadWorlds({ paths });
  const reader = createReader(model, worlds);
  try {
    const reviewed = [];
    for (const review of claims) {
      const key = keyOf(review), row = byKey.get(key);
      const refs=referencesOf(row);
      const witness = review.witness === 'annotation' ?
        (review.referenceColumn ? refs.find(ref=>ref.column===review.referenceColumn) :
          refs.length===1 ? refs[0] : undefined)?.sop : review.witness;
      const evidence = await diagnoseProbes(row, review, witness, { reader, model, worlds, paths, directory });
      reviewed.push({ key, text: row.text, scope: review.scope, review: review.review,
        proposed: review.category, classification: reviewDecision(review, evidence), evidence });
    }
    const counts = Object.fromEntries([...categories].map(category => [category, 0]));
    counts.unknown = disagreements.length - reviewed.length;
    for (const item of reviewed) counts[item.classification]++;
    return { rows: rows.length, disagreements: disagreements.length, reviewed: reviewed.length,
      unreviewed: disagreements.length - reviewed.length, counts, cases: reviewed };
  } finally {
    try { await reader.close(); }
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
