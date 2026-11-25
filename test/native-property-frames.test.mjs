import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';
import {createReader} from '../src/runtime.mjs';
import {loadWorlds} from '../src/worlds.mjs';
import {parse} from '../src/schema.mjs';

const field=(wire,key)=>{
  const [value]=wire?.attrs[key] ?? [];
  return value?.startsWith('"') ? JSON.parse(value) : value;
};
const native=candidates=>candidates.filter(candidate=>candidate.source==='native-property-frame').map(candidate=>parse(candidate.sop));
const typed=(wires,type)=>wires.find(wire=>wire.type==='w.request.'+type);
const result=(candidates,attribute)=>native(candidates).find(wires=>field(typed(wires,'constraint'),'attribute')===attribute);

test('binds both native attribute orders, a literal object code, and typed property values',async t=>{
  const reader=createReader();
  t.after(()=>reader.close());
  for (const [text,attribute,value,owner] of [
    ['Set the seat of o8 to the stool','drawn.seat','the stool',{ids:'o8'}],
    ['Set the chart width to -150.25','chart.width','-150.25',{description:'the chart'}],
    ['Could you set node n3 height to fifty?','node.height','50',{ids:'n3'}],
    ['Change the colour of the house to red','drawn.colour','red',{sort:'house'}],
    ['Set the box label to "Go and Stop"','node.label','Go and Stop',{description:'the box'}],
  ]) {
    const {candidates}=await reader.propose(text);
    const wires=result(candidates,attribute);
    assert.ok(wires,text);
    assert.equal(field(typed(wires,'constraint'),'value'),value,text);
    for (const [key,expected] of Object.entries(owner)) assert.equal(field(typed(wires,'target'),key),expected,text);
  }
});

test('reads a numerical requirement from native modality and keeps factual or compound inputs out',async t=>{
  const reader=createReader();
  t.after(()=>reader.close());
  const {candidates}=await reader.propose('The node should have 30 width');
  const wires=result(candidates,'node.width');
  assert.ok(wires);
  assert.equal(field(typed(wires,'request'),'predicate'),'should have');
  assert.equal(field(typed(wires,'constraint'),'value'),'30');
  for (const text of [
    'The node has 30 width',
    'The node gets 30 width',
    'Do not set the width of the node to 30',
    'Set the width of the node to 30 if approved',
    'Set the width of node to 30 inches',
    'Set the width of node to 30 and add a chart',
    'Set o8 to the seat',
    'Set the variant of the house to modern',
  ]) {
    const answer=await reader.propose(text);
    assert.deepEqual(native(answer.candidates),[],text);
  }
});

test('asks both native property orders and numeric quantities without emitting an assignment',async t=>{
  const reader=createReader();
  t.after(()=>reader.close());
  for (const [text,question,attribute,word,ids] of [
    ['What is the width of shape n8?','what','node.width','width','n8'],
    ['Which colour is n9','which','node.colour','colour','n9'],
    ['How many bins does the chart have?','count','chart.bins','bins',undefined],
  ]) {
    const {candidates}=await reader.propose(text);
    const wires=native(candidates).find(wires=>field(typed(wires,'request'),'asked')===attribute);
    assert.ok(wires,text);
    const request=typed(wires,'request');
    assert.equal(field(request,'question'),question,text);
    assert.equal(field(request,'asked_words'),word,text);
    assert.equal(field(request,'words'),text,text);
    assert.equal(field(typed(wires,'target'),'ids'),ids,text);
    assert.equal(wires.some(wire=>field(wire,'phase')==='result'),false,text);
    if (!ids) assert.ok(typed(wires,'lookup'),text);
  }
  for (const text of [
    'What label is UNKNOWNCODE?',
    'How many labels does the node have?',
    'What is the label of shape n8 and remove it?',
    'What is not the width of n8?',
  ]) {
    const {candidates}=await reader.propose(text);
    assert.deepEqual(native(candidates),[],text);
  }
});

