import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { sequenceReading } from '../src/argument-sequences.mjs';
import { createReader } from '../src/runtime.mjs';
import { parse } from '../src/schema.mjs';
import { loadWorlds } from '../src/worlds.mjs';

const value = raw => raw?.startsWith('"') ? JSON.parse(raw) : raw;
function bindings(sop) {
  return Object.fromEntries(parse(sop).filter(w=>w.type==='w.request.constraint').map(({attrs})=>
    [value(attrs.attribute[0]),[value(attrs.value?.[0]),value(attrs.words?.[0])]]));
}
function hasBindings(candidates,expected) {
  return candidates.some(({sop})=>{
    if (!sop) return false;
    const got=bindings(sop);
    return Object.entries(expected).every(([key,pair])=>
      got[key]?.[0]===pair[0] && got[key]?.[1]===pair[1]);
  });
}

test('typed positive partition counts stay separate from the field and the histogram kind',async t=>{
  const reader=createReader(undefined,loadWorlds());
  t.after(()=>reader.close());
  for (const [text,field,number,written,label] of [
    ['Make a histogram of sales with 10 equal buckets.','sales','10',undefined,'equal buckets'],
    ['Show a histogram of delivery times in five bins.','delivery times','5','five','bins'],
    ['Make a histogram of sales with one hundred bins.','sales','100','one hundred','bins'],
    ['Make a histogram of sales, bucketed into 10 equal bins.','sales','10',undefined,'equal bins'],
    ['Plot order value bucketed into 10 equal buckets as a histogram.','order value','10',undefined,'equal buckets'],
  ]) {
    const {candidates}=await reader.propose(text,{evidence:true});
    const candidate=candidates.find(c=>hasBindings([c],{'chart.xField':[field,undefined],'chart.bins':[number,written]}));
    assert.ok(candidate,text);
    const wires=parse(candidate.sop);
    const target=wires.find(w=>w.type==='w.request.target');
    assert.equal(value(target.attrs.sort[0]),'histogram',text);
    const count=wires.find(w=>w.attrs.attribute?.map(value).includes('chart.bins'));
    assert.equal(count.attrs.request[0],target.attrs.request[0],text);
    assert.ok(count.attrs.key_words.map(value).includes(label),text);
    assert.deepEqual(candidate.catalog.issues,[],text);
    assert.deepEqual(candidate.evidence.missing,[],text);
    assert.equal(candidate.evidence.counts.uncovered ?? 0,0,text);
  }
  for (const text of ['Make a histogram of sales with zero bins.',
    'Make a histogram of sales with 2.5 bins.', 'Make a histogram of sales with 10-pixel wide buckets.',
    'Make a histogram of sales with labels for the buckets.',
    'Make a bar chart of sales with 10 bins.']) {
    const {candidates}=await reader.propose(text);
    assert.ok(candidates.every(c=>c.source!=='argument-frame' || !c.sop.includes('chart.bins')),text);
  }
});

test('a copied count with width or rounding evidence keeps the written operand unread',async t=>{
  const wrong=[
    ['Make a histogram of calls in bands of twenty minutes.','20','in bands of twenty minutes','partition width'],
    ['Make a histogram of claims with a bin width of one hundred.','100','with a bin width of one hundred','partition width'],
    ['Make a histogram of claims in 500-wide bins.','500','in 500-wide bins','partition width'],
    ['Plot claims at 500 per bin as a histogram.','500','at 500 per bin','partition width'],
    ['Make a histogram of claims rounded down to 500.','500','rounded down to 500','partition rounding'],
  ];
  function circuit(text,count,words,label='') {
    return [
      '@r w.request.request act=make mood=do words='+JSON.stringify(text),
      '@r.t w.request.target request=$r family=chart mode=new sort=histogram',
      '@r.c w.request.constraint request=$r on=attribute attribute=chart.bins value='+count+
        ' words='+JSON.stringify(words)+label,
    ].join('\n');
  }
  const mixed='Make a histogram with ten bins and a bin width of ten.';
  const unit='In bands of twenty minutes histogram of the call length.';
  const examples=[...wrong.map(([text,count,words])=>({text,sop:circuit(text,count,words),count:1})),
    {text:mixed,sop:circuit(mixed,10,'ten',' key_words=bins'),count:1},
    {text:unit,sop:circuit(unit,20,'twenty'),count:1}];
  const reader=createReader({version:1,examples,templates:[]},loadWorlds());
  t.after(()=>reader.close());
  for (const [text,,words,note] of wrong) {
    const {candidates}=await reader.propose(text,{evidence:true});
    const rewrites=candidates.filter(c=>c.sop.includes('note="'+note+'"'));
    assert.ok(rewrites.length,text);
    assert.ok(candidates.every(c=>!c.sop.includes('attribute=chart.bins')),text);
    const candidate=rewrites[0];
    const wires=parse(candidate.sop);
    assert.ok(wires.some(w=>w.type==='w.request.unread' && value(w.attrs.text[0])===words &&
      w.attrs.request[0]==='$'+wires[0].id),text);
    assert.ok(wires.some(w=>w.type==='w.request.target'),text);
    assert.equal(candidate.status,'partial',text);
    assert.deepEqual(candidate.evidence.missing,[],text);
  }
  const {candidates}=await reader.propose(mixed);
  assert.ok(hasBindings(candidates,{'chart.bins':['10','ten']}),mixed);
  const fronted=await reader.propose(unit);
  assert.ok(fronted.candidates.some(c=>c.sop.includes('text="bands of twenty minutes"')),unit);
});

