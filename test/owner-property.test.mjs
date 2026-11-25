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

test('keeps numeric assignment roles distinct from learned names and unresolved possessives',async t=>{
  const point=(name,amount)=>[
    '@r w.request.request act=change mood=do',
    '@t w.request.target request=$r family=point mode=existing determiner=definite fill=written name='+JSON.stringify(name),
    '@s w.request.constraint request=$r on=attribute attribute=chart.labels value='+JSON.stringify(name)+' operator=eq phase=selector',
    '@c w.request.constraint request=$r on=attribute attribute=point.value value='+JSON.stringify(amount)+' operator=eq phase=result',
  ].join('\n');
  const examples=[
    ['Set its width to 12','Set its width','12'],['Set its height to 19','Set its height','19'],
    ['Set the width of House to 12','Set the width of House','12'],['North to 12','North','12'],
  ].map(([text,name,value])=>({text,sop:point(name,value),count:4}));
  const reader=createReader({version:1,examples,templates:[],lexicon:{}},worlds);
  t.after(()=>reader.close());
  for (const [text,fragment] of [
    ['Set its width to 12','its width to 12'],
    ['Set its height to 19','its height to 19'],
    ['Could you change its height to nineteen?','its height to nineteen'],
  ]) {
    const {candidates}=await reader.propose(text,{evidence:true});
    const correct=candidates.find(candidate=>candidate.source==='unresolved-property-owner');
    assert.ok(correct,text);
    assert.equal(correct.status,'partial');
    const wires=parse(correct.sop);
    assert.equal(field(wires.find(w=>w.type==='w.request.request'),'refers'),'thing');
    assert.equal(field(wires.find(w=>w.type==='w.request.unread'),'text'),fragment);
    assert.deepEqual(correct.evidence.missing,[]);
    assert.ok(candidates.every(candidate=>parse(candidate.sop).every(w=>
      w.type!=='w.request.target' && w.type!=='w.request.constraint')),text);
  }
  const house=await reader.propose('Set the width of House to 12');
  assert.ok(house.candidates.some(({sop})=>{
    const wires=parse(sop);
    return wires.some(w=>['House'].includes(field(w,'name') ?? field(w,'description'))) &&
      wires.some(w=>field(w,'attribute')==='drawn.width' && field(w,'value')==='12');
  }));
  assert.ok(house.candidates.every(({sop})=>!sop.includes('name="Set the width of House"')));
  const box=await reader.propose('Set the box width to twelve');
  check('Set the box width to twelve',box.candidates.find(c=>c.source==='numeric-property-assignment' &&
    c.sop.includes('attribute="node.width"')),
    worlds,'the box','node.width','12','width','twelve');
  const eye=await reader.propose('Set the left eye height to 10');
  check('Set the left eye height to 10',eye.candidates.find(c=>c.source==='numeric-property-assignment' &&
    c.sop.includes('attribute="part.height"')),
    worlds,'the left eye','part.height','10','height');
  const pointResult=await reader.propose('North to 12');
  assert.ok(pointResult.candidates.some(({sop})=>sop.includes('name="North"') && sop.includes('attribute=point.value')));
  const quoteResult=await reader.propose('Set the title of this chart to “Set its width”');
  assert.ok(quoteResult.candidates.some(({sop})=>parse(sop).some(w=>
    field(w,'attribute')==='chart.title' && field(w,'value')==='Set its width')));
});

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

test('uses the native drawing owner inventory and exact backing string slot', async () => {
  const text='Change the label on the house to Home Sweet Home';
  const reader=createReader(undefined,worlds);
  try {
    const {candidates}=await reader.propose(text);
    const candidate=candidates.find(c=>c.source==='owner-property' && c.sop.includes('drawn.label'));
    check(text,candidate,worlds,'the house','drawn.label','Home Sweet Home','label');
    const target=parse(candidate.sop).find(w=>w.type==='w.request.target');
    assert.equal(field(target,'sort'),'house');
  } finally {await reader.close();}
});