test('unifies the qualitative value with an existing owner in native imperative and modal frames',async t=>{
  const reader=createReader();
  t.after(()=>reader.close());
  for (const [text,attribute,value,predicate] of [
    ['Make the cat blue','drawn.colour','blue','Make'],
    ['The link should be dashed','link.style','dashed','should'],
    ['The cat should be tiny','drawn.size','tiny','should'],
  ]) {
    const {candidates}=await reader.propose(text);
    const wires=result(candidates,attribute);
    assert.ok(wires,text);
    const constraint=typed(wires,'constraint');
    assert.equal(field(constraint,'value'),value,text);
    assert.equal(field(constraint,'key_words'),undefined,text);
    assert.equal(field(typed(wires,'request'),'predicate'),predicate,text);
    assert.equal(field(typed(wires,'target'),'mode'),'existing',text);
  }
  for (const [text,family] of [
    ['The cat is blue','drawn'],['The cat should not be blue','drawn'],
    ['Make the chart horizontal','chart'],['Make the node medium','node'],
    ['Make the cat "blue"','drawn'],
  ]) {
    const {candidates}=await reader.propose(text);
    assert.ok(native(candidates).every(wires=>field(typed(wires,'target'),'family')!==family),text);
  }
});

test('reads fresh native frame and catalog roles in an overlay',async t=>{
  const dir=mkdtempSync(fileURLToPath(new URL('../.cache/native-prop-',import.meta.url)));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  writeFileSync(join(dir,'controls.sop'),[
    '@studio std.schema.world name=w.studio',
    '@module std.schema.kind of=w.studio.module world=w.studio acts=change acts=ask',
    '@fixture core.word text=goniometer means=w.studio.module',
    '@sampling w.request.key family=module name=module.samples head=number',
    '@w.studio.module.response core.slot of=w.studio.module key=response enum=linear enum=logarithmic',
    '@response w.request.key family=module name=module.response head=class value=linear value=logarithmic means=w.studio.module.response',
    '@alias core.word text=log means=logarithmic of=w.studio.module.response',
    '@w.studio.module.feed core.slot of=w.studio.module key=feed enum=logscale enum=fixed',
    '@feed w.request.key family=module name=module.feed head=class value=logscale value=fixed means=w.studio.module.feed',
    '@feedAlias core.word text=log means=logscale of=w.studio.module.feed',
    '@affect k.actions.verb text=reassign act=change complement=value',
    '@frame w.lang.en.frame name=lab.assign act=change mode=set needs=attrs role=attribute role=thing role=value',
    '@v w.lang.en.part frame=lab.assign at=1 is=verb act=change',
    '@p w.lang.en.part frame=lab.assign at=2 is=role role=attribute takes=lexicon lexicon=attribute',
    '@link w.lang.en.part frame=lab.assign at=3 is=word word=within',
    '@o w.lang.en.part frame=lab.assign at=4 is=role role=thing takes=words',
    '@to w.lang.en.part frame=lab.assign at=5 is=word word=to',
    '@value w.lang.en.part frame=lab.assign at=6 is=role role=value takes=words',
    '@ask w.lang.en.frame name=lab.ask act=ask mode=what needs=attrs role=attribute role=thing',
    '@wh w.lang.en.part frame=lab.ask at=1 is=word word=what',
    '@askprop w.lang.en.part frame=lab.ask at=2 is=role role=attribute takes=lexicon lexicon=attribute',
    '@asklink w.lang.en.part frame=lab.ask at=3 is=word word=inside',
    '@askowner w.lang.en.part frame=lab.ask at=4 is=role role=thing takes=words',
  ].join('\n'));
  const reader=createReader(undefined,loadWorlds({paths:[dir]}));
  t.after(()=>reader.close());
  for (const [text,attribute,value] of [
    ['Reassign samples within goniometer to 8','module.samples','8'],
    ['Reassign response within goniometer to log','module.response','logarithmic'],
  ]) {
    const {candidates}=await reader.propose(text);
    const wires=result(candidates,attribute);
    assert.ok(wires,text);
    assert.equal(field(typed(wires,'constraint'),'value'),value,text);
    assert.equal(field(typed(wires,'target'),'family_words'),'goniometer',text);
  }
  const {candidates}=await reader.propose('What response inside the goniometer?');
  const question=native(candidates).find(wires=>field(typed(wires,'request'),'asked')==='module.response');
  assert.ok(question);
  assert.equal(field(typed(question,'target'),'description'),'the goniometer');
  assert.equal(field(typed(question,'request'),'asked_words'),'response');
  const qualitative=await reader.propose('The goniometer should be log');
  assert.deepEqual(new Set(native(qualitative.candidates).map(wires=>field(typed(wires,'constraint'),'attribute'))),
    new Set(['module.response','module.feed']));
});

