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
    'What is the width of the node?',
  ]) {
    const answer=await reader.propose(text);
    assert.deepEqual(native(answer.candidates),[],text);
  }
});

test('reads fresh native frame and catalog roles in an overlay',async t=>{
  const dir=mkdtempSync(fileURLToPath(new URL('../.cache/native-prop-',import.meta.url)));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  writeFileSync(join(dir,'controls.sop'),[
    '@studio std.schema.world name=w.studio',
    '@module std.schema.kind of=w.studio.module world=w.studio acts=change',
    '@fixture core.word text=goniometer means=w.studio.module',
    '@sampling w.request.key tab=studio family=module name=module.samples head=number',
    '@w.studio.module.response core.slot of=w.studio.module key=response enum=linear enum=logarithmic',
    '@response w.request.key tab=studio family=module name=module.response head=class value=linear value=logarithmic means=w.studio.module.response',
    '@alias core.word text=log means=logarithmic of=w.studio.module.response',
    '@affect k.actions.verb text=reassign act=change complement=value',
    '@frame w.lang.en.frame name=lab.assign act=change mode=set needs=attrs role=attribute role=thing role=value',
    '@v w.lang.en.part frame=lab.assign at=1 is=verb act=change',
    '@p w.lang.en.part frame=lab.assign at=2 is=role role=attribute takes=lexicon lexicon=attribute',
    '@link w.lang.en.part frame=lab.assign at=3 is=word word=within',
    '@o w.lang.en.part frame=lab.assign at=4 is=role role=thing takes=words',
    '@to w.lang.en.part frame=lab.assign at=5 is=word word=to',
    '@value w.lang.en.part frame=lab.assign at=6 is=role role=value takes=words',
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
});
