import {readFileSync} from 'node:fs';
import {parse} from '../src/schema.mjs';

const [benchmarkFile, batchFile, gradeFile] = process.argv.slice(2);
if (!gradeFile) throw Error('Usage: node eval/action-sequence-audit.mjs benchmark.jsonl batch.jsonl THOUSAND-GRADES.tsv');
const lines = file => readFileSync(file,'utf8').trimEnd().split('\n');
const jsonLines = file => lines(file).map(line => JSON.parse(line));
const reference = new Map(jsonLines(benchmarkFile).map(row => [row.source+':'+row.row,row]));
const predictions = jsonLines(batchFile);
const [header,...grades] = lines(gradeFile);
const columns = header.split('\t');
if (grades.length !== predictions.length) throw Error('Mismatched sample lengths');
const counts = new Map();
function program(sop) {
  const wires = parse(sop ?? '');
  const requests = wires.filter(w => w.type === 'w.request.request');
  const slots = requests.flatMap((request,index) => wires.filter(w =>
    w.attrs.request?.includes('$'+request.id) && ['w.request.target','w.request.constraint'].includes(w.type)
  ).map(w => JSON.stringify([index,w.type,...(w.type === 'w.request.target' ?
    [w.attrs.family,w.attrs.mode] : [w.attrs.on,w.attrs.attribute,w.attrs.phase,w.attrs.operator])])));
  return {acts:requests.map(w => w.attrs.act?.[0]).join(' '), slots:slots.sort().join('\n')};
}
for (const [i,line] of grades.entries()) {
  const fields = line.split('\t');
  const get = key => fields[columns.indexOf(key)];
  if (Number(get('sample')) !== i+1) throw Error('Batch and grade order must match the documented sample');
  const row = reference.get(get('source')+':'+get('row'));
  if (!row) throw Error('Reference missing for sample '+get('sample'));
  const gold = program(row.sop);
  const expected = gold.acts;
  const candidate = predictions[i];
  const programs = [candidate,...candidate.alternatives].map(result=>program(result.sop));
  const alternatives = programs.map(p=>p.acts);
  const group = expected === '' ? 'no action' : expected.includes(' ') ? 'multiple actions' : 'single action';
  const count = counts.get(group) ?? {total:0,reasonable:0,incomplete:0,matchedActsIncomplete:0,matchedSlotsIncomplete:0,matchedActsWrong:0};
  count.total++;
  if (['L3','L4'].includes(get('grade'))) count.reasonable++;
  else if (get('grade').startsWith('L2')) {
    count.incomplete++;
    if (alternatives.includes(expected)) count.matchedActsIncomplete++;
    if (programs.some(p=>p.acts===expected && p.slots===gold.slots)) count.matchedSlotsIncomplete++;
  } else if (alternatives.includes(expected)) count.matchedActsWrong++;
  counts.set(group,count);
}
console.log(JSON.stringify(Object.fromEntries(counts),null,2));
