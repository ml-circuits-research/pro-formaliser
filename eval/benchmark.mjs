import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DATASET, DATASET_REVISION, loadCorpus, normalizeText, splitCorpus } from '../src/corpus.mjs';
import { measureRequirements } from './requirements.mjs';
import { intersectCount, signatures } from './signatures.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const cache = join(root, '.cache');
const options = {};
const flags = new Set(['--dataset', '--knowledge', '--revision', '--model', '--report', '--details', '--bucket', '--context', '--language']);
for (let i = 2; i < process.argv.length; i += 2) {
  const [flag, value] = process.argv.slice(i, i + 2);
  if (!flags.has(flag) || !value || value.startsWith('--')) throw new Error('Expected a benchmark option and value: ' + flag);
  options[flag.slice(2)] = value;
}
const dataset = resolve(options.dataset ?? DATASET);
const knowledge = resolve(options.knowledge ?? join(cache, 'knowledge'));
const revision = options.revision ?? DATASET_REVISION;
const modelPath = resolve(options.model ?? join(cache, 'model.json'));
const sampleReportPath = resolve(options.report ?? join(cache, 'benchmark.json'));
const { parse } = await import(pathToFileURL(join(knowledge, 'tools/sopworld/sopworld.mjs')));
const { train } = await import('../src/model.mjs');

const parseCircuit = sop => {
  try {
    return typeof sop === 'string' ? parse(sop) : null;
  } catch {
    return null;
  }
};
const escCsv = value => '"' + String(value).replaceAll('"', '""') + '"';
const toCsv = rows => 'text,sop\n' + rows.map(row => [row.text, row.sop].map(escCsv).join(',')).join('\n') + '\n';

function checkCircuits(checker, temp, label, rows) {
  const directory = join(temp, label);
  for (const [family, group] of Object.entries(Object.groupBy(rows, row => row.family))) {
    mkdirSync(join(directory, family), { recursive: true });
    writeFileSync(join(directory, family, 'held-out.csv'), toCsv(group));
  }
  const out = join(temp, label + '.json');
  const result = spawnSync(process.execPath, [
    checker, '--knowledge', knowledge, '--dataset', directory, '--json', out,
  ], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (result.error || ![0, 1].includes(result.status)) throw result.error ?? new Error(result.stderr);
  const records = JSON.parse(readFileSync(out, 'utf8'));
  if (records.total !== rows.length) throw new Error('Checker row count mismatch for ' + label);
  const warningCount = Number(/warnings \(rows[^)]+\): (\d+) rows/.exec(result.stdout)?.[1] ?? 0);
  const warnings = result.stdout.split(/warnings \(rows[^)]+\): \d+ rows/)[1] ?? '';
  const warningCategories = Object.fromEntries([...warnings.matchAll(/^(\d+)\t(.+)$/gm)].map(([,n,key])=>[key,Number(n)]));
  return { checked: records.total, errors: records.bad, warningCircuits: warningCount, warningCategories,
    violations: records.groups.map(({ violation, n }) => ({ violation, count: n })) };
}

