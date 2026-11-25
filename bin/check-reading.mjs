#!/usr/bin/env node
import {readFileSync} from 'node:fs';
import {loadWorlds} from '../src/worlds.mjs';
import {parse,validate} from '../src/schema.mjs';
import {tokens} from '../src/lexicon.mjs';
import {quotedSpans} from '../src/literal-roles.mjs';
import {quotedPredicates} from '../src/predicate-scope.mjs';
import {frameSupport} from '../src/language-frames.mjs';
import {evidenceReport} from '../src/evidence.mjs';
import {catalogIssues} from '../src/catalog.mjs';
import {evidenceInText} from '../src/grounding.mjs';
import {prologWorker} from '../src/prolog-worker.mjs';

const record=JSON.parse(readFileSync(0,'utf8'));
const {text,sop}=record ?? {};
if (typeof text!=='string' || typeof sop!=='string' || Object.keys(record).some(key=>key!=='text' && key!=='sop')) {
  throw Error('Expected a JSON object with only text and sop strings');
}
const worlds=loadWorlds(),ts=tokens(text);
let wires;
try { wires=parse(sop); } catch (error) {
  console.log(JSON.stringify({schemaValid:false,parseError:error.message},null,2));
  process.exit(0);
}
const worker=prologWorker(new URL('../prolog/formalise.pl',import.meta.url));
try {
  const proofs=await worker.request({languageOnly:worlds.languageFrames.prepare(ts,quotedSpans(text),worlds)});
  console.log(JSON.stringify({schemaValid:validate(sop,worlds),literalEvidenceValid:evidenceInText(text,sop,worlds),
    evidence:evidenceReport(text,wires,worlds.evidenceVocabulary),catalogIssues:catalogIssues(wires,worlds),
    quoteConflicts:quotedPredicates(text,wires),language:frameSupport(wires,proofs,ts,text,worlds) ?? null},null,2));
} finally { await worker.close(); }
