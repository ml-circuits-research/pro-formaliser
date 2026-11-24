// Compare annotation obligations in request order. Keep the arguments of a
// constraint together: assigning a value to the wrong key or phase is a miss.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { parse } from '../src/schema.mjs';
import { evidenceReport } from '../src/evidence.mjs';
import { loadWorlds } from '../src/worlds.mjs';

const decode=v=>v.startsWith('"') ? JSON.parse(v) : v;
const fields=(w,keys)=>Object.fromEntries(keys.filter(k=>w.attrs[k]).map(k=>[k,w.attrs[k].map(decode)]));
function obligations(wires) {
  const ids=new Map(wires.filter(w=>w.type==='w.request.request').map((w,i)=>['$'+w.id,i+1]));
  const result=[];
  for (const w of wires) {
    const type=w.type.split('.').at(-1);
    const request=ids.get(type==='request' ? '$'+w.id : w.attrs.request?.[0]);
    const add=(role,args)=>result.push({request,role,args});
    if (type==='request') add('action',fields(w,['act','mood','refers','asked']));
    if (type==='target') {
      add('target',fields(w,['family','mode']));
      for (const slot of ['name','sort','description','ids','count','ordinal','quantity','quantifier'])
        if (w.attrs[slot]) add('target_detail',fields(w,[slot]));
    }
    if (type==='constraint') {
      const args=fields(w,['on','attribute','operator','value','number','unit','min','max','want','of','relation','step','amount','measure','character']);
      if (!w.attrs.value && !w.attrs.number && w.attrs.words) args.words=w.attrs.words.map(decode);
      add(w.attrs.phase?.[0]==='selector' ? 'selector' : 'result',args);
    }
  }
  return result;
}

export function compareRequirements(gold,prediction) {
  const left=obligations(gold),right=obligations(prediction);
  const buckets=new Map();
  for (const item of right) {
    const k=JSON.stringify(item);
    if (!buckets.has(k)) buckets.set(k,[]);
    buckets.get(k).push(item);
  }
  const kept=[],omitted=[];
  for (const item of left) {
    const matches=buckets.get(JSON.stringify(item));
    if (matches?.length) kept.push(matches.pop());
    else omitted.push(item);
  }
  return {kept,omitted,added:[...buckets.values()].flat()};
}

export function measureRequirements(rows,worlds=loadWorlds()) {
  const counts={},evidence={};
  for (const row of rows) {
    const pred=row.prediction.sop ? parse(row.prediction.sop) : [];
    for (const [outcome,records] of Object.entries(compareRequirements(parse(row.sop),pred))) {
      for (const {role} of records) {
        counts[role] ??= {kept:0,omitted:0,added:0};
        counts[role][outcome]++;
      }
    }
    const report=evidenceReport(row.text,pred,worlds.evidenceVocabulary);
    for (const [status,n] of Object.entries(report.counts)) evidence[status]=(evidence[status]??0)+n;
  }
  return {roles:counts,sourceTokens:evidence};
}

if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  const [path,source,line]=process.argv.slice(2);
  const rows=readFileSync(path,'utf8').trim().split('\n').map(l=>JSON.parse(l));
  if (!source) console.log(JSON.stringify(measureRequirements(rows),null,2));
  else {
    const row=rows.find(r=>r.source===source && r.row===Number(line));
    if (!row) throw Error('No held-out row with that source and row number');
    console.log(JSON.stringify({text:row.text,...compareRequirements(parse(row.sop),parse(row.prediction.sop))},null,2));
  }
}
