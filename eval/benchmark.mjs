import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { DATASET, DATASET_REVISION, loadCorpus, normalizeText, splitCorpus } from '../src/corpus.mjs';
import { loadWorlds } from '../src/worlds.mjs';
import { checkCircuit } from './check-circuit.mjs';
import { checkReferences, scoreReferences } from './reference-circuits.mjs';
import { measureRequirements } from './requirements.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const cache = join(root, '.cache');
const options = {};
const flags = new Set(['--dataset', '--revision', '--model', '--report', '--details', '--bucket', '--language']);
for (let i = 2; i < process.argv.length; i += 2) {
  const [flag, value] = process.argv.slice(i, i + 2);
  if (!flags.has(flag) || !value || value.startsWith('--')) throw new Error('Expected a benchmark option and value: ' + flag);
  options[flag.slice(2)] = value;
}
const dataset = resolve(options.dataset ?? DATASET);
const revision = options.revision ?? DATASET_REVISION;
const modelPath = resolve(options.model ?? join(cache, 'model.json'));
const sampleReportPath = resolve(options.report ?? join(cache, 'benchmark.json'));
const { train } = await import('../src/model.mjs');
const worlds = loadWorlds();

function summarizeChecks(checks) {
  const counts = new Map();
  const invalid = checks.filter(check=>check.errors.length);
  for (const result of invalid) {
    for (const violation of result.errors) counts.set(violation, (counts.get(violation) ?? 0) + 1);
  }
  return { checked: checks.length, errors:invalid.length, invalid,
    violations: [...counts].map(([violation, count]) => ({ violation, count })) };
}

function summarize(training, heldOut) {
  const out = {
    trainingRows: training.length,
    heldOutRows: heldOut.length,
    heldOutGroups: new Set(heldOut.map(row => normalizeText(row.text))).size,
    heldOutUniqueTexts: new Set(heldOut.map(row => row.text)).size,
    parsed: 0, parsedNonempty: 0, exact: 0, fullWireMatch: 0, semanticWireMatch: 0,
    alternativeSemanticMatch: 0, rowsWithAlternatives: 0, ambiguousExactTexts: 0, actMoodMatch: 0,
    rowsWithValidReference: 0,
    semanticGoldWires: 0, semanticPredictedWires: 0, semanticMatchedWires: 0, statuses: {},
  };
  const goldByText = new Map();
  for (const row of heldOut) {
    if (!goldByText.has(row.text)) goldByText.set(row.text, new Set());
    for (const key of row.goldSemanticKeys) goldByText.get(row.text).add(key);
    out.rowsWithValidReference += Number(row.goldSemanticKeys.length>0);
    out.rowsWithAlternatives += Number(Boolean(row.prediction.alternatives?.length));
    for (const key of ['parsed', 'parsedNonempty', 'exact', 'fullWireMatch', 'semanticWireMatch', 'alternativeSemanticMatch', 'actMoodMatch']) {
      out[key] += Number(row[key]);
    }
    for (const key of ['semanticGoldWires', 'semanticPredictedWires', 'semanticMatchedWires']) out[key] += row[key];
    const status = row.prediction.status ?? '(missing)';
    out.statuses[status] = (out.statuses[status] ?? 0) + 1;
  }
  out.ambiguousExactTexts = [...goldByText.values()].filter(variants => variants.size > 1).length;
  const f1Denominator = out.semanticGoldWires + out.semanticPredictedWires;
  out.semanticWireF1 = f1Denominator ? 2 * out.semanticMatchedWires / f1Denominator : null;
  return out;
}

const corpus = loadCorpus({ dataset, revision });
const bucket = Number(options.bucket ?? 0);
const { training, heldOut } = splitCorpus(corpus.rows, bucket);
const trainingGroups = new Set(training.map(row => normalizeText(row.text)));
if (heldOut.some(row => trainingGroups.has(normalizeText(row.text)))) throw new Error('Normalized holdout leaked into training');
if (!training.length || !heldOut.length) throw new Error('Benchmark requires both training and held-out rows');
console.error('Training on %d rows, holding out %d rows', training.length, heldOut.length);
mkdirSync(cache, { recursive: true });
mkdirSync(dirname(modelPath), { recursive: true });
const trainAt = performance.now();
writeFileSync(modelPath, JSON.stringify(train(training)));
const trainingSeconds = (performance.now() - trainAt) / 1000;

const language=options.language ?? 'on';
if (!['on','off'].includes(language)) throw Error('Expected --language on or off');
const inputs = [...new Set(heldOut.map(row => row.text))];
const inferAt = performance.now();
const batch = execFileSync(process.execPath, [
  join(root, 'bin/formalise.mjs'), '--model', modelPath, '--pipeline', '--batch', ...(language==='off' ? ['--no-language-frames'] : []),
], {
  encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  input: inputs.map(text => JSON.stringify({ text })).join('\n') + '\n',
}).trim().split('\n').map(line => JSON.parse(line));
const inferenceSeconds = (performance.now() - inferAt) / 1000;
if (batch.length !== inputs.length) throw new Error('Expected one batch prediction per exact input');
const predictions = new Map(inputs.map((text, index) => [text, batch[index]]));
console.error('Checking held-out references and emitted predictions against native SOP schema, catalogue and evidence');
const scored = heldOut.map(row => {
  const prediction = predictions.get(row.text);
  if (prediction.error) throw new Error('Cannot formalise ' + row.source + ':' + row.row + ': ' + prediction.error);
  const referenceChecks=checkReferences(row,worlds);
  return {...row,prediction,referenceChecks,...scoreReferences({...row,referenceChecks},prediction)};
});

const checkerResults = {
  gold: summarizeChecks(scored.flatMap(({source,row,referenceChecks})=>
    referenceChecks.map(check=>({source,row,...check})))),
  predictions: summarizeChecks(scored
    .filter(({prediction})=>typeof prediction.sop==='string' && prediction.sop.trim())
    .map(({source,row,text,prediction})=>({source,row,...checkCircuit(text,prediction.sop,worlds)}))),
};

const report = {
  bucket, language, datasetRevision: corpus.revision,
  knowledgeRevision: readFileSync(join(cache, 'knowledge', 'REVISION'), 'utf8').trim(),
  trainingSeconds,
  inferenceSeconds,
  totals: summarize(training, scored),
  checker: checkerResults, requirements:measureRequirements(scored, worlds),
};
mkdirSync(dirname(sampleReportPath), { recursive: true });
writeFileSync(sampleReportPath, JSON.stringify(report, null, 2) + '\n');
if (options.details) writeFileSync(resolve(options.details), scored.map(({ goldSemanticKeys, ...row }) => JSON.stringify(row)).join('\n') + '\n');
console.log(JSON.stringify(report, null, 2));
