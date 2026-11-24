// Compare reference-delimited clauses with the same reader on entire requests.
// Each input row contains {sample, text, reference, grade, referenceIssue, candidates}.
import { createInterface } from 'node:readline';
import { readFileSync } from 'node:fs';
import { createReader } from '../src/runtime.mjs';
import { parse } from '../src/schema.mjs';
import { compareRequirements } from './requirements.mjs';

const path=process.argv[2];
if (!path) throw Error('Pass the frozen model path and aligned JSON Lines on stdin.');
const reader=createReader(JSON.parse(readFileSync(path,'utf8')));
const field=(wire,key)=>{
  const raw=wire.attrs[key]?.[0];
  return raw?.startsWith('"') ? JSON.parse(raw) : raw;
};
const requests=wires=>wires.filter(w=>w.type==='w.request.request');
const owned=(wires,request)=>[request,...wires.filter(w=>field(w,'request')==='$'+request.id)];
const covers=(reference,prediction)=>compareRequirements(reference,prediction).omitted.length===0;
const totals={requests:0,clauses:0,missingInBoth:0,recoveredInIsolation:0,lostInIsolation:0,presentInBoth:0,requestsWithAllPartsAvailableAfter:0};
try {
  for await (const line of createInterface({input:process.stdin,crlfDelay:Infinity})) {
    const {text,sample,grade,reference,referenceIssue,candidates}=JSON.parse(line);
    if (referenceIssue || !/^L[12]/u.test(grade)) continue;
    const gold=parse(reference), actions=requests(gold);
    if (actions.length<2) continue;
    const scopes=actions.map(r=>field(r,'words'));
    let previousEnd=0;
    if (!scopes.every(words=>{
      if (!words) return false;
      const start=text.indexOf(words);
      if (start<previousEnd || text.indexOf(words,start+1)!==-1) return false;
      previousEnd=start+words.length;
      return true;
    })) continue;
    const whole=candidates.flatMap(({sop})=>{
      const wires=parse(sop);
      return requests(wires).map(request=>owned(wires,request));
    });
    const clauses=[];
    for (const [i,request] of actions.entries()) {
      const expected=owned(gold,request);
      const before=whole.some(part=>covers(expected,part));
      const isolated=await reader.propose(scopes[i]);
      const after=isolated.candidates.some(({sop})=>{
        const wires=parse(sop);
        return requests(wires).length===1 && covers(expected,wires);
      });
      clauses.push({words:scopes[i],before,after});
      if (before && after) totals.presentInBoth++;
      else if (after) totals.recoveredInIsolation++;
      else if (before) totals.lostInIsolation++;
      else totals.missingInBoth++;
    }
    totals.requests++;
    totals.clauses+=clauses.length;
    if (clauses.every(c=>c.before || c.after) && clauses.some(c=>!c.before)) totals.requestsWithAllPartsAvailableAfter++;
    console.log(JSON.stringify({sample,clauses}));
  }
  console.log(JSON.stringify({totals}));
} finally {
  await reader.close();
}
