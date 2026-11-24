import { observeMeaning, supportedMeaning } from './training-evidence.mjs';
import { literalRanges } from './evidence.mjs';
import { consumeUnread } from './nominal-evidence.mjs';
import { parse, serialize } from '../.cache/knowledge/tools/sopworld/sopworld.mjs';
import { tokens } from './lexicon.mjs';

const raw=(w,k)=>w.attrs[k]?.[0];
const field=(w,k)=>raw(w,k)?.startsWith('"') ? JSON.parse(raw(w,k)) : raw(w,k);
const noun=t=>field(t,'sort_words') ?? field(t,'sort') ?? field(t,'family_words');
const norm=s=>s?.trim().toLowerCase();

export function modifierLearner(worlds) {
  const properties=new Map(worlds.requestKeys.map(k=>[JSON.stringify([k.family,k.name]),k]));
  const entries=new Map();
  return {
    observe(text,target,constraint) {
      const head=noun(target),family=field(target,'family'),key=field(constraint,'attribute');
      const value=field(constraint,'value'), surface=field(constraint,'words') ?? value;
      const property=properties.get(JSON.stringify([family,key]));
      if (!head || !value || !surface || !property?.head.split('+').some(h=>h==='class' || h==='candidate') ||
          constraint.attrs.value.length!==1 || constraint.attrs.want || constraint.attrs.key_words ||
          !/^[\p{L}]+$/u.test(surface) || !literalRanges(norm(text),norm(surface)+' '+norm(head)).length) return;
      if (property.values.length && !property.values.includes(value)) return;
      const id=JSON.stringify([family,norm(surface)]);
      const interpretation=JSON.stringify([key,value]);
      const witnesses=entries.get(id) ?? new Map();
      entries.set(id,witnesses);
      observeMeaning(witnesses,text,interpretation);
    },
    finish() {
      const forms={};
      for (const [id,witnesses] of entries) {
        const meaning=supportedMeaning(witnesses);
        if (meaning) forms[id]=JSON.parse(meaning);
      }
      return forms;
    }
  };
}

export function modifierReading(text,ts,quotes,candidate,forms) {
  const wires=parse(candidate.sop);
  const targets=wires.filter(w=>w.type==='w.request.target');
  const requests=wires.filter(w=>w.type==='w.request.request');
  if (targets.length!==1 || requests.length!==1) return;
  const [target]=targets;
  const family=field(target,'family'), head=noun(target);
  if (!head || !family) return;
  const keys=tokens(head).map(t=>t[0]);
  const positions=ts.flatMap((_,i)=>keys.every((key,j)=>ts[i+j]?.[0]===key) ? [i] : []);
  if (positions.length!==1) return;
  const used=new Set(wires.map(w=>w.id));
  const added=[];
  const taken=new Set(wires.filter(w=>w.type==='w.request.constraint').map(w=>field(w,'attribute')));
  const request=field(target,'request'),mode=field(target,'mode');
  if (!['new','existing'].includes(mode) || request!=='$'+requests[0].id) return;
  let start=positions[0];
  for (;start>0;start--) {
    const [lower,surface,from,to]=ts[start-1];
    const form=forms[JSON.stringify([family,lower])];
    if (!form || quotes.some(q=>from>=q.start && to<=q.end)) break;
    const [key,value]=form;
    if (taken.has(key)) break;
    const idBase=target.id+'.adj';
    let id=idBase;
    for (let i=2;used.has(id);i++) id=idBase+i;
    used.add(id);taken.add(key);
    const phase=mode==='new' ? 'result' : 'selector';
    added.push({id,type:'w.request.constraint',attrs:{
      request:[request],on:['attribute'],attribute:[key],value:[/^[a-z][a-z_]*$/u.test(value) ? value : JSON.stringify(value)],
      ...(surface!==value ? {words:[JSON.stringify(surface)]} : {}),operator:['eq'],phase:[phase]
    }});
  }
  if (!added.length) return;
  const chars=Array.from(text);
  const left=chars.slice(0,ts[start][2]).join('').length;
  const right=chars.slice(0,ts[positions[0]-1][3]).join('').length;
  return {sop:serialize([...consumeUnread(wires,text,left,right),...added]),source:'nominal-modifier',status:'partial'};
}
