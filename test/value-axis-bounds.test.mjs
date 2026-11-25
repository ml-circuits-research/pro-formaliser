import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createReader} from '../src/reader.mjs';
import {parse} from '../src/schema.mjs';

function field(wire, key) {
  const raw=wire.attrs[key]?.[0];
  return raw?.startsWith('"') ? JSON.parse(raw) : raw;
}

test('reads value-axis bounds as result constraints on one existing chart', async t => {
  const reader=await createReader({worldsOnly:true,evidence:true});
  t.after(()=>reader.close());
  for (const [text,predicate,bounds] of [
    ['Start the y axis at zero.', 'Start the y axis at', [['chart.min','0','zero']]],
    ['Begin the value axis at -2.5.', 'Begin the value axis at', [['chart.min','-2.5','-2.5']]],
    ['End the y-axis at nine.', 'End the y-axis at', [['chart.max','9','nine']]],
    ['Make the y axis range zero to 100.', 'Make the y axis range', [
      ['chart.min','0','zero'], ['chart.max','100','100'],
    ]],
    ['Set the y axis range from zero to 0.', 'Set the y axis range from', [
      ['chart.min','0','zero'], ['chart.max','0','0'],
    ]],
    ['Set the value axis range between -4 and twenty.', 'Set the value axis range between', [
      ['chart.min','-4','-4'], ['chart.max','20','twenty'],
    ]],
    ['Start the y axis at five and stop at 50.', 'Start the y axis at', [
      ['chart.min','5','five'], ['chart.max','50','50'],
    ]],
    ['Start the y axis at 0 and cap it at 200.', 'Start the y axis at', [
      ['chart.min','0','0'], ['chart.max','200','200'],
    ]],
    ['Could you make the y axis end at nine?', 'make the y axis end at', [['chart.max','9','nine']]],
    ['Also can you make the y axis range 0 to 10?', 'make the y axis range', [
      ['chart.min','0','0'], ['chart.max','10','10'],
    ]],
  ]) {
    const result=await reader.propose(text);
    assert.equal(result.error,null,text);
    assert.equal(result.engine,'prolog');
    const reading=result.candidates.find(candidate=>candidate.source==='argument-frame' &&
      candidate.status==='matched' && parse(candidate.sop).some(wire=>field(wire,'predicate')===predicate));
    assert.ok(reading,text);
    assert.deepEqual(reading.evidence.missing,[],text);
    assert.equal(reading.evidence.counts.unread ?? 0,0,text);
    assert.equal(reading.evidence.counts.uncovered ?? 0,0,text);
    assert.deepEqual(reading.catalog.issues,[],text);

    const wires=parse(reading.sop);
    const requests=wires.filter(wire=>wire.type==='w.request.request');
    const targets=wires.filter(wire=>wire.type==='w.request.target');
    const lookups=wires.filter(wire=>wire.type==='w.request.lookup');
    assert.equal(requests.length,1,text);
    assert.equal(targets.length,1,text);
    assert.equal(lookups.length,1,text);
    const [request]=requests;
    const [target]=targets;
    const [lookup]=lookups;
    assert.equal(field(request,'act'),'change',text);
    assert.equal(field(request,'mood'),'do',text);
    assert.equal(field(request,'words'),text);
    assert.equal(field(target,'family'),'chart',text);
    assert.equal(field(target,'mode'),'existing',text);
    assert.equal(field(target,'fill'),'context',text);
    assert.equal(field(target,'name'),undefined,text);
    assert.equal(field(target,'description'),undefined,text);
    assert.equal(field(target,'ids'),undefined,text);
    assert.equal(field(lookup,'from'),'page',text);
    assert.equal(field(lookup,'target'),'$'+target.id,text);
    assert.ok(wires.every(wire=>!wire.attrs.request || field(wire,'request')==='$'+request.id),text);
    assert.ok(wires.every(wire=>!['w.request.previous','w.request.history'].includes(wire.type)),text);
    const constraints=wires.filter(wire=>wire.type==='w.request.constraint');
    assert.deepEqual(constraints.map(wire=>[
      field(wire,'attribute'),field(wire,'value'),field(wire,'words') ?? field(wire,'value'),
    ]),bounds,text);
    assert.ok(constraints.every(wire=>field(wire,'phase')==='result' &&
      field(wire,'operator')==='eq' && !wire.attrs.unit),text);
  }
});

test('guards value-axis frames against unsupported scopes, targets and ranges', async t => {
  const reader=await createReader({worldsOnly:true});
  t.after(()=>reader.close());
  for (const text of [
    'Start the x axis at zero.',
    'If approved, start the y axis at zero.',
    'Start the y axis at zero if approved.',
    'Do not start the y axis at zero.',
    'Did you start the y axis at zero?',
    'Start the y axis at zero?',
    'Label the chart "start the y axis at zero".',
    'Start the y axis on the sales chart at zero.',
    'Start the y axis at zero metres.',
    'Make the y axis range 10^1 to 10^6.',
    'Make the y axis range 100 to zero.',
    'Start the y axis at 50 and stop at five.',
    'Make the y axis range zero to.',
  ]) {
    const result=await reader.propose(text);
    assert.equal(result.error,null,text);
    assert.ok(result.candidates.filter(candidate=>candidate.source==='argument-frame').every(candidate=>
      parse(candidate.sop).every(wire=>!['chart.min','chart.max'].includes(field(wire,'attribute')))),text);
  }
});
