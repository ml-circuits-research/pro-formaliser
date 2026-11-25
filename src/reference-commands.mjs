import {tokens} from './lexicon.mjs';
import {politeBody} from './trailing-discourse.mjs';

const quote=JSON.stringify;
const values=(wire,key)=>(wire.attrs[key] ?? []).map(value=>value.startsWith('"') ? JSON.parse(value) : value);
const one=(wire,key)=>values(wire,key)[0];
const terms=text=>tokens(text).map(([key])=>key);
const objectCases=new Set(['object','demonstrative']);
const verbWord=/^[\p{L}\p{M}]+$/u;

export function compileReferenceCommands(facts,acts) {
  const enabled=new Set(facts('pro.reader.reference_command').map(wire=>one(wire,'act')).filter(act=>acts.has(act)));
  const references=new Set(facts('w.lang.en.pron').filter(wire=>
    values(wire,'case').some(role=>objectCases.has(role)) && values(wire,'refers').includes('thing') &&
    values(wire,'in').includes('acts')).flatMap(wire=>values(wire,'text').map(text=>terms(text).join(' '))));
  const verbs=new Map();
  function add(head,tail,act) {
    const key=quote([head.join(' '),tail.join(' ')]);
    const alternatives=verbs.get(key) ?? new Set();
    alternatives.add(act);
    verbs.set(key,alternatives);
  }
  for (const verb of facts('k.actions.verb')) {
    const act=one(verb,'act');
    if (!enabled.has(act) || one(verb,'object')!=='thing') continue;
    for (const text of values(verb,'text')) {
      const words=terms(text);
      if (!words.length || !words.every(word=>verbWord.test(word))) continue;
      add(words,[],act);
      // Native separability licenses an intervening object after the verb.
      if (words.length>1 && one(verb,'separable')==='true') add(words.slice(0,1),words.slice(1),act);
    }
  }
  return {verbs,references};
}

export function referenceCommandReadings(text,ts,worlds,politeness) {
  const {verbs,references}=worlds.referenceCommands;
  if (!verbs.size) return [];
  const body=politeBody(text,ts,politeness,2);
  if (!body) return [];
  const {start,end,fillers,phrase,span}=body;
  const readings=[];
  for (let first=start+1;first<end;first++) {
    for (let last=first+1;last<=end;last++) {
      if (!references.has(phrase(first,last))) continue;
      for (const act of verbs.get(quote([phrase(start,first),phrase(last,end)])) ?? []) {
        const predicate=span(start,last===end ? first : end);
        const sop=[
          '@r w.request.request act='+quote(act)+' mood=do refers=thing words='+quote(text)+' predicate='+quote(predicate),
          '@l w.request.lookup request=$r key=thing words='+quote(span(first,last)),
          ...fillers.map((words,i)=>'@f'+(i+1)+' w.request.filler text='+quote(words)),
        ].join('\n');
        readings.push({sop,source:'reference-command',status:'matched'});
      }
    }
  }
  return readings;
}
