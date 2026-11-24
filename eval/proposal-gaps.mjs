// Read aligned JSON Lines with {sample, grade, referenceIssue, reference, candidates}.
// Inspect annotation obligations only on reviewed incomplete, unflagged requests.
import { createInterface } from 'node:readline';
import { parse } from '../src/schema.mjs';
import { compareRequirements } from './requirements.mjs';

// Occurrence numbers distinguish two identical obligations in the same request.
const occurrences = items => {
  const counts = new Map();
  return items.map(item=>{
    const key = JSON.stringify(item);
    const occurrence = (counts.get(key) ?? 0) + 1;
    counts.set(key,occurrence);
    return [JSON.stringify([key,occurrence]),item.role];
  });
};

const groups = {together:0, distributed:0, absent:0};
const missingRoles = {};
for await (const line of createInterface({input:process.stdin,crlfDelay:Infinity})) {
  const {grade,referenceIssue,reference,candidates} = JSON.parse(line);
  if (!grade.startsWith('L2') || referenceIssue) continue;
  const gold = parse(reference);
  const required = compareRequirements(gold,[]).omitted;
  if (!required.length) continue;
  const anywhere = new Set();
  let together = false;
  for (const {sop} of candidates) {
    const {kept,omitted} = compareRequirements(gold,parse(sop));
    if (!omitted.length) together = true;
    for (const [key] of occurrences(kept)) anywhere.add(key);
  }
  const absent = occurrences(required).filter(([key])=>!anywhere.has(key));
  if (absent.length) {
    groups.absent++;
    for (const role of new Set(absent.map(([,role])=>role))) missingRoles[role]=(missingRoles[role] ?? 0)+1;
  } else if (together) groups.together++;
  else groups.distributed++;
}
console.log(JSON.stringify({groups,missingRoles},null,2));