test('native argument sequences bind a canonical aggregate and ordered written spans through propose', async () => {
  const reader=createReader(undefined,loadWorlds());
  try {
    for (const [text,aggregate] of [
      ['Make a bar chart of totals by Customer Region for Net Sales',['sum','totals']],
      ['Make a bar chart of average Net Sales by Customer Region',['avg','average']],
      ['Make a bar chart of the average of Net Sales by Customer Region',['avg','average']]
    ]) {
      const {candidates}=await reader.propose(text);
      assert.ok(hasBindings(candidates,{
        'chart.aggregate':aggregate,'chart.measure':['Net Sales','Net Sales'],
        'chart.dimension':['Customer Region','Customer Region']
      }),text);
      assert.ok(candidates.some(candidate=>candidate.source!=='argument-sequence'),text);
    }
    for (const text of [
      'Make a bar chart of totals by Customer Region for',
      'Make a bar chart of totals by Customer Region for Net Sales if ready',
      'Make a bar chart of totals by Customer Region for “Net Sales”',
      'Remove a bar chart of totals by Customer Region for Net Sales'
    ]) {
      const {candidates}=await reader.propose(text);
      assert.ok(candidates.every(candidate=>candidate.source!=='argument-sequence'),text);
    }
  } finally { await reader.close(); }
});

test('native arguments can be installed for an unrelated catalog through an overlay', async t => {
  const dir=mkdtempSync(fileURLToPath(new URL('../.cache/arg-sequence-overlay-',import.meta.url)));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  writeFileSync(join(dir,'fields.sop'),[
    '@bench std.schema.world name=w.workbench',
    '@device std.schema.kind of=w.workbench.device world=w.workbench acts=make',
    '@noun core.word text="optical quilloscope" means=w.workbench.device',
    '@scheme w.request.key family=device name=device.scheme head=class value=survey',
    '@sample w.request.key family=device name=device.sample head=span',
    '@reference w.request.key family=device name=device.reference head=span',
    '@form core.word text=surveying means=survey of=device.scheme',
    '@frame pro.reader.argument_sequence family=device act=make mode=new prefix="optical quilloscope for" part=device.scheme part=device.sample part=versus part=device.reference'
  ].join('\n'));
  const reader=createReader(undefined,loadWorlds({paths:[dir]}));
  try {
    const text='Make an optical quilloscope for surveying Quartz Ore versus Slate Alloy';
    const {candidates}=await reader.propose(text);
    assert.ok(hasBindings(candidates,{
      'device.scheme':['survey','surveying'],'device.sample':['Quartz Ore','Quartz Ore'],
      'device.reference':['Slate Alloy','Slate Alloy']
    }),text);
  } finally { await reader.close(); }
});