const implicit = candidates => native(candidates).filter(wires=>{
  const target=typed(wires,'target');
  return field(target,'fill')==='context' && !['description','sort','ids','name','family_words']
    .some(key=>field(target,key) !== undefined);
});

test('binds a named property and finite value while deferring the compatible owner',async t=>{
  const reader=createReader();
  t.after(()=>reader.close());
  const text='make the colour bar length medium';
  const {candidates}=await reader.propose(text);
  const wires=implicit(candidates).find(wires=>field(typed(wires,'constraint'),'attribute')==='chart.colourBarLength');
  assert.ok(wires);
  const target=typed(wires,'target'), constraint=typed(wires,'constraint'), lookup=typed(wires,'lookup');
  assert.equal(field(target,'family'),'chart');
  assert.equal(field(target,'mode'),'existing');
  assert.equal(field(constraint,'key_words'),'colour bar length');
  assert.equal(field(constraint,'value'),'medium');
  assert.equal(field(lookup,'target'),'$'+target.id);
  assert.equal(field(lookup,'from'),'page');
});

test('keeps competing context families and never mistakes owners, conditions, or negative clauses for omitted owners',async t=>{
  const reader=createReader();
  t.after(()=>reader.close());
  const results=implicit((await reader.propose('Set the width to 15')).candidates);
  const families=new Set(results.map(wires=>field(typed(wires,'target'),'family')));
  assert.ok(families.has('chart') && families.has('node'));
  for (const wires of results) assert.equal(field(typed(wires,'constraint'),'value'),'15');
  for (const query of [
    'Do not make the colour bar length medium',
    'Make the colour bar length medium if approved',
    'Make the colour bar length medium and delete it',
    'Make the colour bar length moderate',
    'Make the chart title medium',
    'Make the chart orange',
    'Could you set the markers to small circles?',
    'Could you set the markers to sized by the order value?',
    'Change the time to the next morning',
    'Set the width of the chart to 15',
    'Set every width to 15',
    'The colour bar length is medium',
    'Is the colour bar length medium?',
  ]) assert.deepEqual(implicit((await reader.propose(query)).candidates),[],query);
});

test('keeps compatible property aliases in an unrelated world and accepts a bounded quoted operand',async t=>{
  const root=fileURLToPath(new URL('../.cache/',import.meta.url));
  const dir=mkdtempSync(join(root,'implicit-property-frame-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  writeFileSync(join(dir,'sensors.sop'),[
    '@lab std.schema.world name=w.lab',
    '@sense std.schema.kind of=w.lab.receiver world=w.lab acts=change',
    '@mode w.request.key family=receiver name=receiver.displayMode head=class value=dim value=bright',
    '@filter w.request.key family=receiver name=receiver.filterMode head=class value=dim value=clear',
    '@memo w.request.key family=receiver name=receiver.sideNote head=span',
    '@alias core.word text="operating mode" means=receiver.displayMode means=receiver.filterMode',
  ].join('\n'));
  const worlds=loadWorlds({paths:[dir]});
  const reader=createReader(undefined,worlds);
  t.after(()=>reader.close());
  const phrase='Make the operating mode dim';
  const found=implicit((await reader.propose(phrase)).candidates).filter(wires=>field(typed(wires,'target'),'family')==='receiver');
  assert.deepEqual(found.map(wires=>field(typed(wires,'constraint'),'attribute')).sort(),['receiver.displayMode','receiver.filterMode']);
  const quote='Set the side note to "No reset if busy"';
  const [open]=implicit((await reader.propose(quote)).candidates).filter(wires=>field(typed(wires,'target'),'family')==='receiver');
  assert.ok(open);
  assert.equal(field(typed(open,'constraint'),'value'),'No reset if busy');
  assert.equal(field(typed(open,'constraint'),'key_words'),'side note');
  assert.equal(implicit((await reader.propose('Set the side note to No reset')).candidates).length,0);
});

