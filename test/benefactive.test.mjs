import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { parse } from '../src/schema.mjs';
import { createReader } from '../src/runtime.mjs';
import { loadWorlds } from '../src/worlds.mjs';

const pilot=name=>fileURLToPath(new URL('../sop-worlds/'+name+'/',import.meta.url));
const value=(wire,key)=>{
  const field=wire?.attrs[key]?.[0];
  return field?.startsWith('"') ? JSON.parse(field) : field;
};
const readings=result=>result.candidates.filter(c=>c.source==='benefactive');

test('preserves written beneficiary on a typed chart request and keeps the prior readings',async t=>{
  const chart=pilot('chart-predicate-pilot');
  const reader=createReader(undefined,loadWorlds({paths:[pilot('benefactive-pilot'),pilot('w.relational'),chart]}));
  const baseline=createReader(undefined,loadWorlds({paths:[pilot('w.relational'),chart]}));
  t.after(()=>Promise.all([reader.close(),baseline.close()]));
  for (const [text,name,kind] of [
    ['Build me weekly totals of orders as a line chart','me','pronoun'],
    ['Draw Ana a bar chart of donations by province, only provinces above 740.','Ana','name'],
    ['Draw a bar chart of donations by province, only provinces above 740 for Maya.','Maya','name'],
  ]) {
    const old=await baseline.propose(text);
    const next=await reader.propose(text,{evidence:true});
    assert.equal(readings(old).length,0,text);
    assert.ok(old.candidates.every(c=>next.candidates.some(n=>n.sop===c.sop)),text);
    assert.ok(readings(next).some(c=>{
      const wires=parse(c.sop);
      const req=wires.find(w=>w.type==='w.request.request');
      const recipient=wires.find(w=>w.type==='w.relational.beneficiary');
      const owned=wires.filter(w=>value(w,'request')==='$'+req.id);
      const chart=owned.find(w=>w.type==='w.request.target');
      const field=(key,want)=>owned.some(w=>value(w,'attribute')==='chart.'+key && value(w,'value')===want);
      return owned.includes(recipient) && value(recipient,'kind')===kind && value(recipient,'words')===name && value(recipient,'value')===name &&
        value(req,'act')==='make' && value(req,'words')===text && value(chart,'family')==='chart' &&
        value(chart,'mode')==='new' && c.evidence.missing.length===0 &&
        (name==='me' ? field('measure','orders') && field('period','week') && field('aggregate','sum') :
          field('measure','donations') && field('dimension','province') && field('filterThreshold','740'));
    }),text);
  }
});

test('uses a grounded creation target and keeps ambiguous names, portraits and transfers outside beneficiary readings',async t=>{
  const reader=createReader(undefined,loadWorlds({paths:[pilot('benefactive-pilot'),pilot('w.relational'),pilot('drawable-inventory-pilot')]}));
  t.after(()=>reader.close());
  for (const [text,words] of [
    ['Draw me a sheep','me'],
    ['Draw them a sheep','them'],
    ['Draw a sheep for Ana.','Ana'],
    ['Draw May a sheep','May'],
  ]) {
    const next=await reader.propose(text,{evidence:true});
    assert.ok(readings(next).some(c=>{
      const wires=parse(c.sop);
      const target=wires.find(w=>w.type==='w.request.target');
      const beneficiary=wires.find(w=>w.type==='w.relational.beneficiary');
      return value(target,'sort')==='sheep' && value(target,'mode')==='new' &&
        value(beneficiary,'request')===value(target,'request') && value(beneficiary,'words')===words &&
        c.evidence.missing.length===0;
    }),text);
  }
  for (const text of ['Draw me smiling', 'Draw me', 'Do not draw me a sheep',
    'Draw me a sheep for Ana', 'Draw a sheep for 10 minutes', 'Draw a sheep for May',
    'Send me a sheep', 'Draw Qzxyz a sheep', 'Draw Ana a sheep; delete it']) {
    assert.deepEqual(readings(await reader.propose(text)),[],text);
  }
});
