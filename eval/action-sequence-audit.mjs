import {readFileSync} from 'node:fs';
import {parse,str} from '../.cache/knowledge/tools/sopworld/sopworld.mjs';

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
  const slots=[], facts=[];
  const fields=(wire,keys)=>keys.map(key=>(wire.attrs[key] ?? []).map(str));
  for (const [index,request] of requests.entries()) {
    for (const w of wires.filter(w=>w.attrs.request?.includes('$'+request.id))) {
      if (!['w.request.target','w.request.constraint'].includes(w.type)) continue;
      const keys=w.type==='w.request.target' ? ['family','mode'] : ['on','attribute','phase','operator'];
      const shape=[index,w.type,...fields(w,keys)];
      slots.push(JSON.stringify(shape));
      const values=w.type==='w.request.target' ? ['sort','name','ids','count','quantity','description'] :
        ['value','unit','measure','step','want'];
      facts.push(JSON.stringify([...shape,...fields(w,values)]));
    }
  }
  return {acts:requests.map(w=>str(w.attrs.act?.[0])).join(' '), slots:slots.sort().join('\n'), facts};
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
  const count = counts.get(group) ?? {total:0,reasonable:0,incomplete:0,matchedActsIncomplete:0,matchedSlotsIncomplete:0,matchedActsWrong:0,poolAddsCoverage:0};
  count.total++;
  if (['L3','L4'].includes(get('grade'))) count.reasonable++;
  else if (get('grade').startsWith('L2')) {
    count.incomplete++;
    if (alternatives.includes(expected)) count.matchedActsIncomplete++;
    if (programs.some(p=>p.acts===expected && p.slots===gold.slots)) count.matchedSlotsIncomplete++;
    // Optimistic test: even incompatible participants and extra wrong facts are
    // allowed. This bounds a literal recombination of those exact facts only.
    const eligible=programs.filter(p=>p.acts===expected);
    const union=new Set(eligible.flatMap(p=>p.facts));
    if (gold.facts.length && gold.facts.every(f=>union.has(f)) &&
        !eligible.some(p=>gold.facts.every(f=>p.facts.includes(f)))) count.poolAddsCoverage++;
  } else if (alternatives.includes(expected)) count.matchedActsWrong++;
  counts.set(group,count);
}
console.log(JSON.stringify(Object.fromEntries(counts),null,2));