test('binds two coordinated dimensions to one native owner and leaves relative arithmetic unread', async () => {
  const reader=createReader(undefined,worlds);
  const proposal=async text=>(await reader.propose(text)).candidates.find(c=>c.source==='owner-property');
  try {
    const text='Set the width of the product photo to 6 inches and the height to 4 inches';
    const candidate=await proposal(text);
    check(text,candidate,worlds,'the product photo','node.width','6 inches','width');
    const wires=parse(candidate.sop);
    assert.equal(wires.filter(w=>w.type==='w.request.request').length,1);
    assert.equal(wires.filter(w=>w.type==='w.request.target').length,1);
    assert.equal(field(wires.find(w=>w.type==='w.request.target'),'sort'),'picture');
    const effects=wires.filter(w=>w.type==='w.request.constraint');
    assert.deepEqual(effects.map(w=>['attribute','value','key_words','words'].map(k=>field(w,k))),[
      ['node.width','6 inches','width','6 inches'],['node.height','4 inches','height','4 inches']
    ]);
    assert.deepEqual(effects.map(w=>['measure','unit','measure_words'].map(k=>field(w,k))),[
      ['6','inch','6'],['4','inch','4']
    ]);
    const spelled='Set the width of the product photo to six inches and the height to +.5 cm';
    const spelledCandidate=await proposal(spelled);
    assert.ok(spelledCandidate,spelled);
    assert.deepEqual(parse(spelledCandidate.sop).filter(w=>w.type==='w.request.constraint')
      .map(w=>['measure','unit','measure_words'].map(k=>field(w,k))),[
      ['6','inch','six'],['0.5','centimetre','+.5']
    ]);
    const relative='Set the width of the product photo to 6.5 inches and the height to twice the width';
    const partial=await proposal(relative);
    check(relative,partial,worlds,'the product photo','node.width','6.5 inches','width');
    const local=parse(partial.sop);
    assert.equal(local.filter(w=>w.type==='w.request.constraint').length,1);
    assert.equal(field(local.find(w=>w.type==='w.request.unread'),'text'),'the height to twice the width');
    for (const input of [
      'Set the width of the product photo to 6 inches and the height to 4 seconds',
      'Set the width of the product photo to 6 inches and the height to 4 dinks',
      'Set the width of the product photo to 6 inches and the height to -4 inches',
      'Set the width of the product photo to 6 inches and the height to −4 inches',
      'Set the width of the product photo to 6 inches and the width to 4 inches',
      'Set the width of the product photo to 6 inches and the height of the backdrop to 4 inches',
      'Set the width of the product photo to 6 inches and delete it',
      'Set the width of the product photo to 6 inches and the height to 4 inches if approved'
    ]) assert.equal(await proposal(input),undefined,input);
  } finally { await reader.close(); }
});

test('keeps a partial reading and adds an opted-in scaled relation for one explicit owner', async () => {
  const path=fileURLToPath(new URL('../sop-worlds/w.relational/',import.meta.url));
  const configured=loadWorlds({paths:[path]});
  const reader=createReader(undefined,configured);
  try {
    const text='Set the width of the product photo to 6.5 inches and the height to twice the width';
    assert.ok(read(text).every(c=>c.source!=='scaled-property'));
    const {candidates}=await reader.propose(text,{evidence:true});
    assert.ok(candidates.some(c=>c.source==='owner-property' && c.unread==='the height to twice the width'));
    const typed=candidates.find(c=>c.source==='scaled-property');
    check(text,typed,configured,'the product photo','node.width','6.5 inches','width');
    assert.deepEqual(typed.evidence.missing,[]);
    assert.equal(typed.evidence.counts.unread,undefined);
    const relation=parse(typed.sop).find(w=>w.type==='w.relational.scaled');
    assert.deepEqual(['request','source','result','source_key','result_key','source_phase','factor','words']
      .map(k=>field(relation,k)),['$r1','$r1.t','$r1.t','$w.request.key.diagram.node.width',
      '$w.request.key.diagram.node.height','result','2','the height to twice the width']);
    for (const input of [
      'Set the width of the product photo to 6.5 inches and double the width',
      'Set the width of the product photo to 6.5 inches and the height to roughly twice the width',
      'Set the width of the product photo to 6.5 inches and the height of the backdrop to twice the width',
      'Set the width of the product photo to 6.5 inches and the height to twice the width of the backdrop',
      'Set the height of the product photo to twice the width',
      'Set the width of the product photo to 6.5 inches and the height to twice the width if approved'
    ]) {
      const result=await reader.propose(input);
      assert.ok(result.candidates.every(c=>c.source!=='scaled-property'),input);
    }
  } finally { await reader.close(); }
});