test('grounds an implicit closed result on its written owner with or without a verb', async t => {
  const reader=createReader();
  t.after(()=>reader.close());
  const field=(wire,key)=>value(wire.attrs[key]?.[0]);
  for (const [text,description,preset,words,predicate] of [
    ['Set my avatar to an elderly man.','my avatar','old man','an elderly man','Set'],
    ['um, avatar to robot please','avatar','robot',undefined,undefined],
  ]) {
    const {candidates}=await reader.propose(text,{evidence:true});
    const reading=candidates.find(c=>c.source==='argument-frame' && hasBindings([c],{'drawn.preset':[preset,words]}));
    assert.ok(reading,text);
    const wires=parse(reading.sop), request=wires.find(w=>w.type==='w.request.request');
    const target=wires.find(w=>w.type==='w.request.target');
    assert.equal(field(request,'predicate'),predicate);
    assert.equal(field(target,'description'),description);
    assert.equal(field(target,'mode'),'existing');
    assert.ok(!target.attrs.ids);
    assert.equal(reading.status,'matched');
    assert.deepEqual(reading.evidence.missing,[]);
    assert.deepEqual(reading.catalog.issues,[]);
    assert.ok(!reading.evidence.counts.unread && !reading.evidence.counts.uncovered);
  }
  for (const text of ['Draw a robot','Set the box to robot', 'Set my avatar to unknown',
    'Do not set my avatar to robot','Set my avatar to robot if approved','Avatar to robot?']) {
    const {candidates}=await reader.propose(text);
    assert.ok(candidates.every(c=>c.source!=='argument-frame'),text);
  }
  const {candidates}=await reader.propose('Set my avatar to a robot for the demo.');
  assert.ok(candidates.some(c=>hasBindings([c],{'drawn.preset':['robot','a robot']}) &&
    parse(c.sop).some(w=>w.type==='w.request.intent' && field(w,'role')==='purpose' && field(w,'value')==='the demo')));

  const tail='and keep it for the next time I open the app on this machine';
  const combined=await reader.propose(`If you can, set my avatar to an elderly lady ${tail}.`);
  const preset=combined.candidates.filter(c=>hasBindings([c],{'drawn.preset':['old woman','an elderly lady']}));
  assert.ok(preset.some(c=>c.status==='partial' && parse(c.sop).some(w=>
    w.type==='w.request.unread' && field(w,'text')===tail)));
  assert.ok(preset.every(c=>!parse(c.sop).some(w=>w.type==='w.request.intent' && field(w,'role')==='purpose')));
});

test('an overlay can install a verb-free result frame and a multiword closed alias', async t=>{
  const dir=mkdtempSync(fileURLToPath(new URL('../.cache/arg-fragment-overlay-',import.meta.url)));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  writeFileSync(join(dir,'frame.sop'),[
    '@bench std.schema.world name=w.workbench',
    '@device std.schema.kind of=w.workbench.device world=w.workbench acts=change',
    '@setting w.request.key family=device name=device.mode head=class value="high precision"',
    '@alias core.word text="fine surveying" means="high precision" of=device.mode',
    '@frame pro.reader.argument_sequence family=device act=change mode=existing owner=quilloscope part="$owner" part=into part=device.mode',
  ].join('\n'));
  const reader=createReader(undefined,loadWorlds({paths:[dir]}));
  t.after(()=>reader.close());
  const {candidates}=await reader.propose('my quilloscope into fine surveying',{evidence:true});
  const reading=candidates.find(c=>hasBindings([c],{'device.mode':['high precision','fine surveying']}));
  assert.ok(reading);
  assert.deepEqual(reading.evidence.missing,[]);
  assert.deepEqual(reading.catalog.issues,[]);
});

test('keeps the specified state, the written scope and its reason on one owner', async t=>{
  const reader=createReader();
  t.after(()=>reader.close());
  const scope='Whatever I do in the diagram tab';
  const reason='because I do not want to change it every morning';
  const {candidates}=await reader.propose(`${scope}, my avatar should remain a person with glasses, ${reason}.`,{evidence:true});
  const reading=candidates.find(c=>hasBindings([c],{
    'preference.scope':[scope,undefined], 'drawn.about':['a person with glasses',undefined],
  }) && parse(c.sop).some(w=>w.type==='w.request.unread' && value(w.attrs.text[0])===reason));
  assert.ok(reading);
  const wires=parse(reading.sop), requests=wires.filter(w=>w.type==='w.request.request');
  assert.equal(requests.length,1);
  assert.equal(value(requests[0].attrs.predicate[0]),'should remain');
  const target=wires.find(w=>w.type==='w.request.target');
  assert.equal(value(target.attrs.description[0]),'my avatar');
  assert.equal(value(target.attrs.mode[0]),'existing');
  assert.ok(!('drawn.keep' in bindings(reading.sop)));
  assert.ok(wires.every(w=>!w.attrs.request || w.attrs.request[0]==='$'+requests[0].id));
  assert.deepEqual(reading.evidence.missing,[]);
  assert.deepEqual(reading.catalog.issues,[]);
  assert.ok(!reading.evidence.counts.uncovered);

  for (const text of [
    'If approved, my avatar should remain a person with glasses.',
    'My avatar should not remain a person with glasses.',
    'My avatar should remain as it is.',
    'My avatar should remain a person and delete the chart.',
    'My avatar should remain a person delete the chart.',
    'Label the box "my avatar should remain a person".',
    'Whatever I do in the diagram tab my avatar should remain a person.',
  ]) {
    const {candidates}=await reader.propose(text);
    assert.ok(candidates.every(c=>c.source!=='argument-frame'),text);
  }
});

