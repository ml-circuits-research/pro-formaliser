#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { createReader } from '../src/runtime.mjs';

const {values,positionals} = parseArgs({allowPositionals:true, options:{
  pipeline:{type:'boolean'},'worlds-only':{type:'boolean'},'no-language-frames':{type:'boolean'},evidence:{type:'boolean'},context:{type:'string'},tab:{type:'string'},model:{type:'string',default:'.cache/model.json'},batch:{type:'boolean'},spell:{type:'boolean'},json:{type:'boolean'}
}});
if (!values.batch && !positionals.length) throw Error('Usage: node bin/formalise.mjs [--model FILE] [--json] [--context FILE] [--spell] "text" or --batch');
const reader = createReader(values['worlds-only'] ? undefined : JSON.parse(readFileSync(values.model,'utf8')),undefined,{languageFrames:!values['no-language-frames']});
const defaultContext = values.context ? JSON.parse(readFileSync(values.context,'utf8')) : undefined;
async function formalise(text, tab = values.tab, context = defaultContext) {
  const options={evidence:values.evidence,spell:values.spell};
  if (!values.pipeline && tab===undefined && context===undefined) return reader.propose(text,options);
  return reader.formalise(text,{...options,tab,context});
}
try {
  if (values.batch) {
    for await (const line of createInterface({input:process.stdin,crlfDelay:Infinity})) {
      if (!line.trim()) continue;
      const {text,tab,context} = JSON.parse(line);
      console.log(JSON.stringify(await formalise(text,tab,context)));
    }
  } else {
    const result = await formalise(positionals.join(' '));
    console.log(values.json || values.evidence || !result.sop ? JSON.stringify(result,null,2) : result.sop);
  }
} finally {
  await reader.close();
}
