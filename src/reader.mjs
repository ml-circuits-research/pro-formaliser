import { readFile } from 'node:fs/promises';
import { createReader as createRuntimeReader } from './runtime.mjs';
import { parse } from './schema.mjs';

const defaultModel=new URL('../.cache/model.json',import.meta.url);
const field=(wire,key)=>{
  const raw=wire.attrs[key]?.[0];
  return raw?.startsWith('"') ? JSON.parse(raw) : raw;
};

export async function openRuntime({modelPath=defaultModel,worldsOnly=false,languageFrames=true}={}) {
  const model=worldsOnly ? undefined : JSON.parse(await readFile(modelPath,'utf8'));
  return createRuntimeReader(model,undefined,{languageFrames});
}

export function readerError(text,error) {
  return {engine:'prolog',text:typeof text==='string' ? text : null,candidates:[],unresolved:[],
    error:error instanceof Error ? error.message : String(error)};
}

export async function createReader({evidence=false,spell=false,...configuration}={}) {
  const runtime=await openRuntime(configuration);
  return {
    async propose(text) {
      try {
        if (typeof text!=='string') throw new TypeError('Expected text to be a string');
        const result=await runtime.propose(text,{evidence,spell});
        const unresolved=result.candidates.flatMap(({sop},candidate)=>parse(sop).flatMap(wire=>
          wire.type==='w.request.unread' ? [{candidate,text:field(wire,'text'),note:field(wire,'note')}] : []));
        if (!result.candidates.length && result.unread!==undefined) unresolved.push({text:result.unread});
        return {...result,engine:'prolog',text,unresolved,error:null};
      } catch (error) {
        return readerError(text,error);
      }
    },
    async close() { await runtime.close(); },
  };
}