test('reads installed state and scope declarations for another catalog', async t=>{
  const dir=mkdtempSync(fileURLToPath(new URL('../.cache/state-overlay-',import.meta.url)));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  writeFileSync(join(dir,'frame.sop'),[
    '@bench std.schema.world name=w.workbench',
    '@device std.schema.kind of=w.workbench.device world=w.workbench acts=change',
    '@setting w.request.key family=device name=device.state head=span',
    '@scope w.request.key family=preference name=preference.scope head=span',
    '@format pro.reader.argument_format family=device key=device.state format=nominal_description',
    '@frame pro.reader.argument_sequence family=device act=change mode=existing prefix="throughout work in" owner=quilloscope predicate_surface="must stay" scope_attribute=preference.scope part="$scope" part="," part="$owner" part="$predicate" part=device.state structured_part=device.state',
  ].join('\n'));
  const reader=createReader(undefined,loadWorlds({paths:[dir]}));
  t.after(()=>reader.close());
  const {candidates}=await reader.propose('Throughout work in the lab, my quilloscope must stay a portable device.',{evidence:true});
  const reading=candidates.find(c=>hasBindings([c],{
    'device.state':['a portable device',undefined], 'preference.scope':['Throughout work in the lab',undefined],
  }));
  assert.ok(reading);
  assert.equal(reading.status,'matched');
  assert.deepEqual(reading.evidence.missing,[]);
  assert.deepEqual(reading.catalog.issues,[]);
});

test('an occupied result field and off-anchor target block sequence augmentation', () => {
  const text='Make chart of total Revenue by Account';
  const candidate={sop:[
    '@r w.request.request act=make predicate=Make',
    '@t w.request.target request=$r family=chart mode=new family_words=chart',
    '@u w.request.unread request=$r text="total Revenue by Account"'
  ].join('\n'),status:'partial'};
  const proof={act:'make',family:'chart',mode:'new',anchor:5,start:14,end:text.length,
    bindings:[['chart.aggregate','sum',14,19],['chart.measure','',20,27],['chart.dimension','',31,38]]};
  const output=sequenceReading(text,candidate,proof);
  assert.ok(output);
  assert.equal(output.sop.includes('w.request.unread'),false);
  assert.equal(sequenceReading(text,candidate,{...proof,anchor:11}),undefined);
  const conflict='@c w.request.constraint request=$r on=attribute attribute=chart.aggregate value=sum operator=ne phase=result';
  assert.equal(sequenceReading(text,{...candidate,sop:candidate.sop+'\n'+conflict},proof),undefined);
});

test('binds an owner before or after its typed arguments and keeps later words out of field values', async t => {
  const reader=createReader();
  t.after(()=>reader.close());
  for (const [text,expected] of [
    ['Show me average latency versus service tier as a bar chart',{
      'chart.type':['bar','a bar chart'],'chart.aggregate':['avg','average'],
      'chart.measure':['latency',undefined],'chart.dimension':['service tier',undefined],
    }],
    ['Give me a scatter plot of market value against unit price shown together, coloured by supplier for the review',{
      'chart.type':['scatter','a scatter plot'],
      'chart.colourBy':['supplier',undefined],
    }],
    ['Try a line chart of year-on-year averages of delivery cost',{
      'chart.type':['line','a line chart'],'chart.aggregate':['avg','averages'],
      'chart.period':['year','year-on-year'],'chart.measure':['delivery cost',undefined],
    }],
    ['Make a scatter plot of energy plotted by temperature, with a regression line, for the report',{
      'chart.type':['scatter','a scatter plot'],'chart.trendLine':['show','with a regression line'],
    }],
  ]) {
    const {candidates}=await reader.propose(text);
    const frames=candidates.filter(candidate=>candidate.source==='argument-frame');
    assert.equal(frames.length,1,text);
    assert.ok(hasBindings(frames,expected),text);
    if (text.includes('for the')) {
      assert.ok(frames[0].sop.includes('w.request.unread'),text);
      assert.ok(!/chart\.[xy]Label/u.test(frames[0].sop),text);
    }
  }
});

