import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { catalogIssues } from '../src/catalog.mjs';
import { dependentOperandReadings } from '../src/dependent-operands.mjs';
import { evidenceInText } from '../src/grounding.mjs';
import { createReader } from '../src/runtime.mjs';
import { parse, validate } from '../src/schema.mjs';
import { loadWorlds } from '../src/worlds.mjs';

const q=JSON.stringify;
const field=(wire,slot)=>{
  const raw=wire?.attrs[slot]?.[0];
  return raw?.startsWith('"') ? JSON.parse(raw) : raw;
};
const valid=(candidate,text,worlds)=>{
  assert.ok(candidate,text);
  assert.ok(validate(candidate.sop,worlds));
  assert.ok(evidenceInText(text,candidate.sop,worlds));
  const wires=parse(candidate.sop);
  assert.deepEqual(catalogIssues(wires,worlds),[]);
  return wires;
};
const fixture=({family,sort,predicate,place,effect,value,act='change',extra=''})=>[
  '@r w.request.request act='+act+' mood=do predicate='+q(predicate),
  '@t w.request.target request=$r family='+family+' mode=existing fill=description sort='+q(sort),
  '@u w.request.unread request=$r text='+q(place),
  ...(effect ? ['@e w.request.constraint request=$r on=attribute attribute='+effect+
    ' value='+q(value)+' operator=eq phase=result'] : []),
  extra,
].filter(Boolean).join('\n');
const cases=[
  ['ok turn the trunk on the tree upright',{family:'part',sort:'trunk',predicate:'turn',place:'on the tree',
    effect:'part.turn',value:'upright'},'part.owner','the tree','selector','matched','drawing'],
  ['change the trunk of the tree to orange',{family:'part',sort:'trunk',predicate:'change',place:'of the tree',
    effect:'part.colour',value:'orange'},'part.owner','the tree','selector','matched','drawing'],
  ['it looks odd, spin the chimney on a house upright',{family:'part',sort:'chimney',predicate:'looks',place:'on a house',
    effect:'part.turn',value:'upright'},'part.owner','a house','selector','partial','drawing'],
  ['make the link into Done dotted',{family:'link',sort:'link',predicate:'make',place:'into Done',
    effect:'link.style',value:'dotted'},'link.to','Done','selector','matched','diagram'],
  ['move the meeting onto Work',{family:'meeting',sort:'meeting',predicate:'move',place:'onto Work',
    act:'place'},'meeting.calendar','Work','result','matched','calendar'],
];

test('public reader binds native typed hosts before independently supported effects and result operands',async t=>{
  const worlds=loadWorlds();
  const examples=cases.map(([text,donor])=>({text,sop:fixture(donor),count:1}));
  const reader=createReader({version:1,examples,templates:[]},worlds);
  t.after(()=>reader.close());
  for (const [text,donor,attribute,operand,phase,status] of cases) {
    const {candidates}=await reader.propose(text);
    const reading=candidates.find(item=>item.source==='dependent-operand');
    const wires=valid(reading,text,worlds);
    const related=wires.find(wire=>field(wire,'attribute')===attribute);
    assert.equal(field(related,'value'),operand,text);
    assert.equal(field(related,'phase'),phase,text);
    assert.ok(wires.some(wire=>field(wire,'constraint')==='$'+related.id && field(wire,'from')==='page'),text);
    if (donor.effect) assert.ok(wires.some(wire=>field(wire,'attribute')===donor.effect &&
      field(wire,'phase')==='result' && field(wire,'value')===donor.value),text);
    assert.equal(reading.status,status,text);
    if (status==='partial') {
      assert.equal(field(wires.find(wire=>wire.type==='w.request.request'),'predicate'),'spin');
      assert.ok(wires.some(wire=>field(wire,'text')==='it looks odd'));
    }
  }
});

test('rejects untyped target/host pairs, unproven effects, restricted scope, and invented name extents',()=>{
  const worlds=loadWorlds(), unguarded=()=>true;
  for (const [text,fields] of [
    ['turn the trunk on the house upright',{family:'part',sort:'trunk',predicate:'turn',place:'on the house',effect:'part.turn',value:'upright'}],
    ['turn the trunk on the tree upright',{family:'part',sort:'trunk',predicate:'turn',place:'on the tree'}],
    ['turn the trunk on the tree sideways',{family:'part',sort:'trunk',predicate:'turn',place:'on the tree',effect:'part.turn',value:'upright'}],
    ['turn the trunk on the tree upright if safe',{family:'part',sort:'trunk',predicate:'turn',place:'on the tree',effect:'part.turn',value:'upright'}],
    ['do not turn the trunk on the tree upright',{family:'part',sort:'trunk',predicate:'turn',place:'on the tree',effect:'part.turn',value:'upright'}],
    ['make the link into "Done" dotted',{family:'link',sort:'link',predicate:'make',place:'into "Done"',effect:'link.style',value:'dotted'}],
    ['move the meeting onto the new one',{family:'meeting',sort:'meeting',predicate:'move',place:'onto the new one',act:'place'}],
  ]) assert.deepEqual(dependentOperandReadings(text,{sop:fixture(fields)},worlds,unguarded),[],text);
});

test('uses a third-party typed slot, item/host facts and independently bound effect',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'dependent-operands-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  writeFileSync(join(dir,'workbench.sop'),[
    '@bench std.schema.world name=w.workbench',
    '@kind std.schema.kind of=w.workbench.hatch world=w.workbench acts=change',
    '@native.host core.slot of=w.workbench.hatch key=host type=w.workbench.cabinet',
    '@selector w.request.key family=hatch name=hatch.host head=span means=native.host',
    '@finish w.request.key family=hatch name=hatch.finish head=class value=satin value=glossy',
    '@pair w.workbench.structure child=hatch parent=cabinet',
    '@rule pro.reader.dependent_operand family=hatch act=change attribute=hatch.host range=w.workbench.cabinet phase=selector marker=of item_type=w.workbench.structure item_field=child peer_field=parent',
    '@wrong w.request.key family=hatch name=hatch.incompatible head=span means=native.host',
    '@bad pro.reader.dependent_operand family=hatch act=change attribute=hatch.incompatible range=w.workbench.desk phase=selector marker=of item_type=w.workbench.structure item_field=child peer_field=parent',
  ].join('\n'));
  const worlds=loadWorlds({paths:[dir]});
  assert.equal(worlds.dependentOperands.filter(rule=>rule.family==='hatch').length,1);
  const text='make the hatch of the cabinet satin';
  const sop=fixture({family:'hatch',sort:'hatch',predicate:'make',place:'of the cabinet',effect:'hatch.finish',value:'satin'});
  const reader=createReader({version:1,examples:[{text,sop,count:1}],templates:[]},worlds);
  t.after(()=>reader.close());
  const {candidates}=await reader.propose(text);
  const reading=candidates.find(item=>item.source==='dependent-operand');
  const wires=valid(reading,text,worlds,'workbench');
  assert.ok(wires.some(wire=>field(wire,'attribute')==='hatch.host' && field(wire,'value')==='the cabinet'));
});
