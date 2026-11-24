#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { parseArgs } from 'node:util';
import { createEstimator } from '../src/estimate.mjs';

const {values} = parseArgs({options:{batch:{type:'boolean'}}});
const estimator = createEstimator();
async function run(json) {
  const {candidates,context} = JSON.parse(json);
  console.log(JSON.stringify(await estimator.estimate(candidates,context)));
}
try {
  if (values.batch) {
    for await (const line of createInterface({input:process.stdin,crlfDelay:Infinity})) if (line.trim()) await run(line);
  } else await run(readFileSync(0,'utf8'));
} finally { await estimator.close(); }
