import assert from 'node:assert/strict';
import test from 'node:test';
import { loadWorlds } from '../src/worlds.mjs';
import { namedTargetReading } from '../src/target-names.mjs';
import { evidenceInText } from '../src/grounding.mjs';
import { parse } from '../src/schema.mjs';
import { createFormaliser } from '../src/formaliser.mjs';

const worlds=loadWorlds();

test('copied multiword designations do not add code selectors without written code evidence',async t=>{
  const inputs=[
    ['Change Revenue by region.','chart','Revenue by region','Revenue by region',false],
    ['Change the chart with code "Revenue by region".','chart','Revenue by region','Revenue by region',true],
    ['Change the chart with identifier: "Revenue by region".','chart','Revenue by region','Revenue by region',true],
    ['Change the chart "Revenue by region" with code c1.','chart','Revenue by region','c1',true],
    ['Change the "code" report Revenue by region.','chart','Revenue by region','Revenue by region',false],
    ['Change Project Review.','meeting','Project Review','Project Review',false],
    ['Change c1.','chart','c1','c1',true],
  ];
  const examples=inputs.map(([text,family,name,code])=>({text,count:1,sop:[
    '@r w.request.request act=change mood=do predicate=Change words='+JSON.stringify(text),
    '@r.t w.request.target request=$r family='+family+' mode=existing fill=written name='+JSON.stringify(name),
    '@r.c w.request.constraint request=$r on=attribute attribute='+family+'.id value='+JSON.stringify(code)+
      ' operator=eq phase=selector',
  ].join('\n')}));
  const reader=createFormaliser({version:1,examples,templates:[]},worlds);
  t.after(()=>reader.close());
  for (const [text,family,name,code,keep] of inputs) {
    const {candidates}=await reader.formalise(text);
    const inherited=candidates.find(candidate=>candidate.source==='example');
    assert.ok(inherited,text);
    const wires=parse(inherited.sop);
    const target=wires.find(wire=>wire.type==='w.request.target');
    assert.equal(JSON.parse(target.attrs.name[0]),name,text);
    assert.equal(wires.some(wire=>wire.type==='w.request.constraint' &&
      wire.attrs.attribute?.includes(family+'.id') && wire.attrs.value?.includes(JSON.stringify(code))),keep,text);
    assert.ok(evidenceInText(text,inherited.sop,worlds),text);
  }
});

test('repairing a copied code leaves independently composed evidence intact',async t=>{
  const first='Set the bin count on Order values to ten.';
  const second='Move the y axis to the right.';
  const text=first+' '+second;
  const count=[
    '@a w.request.request act=change mood=do predicate=Set words='+JSON.stringify(first),
    '@a.t w.request.target request=$a family=chart mode=existing fill=written name="Order values"',
    '@a.bins w.request.constraint request=$a on=attribute attribute=chart.bins value=10 words=ten key_words="bin count" phase=result',
  ];
  const axis=[
    '@b w.request.request act=change mood=do predicate=Move words='+JSON.stringify(second),
    '@b.t w.request.target request=$b family=chart mode=existing fill=context',
    '@b.axis w.request.constraint request=$b on=attribute attribute=chart.axisSide value=right key_words="y axis" phase=result',
  ];
  const inherited=[
    ...count,...axis,
    '@a.code w.request.constraint request=$a on=attribute attribute=chart.id value="Order values" phase=selector',
    '@a.unread w.request.unread request=$a text="bin count on Order values to ten"',
  ];
  const examples=[[first,count],[second,axis],[text,inherited]].map(([text,lines])=>
    ({text,sop:lines.join('\n'),count:1}));
  const reader=createFormaliser({version:1,examples,templates:[]},worlds);
  t.after(()=>reader.close());
  const {candidates}=await reader.formalise(text);
  assert.ok(candidates.some(c=>c.source==='example' && !c.sop.includes('chart.id')));
  assert.ok(candidates.some(c=>c.source==='sentence-requests' && !c.sop.includes('w.request.unread') &&
    c.sop.includes('chart.bins') && c.sop.includes('chart.axisSide')));
});