test('scales unrelated overlay keys only when their declared dimensions agree', async t=>{
  const dir=mkdtempSync(fileURLToPath(new URL('../.cache/scaled-keys-overlay-',import.meta.url)));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  writeFileSync(join(dir,'instrument.sop'),[
    '@lab std.schema.world name=w.lab',
    '@device std.schema.kind of=w.lab.instrument world=w.lab acts=change',
    '@noun core.word text="resonance meter" means=w.lab.instrument',
    '@sample w.request.key tab=diagram family=instrument name=instrument.baseline head=number',
    '@peak w.request.key tab=diagram family=instrument name=instrument.peak head=number',
    '@count w.request.key tab=diagram family=instrument name=instrument.count head=number',
    '@sample.duration pro.reader.property_quantity family=instrument key=instrument.baseline quantity=time',
    '@peak.duration pro.reader.property_quantity family=instrument key=instrument.peak quantity=time',
    '@count.dimension pro.reader.property_quantity family=instrument key=instrument.count quantity=length',
  ].join('\n'));
  const module=fileURLToPath(new URL('../sop-worlds/w.relational/',import.meta.url));
  const reader=createReader(undefined,loadWorlds({paths:[module,dir]}));
  try {
    const text='Set the baseline of the resonance meter to 7 seconds and the peak to triple the baseline';
    const {candidates}=await reader.propose(text);
    const typed=candidates.find(c=>c.source==='scaled-property');
    assert.ok(typed,text);
    const relation=parse(typed.sop).find(w=>w.type==='w.relational.scaled');
    assert.deepEqual(['source_key','result_key','factor'].map(k=>field(relation,k)),['$sample','$peak','3']);
    const different=await reader.propose(text.replace('the peak','the count'));
    assert.ok(different.candidates.some(c=>c.source==='owner-property' && c.unread));
    assert.ok(different.candidates.every(c=>c.source!=='scaled-property'));
  } finally { await reader.close(); }
});

test('compiles owner inventories and backing slot types from an unrelated overlay', async t=>{
  const dir=mkdtempSync(fileURLToPath(new URL('../.cache/owner-inventory-overlay-',import.meta.url)));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  writeFileSync(join(dir,'inventory.sop'),[
    '@lab std.schema.world name=w.lab',
    '@device std.schema.kind of=w.lab.instrument world=w.lab acts=change',
    '@backing.caption core.slot of=w.lab.instrument key=caption kind=string',
    '@backing.count core.slot of=w.lab.instrument key=count kind=integer min=1',
    '@backing.option core.slot of=w.lab.instrument key=option kind=string enum=basic',
    '@backing.protocol core.slot of=w.lab.instrument key=protocol kind=string type=k.lab.protocol by=name',
    '@backing.aperture core.slot of=w.lab.instrument key=aperture kind=number',
    '@a_protocol k.lab.protocol name=calibrated',
    '@caption w.request.key tab=lab family=instrument name=instrument.caption head=candidate means=backing.caption',
    '@count w.request.key tab=lab family=instrument name=instrument.count head=candidate means=backing.count',
    '@option w.request.key tab=lab family=instrument name=instrument.option head=candidate means=backing.option',
    '@protocol w.request.key tab=lab family=instrument name=instrument.protocol head=candidate means=backing.protocol',
    '@aperture w.request.key tab=lab family=instrument name=instrument.aperture head=number means=backing.aperture',
    '@aperture.length pro.reader.property_quantity family=instrument key=instrument.aperture quantity=length',
    '@first_unit k.units.unit name=first_unit symbol=ambiguousunit symbol=caseUnit quantity=length',
    '@second_unit k.units.unit name=second_unit symbol=ambiguousunit symbol=CaseUnit quantity=length',
    '@inventory pro.reader.owner_inventory tab=lab family=instrument act=change provider=k.lab.tools',
    '@glass k.lab.tools name=quill_scope',
    '@stone k.lab.tools name=bore_scope',
    '@alias core.word text="sun viewer" means=glass of=k.lab.tools.name lang=en',
    '@alias.first core.word text=viewer means=glass of=k.lab.tools.name lang=en',
    '@alias.second core.word text=viewer means=stone of=k.lab.tools.name lang=en',
  ].join('\n'));
  const configured=loadWorlds({paths:[dir]});
  const reader=createReader(undefined,configured);
  try {
    const text='Change the caption on the east sun viewer to “Do not shift”';
    const {candidates}=await reader.propose(text);
    const candidate=candidates.find(c=>c.source==='owner-property');
    check(text,candidate,configured,'the east sun viewer','instrument.caption','Do not shift','caption');
    const target=parse(candidate.sop).find(w=>w.type==='w.request.target');
    assert.equal(field(target,'sort'),'quill_scope');
    assert.equal(field(target,'sort_words'),'sun viewer');
    const combined='Set the caption on the sun viewer to “Light and shade” and the aperture to 3 inches';
    const result=await reader.propose(combined);
    const pair=result.candidates.find(c=>c.source==='owner-property');
    check(combined,pair,configured,'the sun viewer','instrument.caption','Light and shade','caption');
    const aperture=parse(pair.sop).find(w=>field(w,'attribute')==='instrument.aperture');
    assert.equal(field(aperture,'value'),'3 inches');
    assert.deepEqual(['measure','unit','measure_words'].map(k=>field(aperture,k)),['3','inch','3']);
    const cased=await reader.propose('Set the aperture on the sun viewer to 3 CaseUnit');
    const casedPair=cased.candidates.find(c=>c.source==='owner-property');
    assert.ok(casedPair);
    assert.equal(field(parse(casedPair.sop).find(w=>field(w,'attribute')==='instrument.aperture'),'unit'),'second_unit');
    for (const input of [
      'Change the caption on the unknown clarifier to Slate Alloy',
      'Change the caption on the viewer to Slate Alloy',
      'Change the count on the sun viewer to Slate Alloy',
      'Change the option on the sun viewer to Slate Alloy',
      'Change the protocol on the sun viewer to Slate Alloy',
      'Change the aperture on the sun viewer to 3 ambiguousunit',
      'Change the caption on the sun viewer to Slate Alloy and delete it'
    ]) {
      const proposals=await reader.propose(input);
      assert.ok(proposals.candidates.every(c=>c.source!=='owner-property'),input);
    }
  } finally {await reader.close();}
});