test('binds written component owners through installed part and slot inventories',async t=>{
  const reader=createReader();
  t.after(()=>reader.close());
  for (const [text,description,sort,attribute,value] of [
    ['Set the face scale to 0.8','the face','face','part.scale','0.8'],
    ['Set the mouth scale to 1.1','the mouth','mouth','part.scale','1.1'],
    ['Set the width of the left eye to 12.5','the left eye','eye','part.width','12.5'],
    ['Could you set the eyebrow width to nine?','the eyebrow','eyebrows','part.width','9'],
  ]) {
    const {candidates}=await reader.propose(text,{evidence:true});
    const reading=candidates.find(candidate=>{
      if (candidate.source!=='native-property-frame') return false;
      const wires=parse(candidate.sop), target=typed(wires,'target'), constraint=typed(wires,'constraint');
      return field(target,'family')==='part' && field(target,'mode')==='existing' &&
        field(target,'description')===description && field(target,'sort')===sort &&
        field(constraint,'attribute')===attribute && field(constraint,'phase')==='result' && field(constraint,'value')===value;
    });
    assert.ok(reading,text);
    assert.deepEqual(reading.evidence.missing,[],text);
    assert.equal(reading.evidence.counts.uncovered ?? 0,0,text);
    assert.deepEqual(reading.catalog.issues,[],text);
  }
  for (const text of [
    'The face scale is 0.8',
    'Set the face scale to tall',
    'Set the face scale to 0.8 if available',
    'Set the nose width to 9 and make a chart',
    'Set the width of the quilloscope to 9',
  ]) {
    const {candidates}=await reader.propose(text);
    assert.ok(!result(candidates,'part.scale') && !result(candidates,'part.width'),text);
  }
});

test('keeps a typed restriction on a population while changing its specified value',async t=>{
  const reader=createReader();
  t.after(()=>reader.close());
  for (const [text,sort,selector,value,remaining] of [
    ['Make all green plants blue','plant','green','blue',undefined],
    ['paint each of the flowers blue','flower',undefined,'blue',undefined],
    ['Set all of the green plants to the same vivid chartreuse','plant','green','chartreuse','the same vivid'],
  ]) {
    const {candidates}=await reader.propose(text,{evidence:true});
    const reading=candidates.find(candidate=>candidate.source==='native-property-frame' &&
      field(typed(parse(candidate.sop),'target'),'fill')==='all');
    assert.ok(reading,text);
    const wires=parse(reading.sop),target=typed(wires,'target'), constraints=wires.filter(wire=>wire.type==='w.request.constraint');
    assert.equal(field(target,'sort'),sort,text);
    assert.equal(field(target,'quantifier'),'all',text);
    assert.deepEqual(constraints.map(wire=>[field(wire,'attribute'),field(wire,'phase'),field(wire,'value')]),
      [...(selector ? [['drawn.colour','selector',selector]] : []),['drawn.colour','result',value]],text);
    assert.equal(field(typed(wires,'unread'),'text'),remaining,text);
    if (remaining) assert.equal(reading.status,'partial');
    assert.ok(!typed(wires,'lookup'),text);
    assert.deepEqual(reading.evidence.missing,[],text);
    assert.equal(reading.evidence.counts.uncovered ?? 0,0,text);
    assert.deepEqual(reading.catalog.issues,[],text);
  }
  for (const text of [
    'Make all green plant blue',
    'Make all heavy curtains blue',
    'Make all green plants near the house blue',
    'Make all green plants except the small one blue',
    'Make all green plants blue if ready',
    'Were all green plants blue?',
  ]) {
    const {candidates}=await reader.propose(text);
    assert.ok(!native(candidates).some(wires=>field(typed(wires,'target'),'fill')==='all'),text);
  }
});