function summarize(training, heldOut) {
  const out = {
    trainingRows: training.length,
    heldOutRows: heldOut.length,
    heldOutGroups: new Set(heldOut.map(row => normalizeText(row.text))).size,
    heldOutUniqueTexts: new Set(heldOut.map(row => row.text)).size,
    parsed: 0, parsedNonempty: 0, exact: 0, fullWireMatch: 0, semanticWireMatch: 0,
    alternativeSemanticMatch: 0, rowsWithAlternatives: 0, ambiguousExactTexts: 0, actMoodMatch: 0,
    semanticGoldWires: 0, semanticPredictedWires: 0, semanticMatchedWires: 0, statuses: {},
  };
  const goldByText = new Map();
  for (const row of heldOut) {
    if (!goldByText.has(row.text)) goldByText.set(row.text, new Set());
    goldByText.get(row.text).add(row.goldSemanticKey);
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

const context = options.context ?? 'text';
const language=options.language ?? 'on';
if (!['on','off'].includes(language)) throw Error('Expected --language on or off');
if (!['text','tab'].includes(context)) throw Error('Expected --context text or tab');
const query = row => JSON.stringify(context === 'tab' ? {text:row.text,tab:row.family} : {text:row.text});
const inputs = [...new Set(heldOut.map(query))];
const inferAt = performance.now();
const batch = execFileSync(process.execPath, [
  join(root, 'bin/formalise.mjs'), '--model', modelPath, '--batch', ...(language==='off' ? ['--no-language-frames'] : []),
], {
  cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  input: inputs.join('\n') + '\n',
}).trim().split('\n').map(line => JSON.parse(line));
const inferenceSeconds = (performance.now() - inferAt) / 1000;
if (batch.length !== inputs.length) throw new Error('Expected one batch prediction per exact input');
const predictions = new Map(inputs.map((text, index) => [text, batch[index]]));
const actMood = wires => JSON.stringify(wires.filter(w => w.type === 'w.request.request')
  .map(w => [w.attrs.act, w.attrs.mood]));
const clean = sop => sop.trim().replaceAll('\r\n', '\n');
const scored = heldOut.map(row => {
  const prediction = predictions.get(query(row));
  const gold = parseCircuit(row.sop);
  if (!gold) throw new Error('Cannot parse gold ' + row.source + ':' + row.row);
  const wires = parseCircuit(prediction.sop);
  const goldSemantic = signatures(gold, true);
  const predictedSemantic = wires ? signatures(wires, true) : [];
  const common = intersectCount(goldSemantic, predictedSemantic);
  const semanticWireMatch = wires !== null && common === goldSemantic.length && common === predictedSemantic.length;
  const alternativeSemanticMatch = !semanticWireMatch && (prediction.alternatives ?? []).some(alternative => {
    const parsedAlternative = parseCircuit(alternative.sop);
    if (!parsedAlternative) return false;
    const candidate = signatures(parsedAlternative, true);
    return candidate.length === goldSemantic.length && intersectCount(candidate, goldSemantic) === goldSemantic.length;
  });
  return {
    ...row, prediction, goldSemanticKey: JSON.stringify(goldSemantic),
    parsed: wires !== null,
    parsedNonempty: Boolean(wires?.length),
    exact: wires !== null && clean(prediction.sop) === clean(row.sop),
    fullWireMatch: wires !== null && JSON.stringify(signatures(wires)) === JSON.stringify(signatures(gold)),
    semanticWireMatch,
    alternativeSemanticMatch,
    actMoodMatch: wires !== null && actMood(wires) === actMood(gold),
    semanticGoldWires: goldSemantic.length,
    semanticPredictedWires: predictedSemantic.length,
    semanticMatchedWires: common,
  };
});

const tmp = mkdtempSync(join(cache, 'checker-'));
let checkerResults;
try {
  const checker = join(tmp, 'check.mjs');
  writeFileSync(checker, execFileSync('git', ['-C', dataset, 'show', corpus.revision + ':tools/check.mjs']));
  console.error('Checking held-out gold and emitted predictions against WebMeet schema and evidence rules');
  checkerResults = {
    gold: checkCircuits(checker, tmp, 'gold', scored),
    predictions: checkCircuits(checker, tmp, 'predictions', scored
      .filter(row => typeof row.prediction.sop === 'string' && row.prediction.sop.trim())
      .map(row => ({ ...row, sop: row.prediction.sop }))),
  };
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

const report = {
  bucket, context, language, datasetRevision: corpus.revision,
  knowledgeRevision: options.knowledge
    ? execFileSync('git', ['-C', knowledge, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
    : readFileSync(join(knowledge, 'REVISION'), 'utf8').trim(),
  trainingSeconds,
  inferenceSeconds,
  totals: summarize(training, scored),
  families: Object.fromEntries(Object.entries(Object.groupBy(scored, row => row.family))
    .map(([family, group]) => [family, summarize(training.filter(row => row.family === family), group)])),
  checker: checkerResults, requirements:measureRequirements(scored),
};
mkdirSync(dirname(sampleReportPath), { recursive: true });
writeFileSync(sampleReportPath, JSON.stringify(report, null, 2) + '\n');
if (options.details) writeFileSync(resolve(options.details), scored.map(({ goldSemanticKey, ...row }) => JSON.stringify(row)).join('\n') + '\n');
console.log(JSON.stringify(report, null, 2));