function bind(text, unread) {
  return namedTargetReading(text,{source:'lexicon',sop:[
    '@r w.request.request act=change predicate=reverse',
    '@t w.request.target request=$r mode=existing family=link sort=connection',
    '@u w.request.unread request=$r text='+JSON.stringify(unread),
  ].join('\n')},worlds);
}
test('binds a written name adjacent to its noun before lookup',()=>{
  for (const [text,name] of [['reverse connection z19','z19'],['reverse the Harbor West connection','Harbor West']]) {
    const proposal=bind(text,name);
    assert.ok(proposal.sop.includes('name='+JSON.stringify(name)));
    assert.ok(evidenceInText(text,proposal.sop,worlds));
  }
  assert.equal(bind('reverse connection later','later'),undefined);
  assert.equal(bind('reverse connection to Harbor West','Harbor West'),undefined);
});

const decoded = (wire, key) => JSON.parse(wire.attrs[key][0]);

function lexicon(predicate, unread, description) {
  const sop = [
    '@r w.request.request act=change predicate=' + JSON.stringify(predicate),
    '@r.t w.request.target request=$r family=drawn mode=existing fill=description sort=block' +
      (description ? ' description=' + JSON.stringify(description) : ''),
    ...unread.map((text, index) => '@r.u' + index + ' w.request.unread request=$r text=' + JSON.stringify(text)),
  ].join('\n');
  return {source: 'lexicon', sop, status: 'partial'};
}

test('replaces a generic description and preserves an existing qualified one', () => {
  const text = 'Move the Mercedes block.';
  const proposal = namedTargetReading(text, lexicon('Move', ['the Mercedes'], 'the block'), worlds);
  const target = parse(proposal.sop).find(w => w.type === 'w.request.target');
  assert.equal(decoded(target, 'name'), 'Mercedes');
  assert.equal(target.attrs.description, undefined);
  assert.equal(namedTargetReading(text, lexicon('Move', ['the Mercedes'], 'the Mercedes block'), worlds),
    undefined);
});

const tests = [
  {
    text: 'the Mercedes block same column as the HP block, one row below the BMW block',
    predicate: 'same',
    unread: ['the Mercedes', 'as the HP block,', 'below the BMW block'],
    description: 'the Mercedes block',
  },
  {
    text: 'could you slide block 19 between the first and second blocks, one space down of the centre',
    predicate: 'could',
    unread: ['you slide', '19', 'the first and second blocks, one space', 'of the centre'],
    description: 'block 19',
  },
];

for (const {text, predicate, unread, description} of tests) {
  test('qualifies the typed target as ' + description, () => {
    const candidate = lexicon(predicate, unread);
    const repaired = namedTargetReading(text, candidate, worlds);
    assert.ok(repaired);
    const wires = parse(repaired.sop);
    const target = wires.find(w => w.type === 'w.request.target');
    assert.equal(decoded(target, 'description'), description);
    assert.equal(target.attrs.name, undefined);
    assert.equal(target.attrs.ids, undefined);
    assert.deepEqual(wires.filter(w => w.type === 'w.request.unread').map(w => decoded(w, 'text')),
      unread.filter(span => !description.includes(span)));
    assert.equal(parse(candidate.sop).find(w => w.type === 'w.request.target').attrs.description, undefined);
  });
}

test('requires a unique written qualifier and a spatial boundary for bare numbers', () => {
  assert.equal(namedTargetReading('Move the Mercedes block near the BMW block.',
    lexicon('Move', ['the Mercedes', 'the BMW']), worlds), undefined);
  assert.equal(namedTargetReading('Move the block 19 pixels left.',
    lexicon('Move', ['19', 'pixels left']), worlds), undefined);
  assert.equal(namedTargetReading('Move the spare block left.',
    lexicon('Move', ['the spare', 'left']), worlds), undefined);
  assert.equal(namedTargetReading('Move the block near the BMW block.',
    lexicon('Move', ['near', 'the BMW']), worlds), undefined);
});
