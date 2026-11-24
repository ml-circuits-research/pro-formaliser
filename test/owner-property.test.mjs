import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, validate } from '../src/schema.mjs';
import { evidenceInText } from '../src/grounding.mjs';
import { ownerPropertyReadings } from '../src/owner-property.mjs';
import { quotedSpans } from '../src/literal-roles.mjs';
import { tokens } from '../src/lexicon.mjs';
import { loadWorlds } from '../src/worlds.mjs';
import { createReader } from '../src/runtime.mjs';

const worlds=loadWorlds();
const read=(text,configured=worlds)=>ownerPropertyReadings(text,tokens(text),quotedSpans(text),configured);
const field=(wire,name)=>{
  const value=wire?.attrs[name]?.[0];
  return value?.startsWith('"') ? JSON.parse(value) : value;
};
function check(text,candidate,configured,description,attribute,value,keyWords,valueWords=value) {
  assert.ok(candidate,text);
  const {sop}=candidate;
  assert.ok(validate(sop,configured),sop);
  assert.ok(evidenceInText(text,sop,configured),sop);
  const wires=parse(sop);
  const target=wires.find(w=>w.type==='w.request.target'), constraint=wires.find(w=>w.type==='w.request.constraint');
  assert.equal(field(target,'mode'),'existing');
  assert.equal(field(target,'description'),description);
  assert.equal(field(constraint,'attribute'),attribute);
  assert.equal(field(constraint,'value'),value);
  assert.equal(field(constraint,'key_words'),keyWords);
  assert.equal(field(constraint,'words'),valueWords);
  assert.equal(field(constraint,'phase'),'result');
}

test('reads open and closed properties of described owners with native action and connector licensing', async () => {
  const cases=[
    ['Could you set the y axis title on the regional revenue chart to Headcount?',
      'the regional revenue chart','chart.yLabel','Headcount','y axis title'],
    ['Change the title of this regional revenue chart to “Orders to review”',
      'this regional revenue chart','chart.title','Orders to review','title'],
    ['Set the title weight on the annual chart to BOLD',
      'the annual chart','chart.titleWeight','bold','title weight','BOLD']
  ];
  const reader=createReader(undefined,worlds);
  try {
    for (const [text,...expected] of cases) {
      check(text,read(text)[0],worlds,...expected);
      const {candidates}=await reader.propose(text);
      check(text,candidates.find(c=>c.source==='owner-property'),worlds,...expected);
      assert.ok(candidates.some(c=>c.source!=='owner-property'));
    }
  } finally { await reader.close(); }
});

test('uses a new overlay family, multiword typed owner, and exact property alias', async t => {
  const dir=mkdtempSync(fileURLToPath(new URL('../.cache/owner-property-overlay-',import.meta.url)));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  writeFileSync(join(dir,'sensors.sop'),[
    '@bench std.schema.world name=w.workbench',
    '@device std.schema.kind of=w.workbench.device world=w.workbench acts=change',
    '@noun core.word text="optical quilloscope" means=w.workbench.device',
    '@sample w.request.key tab=workbench family=device name=device.sample head=span',
    '@surface core.word text="reference specimen" means=device.sample'
  ].join('\n'));
  const configured=loadWorlds({paths:[dir]});
  const text='Set the reference specimen on the east optical quilloscope to Slate Alloy';
  const reader=createReader(undefined,configured);
  try {
    const {candidates}=await reader.propose(text);
    check(text,candidates.find(c=>c.source==='owner-property'),configured,
      'the east optical quilloscope','device.sample','Slate Alloy','reference specimen');
  } finally { await reader.close(); }
});

test('rejects incomplete arguments, wrong family, conflicting keys, and scoped tails', () => {
  for (const text of [
    'Set the y axis title on this regional revenue table to Headcount',
    'Set the title on the chart to',
    'Set the title weight on the chart to electrical',
    'Set the title on the chart to Current Orders and delete it',
    'Set the title on the chart to Current Orders if ready',
    'Set the title on the chart to Orders, delete it',
    'Never set the title on the chart to Orders',
    'Show the title on the chart to Orders',
    'Set the title on the chart to Orders?',
    'Set the title on the chart to “Orders” final'
  ]) assert.deepEqual(read(text),[],text);
  const labels=new Map(worlds.ownerPropertyLabels);
  labels.set(JSON.stringify(['title','chart']),[{attribute:'chart.title'},{attribute:'chart.label'}]);
  assert.deepEqual(read('Set the title on the chart to Orders',{...worlds,ownerPropertyLabels:labels}),[]);
});

test('keeps independently licensed target families for a shared nominal cue', () => {
  const labels=new Map(worlds.ownerPropertyLabels);
  labels.set(JSON.stringify(['title','node']),[{attribute:'node.label'}]);
  const configured={...worlds,ownerPropertyLabels:labels,lookup:phrase=>[
    ...worlds.lookup(phrase),
    ...(phrase==='regional chart' ? [['target','change','node','existing','']] : [])
  ]};
  const text='Set the title on the regional chart to Orders';
  const candidates=read(text,configured);
  assert.equal(candidates.length,2);
  check(text,candidates.find(c=>c.sop.includes('chart.title')),configured,
    'the regional chart','chart.title','Orders','title');
  check(text,candidates.find(c=>c.sop.includes('node.label')),configured,
    'the regional chart','node.label','Orders','title');
});