test('grounds slots on an existing described owner and rejects other instructions inside an open role', async t => {
  const reader=createReader();
  t.after(()=>reader.close());
  const {candidates}=await reader.propose('Maybe also show the average of order lead time on the fulfillment chart');
  const reading=candidates.find(candidate=>candidate.source==='argument-frame');
  assert.ok(reading);
  assert.ok(hasBindings([reading],{'chart.aggregate':['avg','average'],'chart.measure':['order lead time',undefined]}));
  const target=parse(reading.sop).find(wire=>wire.type==='w.request.target');
  assert.deepEqual(target.attrs.mode,['existing']);
  assert.deepEqual(target.attrs.description,['"fulfillment chart"']);
  for (const text of [
    'Do not show the average of order lead time on the fulfillment chart',
    'Show me average latency versus service tier and remove the diagram as a bar chart',
    'Give me a scatter plot of market value against unit price then remove the bar chart',
    'Give me a scatter plot of market value against unit price if ready',
    'Give me a scatter plot of market value against "unit price"',
  ]) {
    const proposed=await reader.propose(text);
    assert.ok(!proposed.candidates.some(candidate=>candidate.source==='argument-frame'),text);
  }
});

test('loads an unrelated trailing owner with a closed typed value from an overlay', async t => {
  const dir=mkdtempSync(fileURLToPath(new URL('../.cache/arg-frame-overlay-',import.meta.url)));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  writeFileSync(join(dir,'frames.sop'),[
    '@press std.schema.world name=w.press',
    '@report std.schema.kind of=w.press.report world=w.press acts=make',
    '@audience w.request.key family=report name=report.audience head=span',
    '@topic w.request.key family=report name=report.topic head=span',
    '@kind w.request.key family=report name=report.kind head=class value=notice',
    '@release pro.reader.argument_sequence family=report act=make mode=new prefix="prepare" owner="a public notice" owner_key=report.kind owner_value=notice part=report.topic part=for part=report.audience part=as part="$owner"',
  ].join('\n'));
  const reader=createReader(undefined,loadWorlds({paths:[dir]}));
  t.after(()=>reader.close());
  const {candidates}=await reader.propose('Prepare Park Access for West District as a public notice');
  assert.ok(hasBindings(candidates.filter(candidate=>candidate.source==='argument-frame'),{
    'report.kind':['notice','a public notice'],'report.topic':['Park Access',undefined],
    'report.audience':['West District',undefined],
  }));
});

test('binds relative alignment with either a written group or a deferred contextual group',async t=>{
  const reader=createReader();
  t.after(()=>reader.close());
  for (const [text,description,edge,words,predicate,marker] of [
    ['bring the top edges of the boxes into line','the boxes','top','top edges','bring','into line'],
    ['Please bring the left edges of the nodes into line','the nodes','left','left edges','bring','into line'],
    ['horizontal centres aligned',undefined,'centre','horizontal centres','aligned',undefined],
  ]) {
    const {candidates}=await reader.propose(text,{evidence:true});
    const reading=candidates.find(candidate=>candidate.source==='argument-frame' && hasBindings([candidate],{'node.edge':[edge,words]}));
    assert.ok(reading,text);
    const wires=parse(reading.sop);
    const byType=type=>wires.find(wire=>wire.type==='w.request.'+type);
    const field=(type,key)=>value(byType(type)?.attrs[key]?.[0]);
    assert.deepEqual([field('request','act'),field('request','mode'),field('request','predicate')],['place','arrange',predicate]);
    assert.deepEqual([field('target','family'),field('target','mode'),field('target','fill'),field('target','description')],
      ['node','existing',description?'description':'context',description]);
    assert.equal(field('constraint','key_words'),marker);
    assert.equal(reading.status,'matched');
    assert.deepEqual(reading.catalog.issues,[]);
    assert.deepEqual(reading.evidence.missing,[]);
    assert.equal(reading.evidence.counts.uncovered ?? 0,0);
  }
  for (const text of [
    'Bring the boxes into line',
    'Bring the top edges of the pictures into line',
    'Bring the top edges of the boxes into line if ready',
    'Do not bring the top edges of the boxes into line',
    'Were the horizontal centres aligned?',
    'Write "horizontal centres aligned"',
  ]) {
    const {candidates}=await reader.propose(text);
    assert.ok(!candidates.some(candidate=>candidate.source==='argument-frame' &&
      candidate.sop.includes('attribute="node.edge"')),text);
  }
});