test('uses a declared unit to resolve a named owner and an ambiguous property label',async t=>{
  const reader=createReader(undefined,worlds);
  t.after(()=>reader.close());
  for (const [text,name,literal,measure,unit,measureWords] of [
    ['change the length of the design critique to an hour','design critique','an hour','1','hour','an'],
    ['Change the duration of the weekly review to 30 minutes','weekly review','30 minutes','30','minute','30'],
    ['change the length of the meeting to an hour',undefined,'an hour','1','hour','an'],
  ]) {
    const {candidates}=await reader.propose(text,{evidence:true});
    const reading=candidates.find(c=>c.source==='owner-property' && c.sop.includes('attribute="meeting.length"'));
    assert.ok(reading,text);
    const wires=parse(reading.sop),target=wires.find(w=>w.type==='w.request.target'),
      result=wires.find(w=>w.type==='w.request.constraint');
    assert.equal(field(target,'mode'),'existing');
    assert.equal(field(target,'family'),'meeting');
    assert.equal(field(target,'name'),name);
    assert.equal(field(target,'fill'),name ? 'written' : 'description');
    assert.deepEqual([field(result,'value'),field(result,'measure'),field(result,'unit'),field(result,'measure_words')],
      [literal,measure,unit,measureWords],text);
    assert.deepEqual(reading.evidence.missing,[]);
    assert.equal(reading.evidence.counts.uncovered ?? 0,0);
    assert.deepEqual(reading.catalog.issues,[]);
  }
  for (const text of [
    'Set the length of the design critique to 1',
    'Set the length of the design critique to an hours',
    'Set the length of the door to an hour',
    'Set the length of the design critique to an inch',
    'Set the length of the design critique to an hour if approved',
    'Did you set the length of the design critique to an hour?',
  ]) {
    const {candidates}=await reader.propose(text);
    assert.ok(!candidates.some(c=>c.source==='owner-property' && c.sop.includes('attribute="meeting.length"')),text);
  }
});

test('does not infer an owner when another installed property accepts the same unit',async t=>{
  const dir=mkdtempSync(fileURLToPath(new URL('../.cache/measured-owner-overlay-',import.meta.url)));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  writeFileSync(join(dir,'time.sop'),[
    '@bench std.schema.world name=w.workbench',
    '@job std.schema.kind of=w.workbench.job world=w.workbench acts=change',
    '@job.word core.word text="batch job" means=w.workbench.job',
    '@duration w.request.key tab=workbench family=job name=job.runtime head=number',
    '@duration.word core.word text=length means=job.runtime',
    '@duration.quantity pro.reader.property_quantity family=job key=job.runtime quantity=time',
  ].join('\n'));
  const reader=createReader(undefined,loadWorlds({paths:[dir]}));
  t.after(()=>reader.close());
  const ambiguous=await reader.propose('Set the length of the weekly review to an hour');
  assert.ok(!ambiguous.candidates.some(candidate=>candidate.source==='owner-property'));
  const explicit=await reader.propose('Set the length of the batch job to an hour');
  const reading=explicit.candidates.find(candidate=>candidate.source==='owner-property' &&
    candidate.sop.includes('attribute="job.runtime"'));
  assert.ok(reading);
  const wires=parse(reading.sop);
  const result=wires.find(wire=>wire.type==='w.request.constraint');
  assert.deepEqual([field(result,'measure'),field(result,'unit')],['1','hour']);
});
