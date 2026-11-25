#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { readFile } from 'node:fs/promises';
import { once } from 'node:events';
import { createInterface } from 'node:readline';
import { createReader, openRuntime, readerError } from '../src/reader.mjs';

const {values,positionals}=parseArgs({allowPositionals:true,options:{
  pipeline:{type:'boolean'},'worlds-only':{type:'boolean'},'no-language-frames':{type:'boolean'},
  evidence:{type:'boolean'},context:{type:'string'},tab:{type:'string'},model:{type:'string'},
  batch:{type:'boolean'},spell:{type:'boolean'},json:{type:'boolean'},
}});
if (!values.batch && !positionals.length) throw Error('Usage: node bin/formalise.mjs [--model FILE] [--json] [--context FILE] [--spell] "text" or --batch');

const configuration={modelPath:values.model,worldsOnly:values['worlds-only'],languageFrames:!values['no-language-frames']};
const options={evidence:values.evidence,spell:values.spell};
const pipeline=Boolean(values.pipeline || values.tab!==undefined || values.context!==undefined);

if (values.batch) {
  if (values.context!==undefined) throw Error('Batch input accepts current text only');
  let reader, initializationError;
  try {
    reader=await (pipeline ? openRuntime(configuration) : createReader({...configuration,...options}));
  } catch (error) {
    initializationError=error;
  }
  try {
    for await (const line of createInterface({input:process.stdin,crlfDelay:Infinity})) {
      if (!line.trim()) continue;
      let text, result;
      try {
        const record=JSON.parse(line);
        text=record?.text;
        if (!record || typeof record!=='object' || Array.isArray(record) || typeof text!=='string') {
          throw new TypeError('Expected a JSON object with a string text field');
        }
        if (Object.keys(record).some(key=>key!=='text' && !(pipeline && key==='tab'))) {
          throw new TypeError('Batch input accepts current text only');
        }
        if (initializationError) throw initializationError;
        result=pipeline ? await reader.formalise(text,{...options,tab:record.tab ?? values.tab}) : await reader.propose(text);
      } catch (error) {
        result=readerError(text,error);
      }
      if (!process.stdout.write(JSON.stringify(result)+'\n')) await once(process.stdout,'drain');
    }
  } finally {
    await reader?.close();
  }
} else {
  const reader=await openRuntime(configuration);
  try {
    const text=positionals.join(' ');
    const context=values.context===undefined ? undefined : JSON.parse(await readFile(values.context,'utf8'));
    const result=pipeline ? await reader.formalise(text,{...options,tab:values.tab,context}) : await reader.propose(text,options);
    console.log(values.json || values.evidence || !result.sop ? JSON.stringify(result,null,2) : result.sop);
  } finally {
    await reader.close();
  }
}
