#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { spellcheck } from '../src/spell.mjs';
import { createReader } from '../src/runtime.mjs';

const {values,positionals} = parseArgs({allowPositionals:true, options:{
  'worlds-only':{type:'boolean'},tab:{type:'string'},model:{type:'string',default:'.cache/model.json'},batch:{type:'boolean'},spell:{type:'boolean'},json:{type:'boolean'}
}});
if (!values.batch && !positionals.length) throw Error('Usage: node bin/formalise.mjs [--model FILE] [--json] [--spell] "text" or --batch');
const reader = createReader(values['worlds-only'] ? undefined : JSON.parse(readFileSync(values.model,'utf8')));
async function formalise(text, tab = values.tab) {
  if (!values.spell) return reader.formalise(text,{tab});
  const spelling = spellcheck(text);
  return {...await reader.formalise(spelling.text,{tab}),original:text,spelling};
}
try {
  if (values.batch) {
    for await (const line of createInterface({input:process.stdin,crlfDelay:Infinity})) {
      if (!line.trim()) continue;
      const {text,tab} = JSON.parse(line);
      console.log(JSON.stringify(await formalise(text,tab)));
    }
  } else {
    const result = await formalise(positionals.join(' '));
    console.log(values.json || !result.sop ? JSON.stringify(result,null,2) : result.sop);
  }
} finally {
  await reader.close();
}
