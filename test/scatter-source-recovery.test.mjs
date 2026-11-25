import assert from 'node:assert/strict';
import test from 'node:test';
import { createReader } from '../src/runtime.mjs';
import { parse } from '../src/schema.mjs';

const value=(wire,key)=>{
  const written=wire.attrs[key]?.[0];
  return written?.startsWith('"') ? JSON.parse(written) : written;
};

async function readings(reader,text) {
  const {candidates}=await reader.propose(text);
  return candidates.map(({sop,status})=>{
    const wires=parse(sop);
    const properties=Object.fromEntries(wires.filter(wire=>wire.type==='w.request.constraint')
      .map(wire=>[value(wire,'attribute'),value(wire,'value')]));
    const unread=wires.filter(wire=>wire.type==='w.request.unread').map(wire=>value(wire,'text'));
    return {properties,unread,status};
  });
}

test('keeps known measure wording as a scatter axis field and as a prenominal measure',async t=>{
  const reader=createReader();
  t.after(()=>reader.close());
  const scatter=await readings(reader,
    'Draw a scatter plot of order count against delivery delay shown together, coloured by depot');
  assert.ok(scatter.some(({properties})=>properties['chart.yField']==='order count' &&
    properties['chart.xField']==='delivery delay' && properties['chart.colourBy']==='depot' &&
    properties['chart.compare']==='overlay'));
  const measure=await readings(reader,'Make an order value chart');
  assert.ok(measure.some(({properties})=>properties['chart.measure']==='order value'));
});

test('keeps both scatter role connectors and trailing courtesy outside the purpose',async t=>{
  const reader=createReader();
  t.after(()=>reader.close());
  const text='So, give me a scatter plot of order value against margin shown together, coloured by channel for the client call, please';
  const {candidates}=await reader.propose(text,{evidence:true});
  assert.ok(candidates.some(candidate=>{
    if (candidate.status!=='matched' || candidate.evidence.missing.length || candidate.evidence.counts.uncovered ||
        candidate.evidence.counts.unread) return false;
    const wires=parse(candidate.sop);
    return wires.some(w=>value(w,'attribute')==='chart.xField' && value(w,'key_words')==='against') &&
      wires.some(w=>value(w,'attribute')==='chart.colourBy' && value(w,'key_words')==='coloured by') &&
      wires.some(w=>w.type==='w.request.intent' && value(w,'value')==='the client call') &&
      wires.some(w=>w.type==='w.request.filler' && value(w,'text')==='please');
  }));
});

test('retains both axis readings and binds supported configuration after an unknown phrase',async t=>{
  const reader=createReader();
  t.after(()=>reader.close());
  const scatter=await readings(reader,'Draw a scatter plot of heater load and fuel consumption '+
    'with uncertainty bands, with gridlines behind it, with the y axis starting at zero');
  for (const [x,y] of [['heater load','fuel consumption'],['fuel consumption','heater load']]) {
    assert.ok(scatter.some(({properties,unread,status})=>properties['chart.xField']===x &&
      properties['chart.yField']===y && properties['chart.grid']==='show' && properties['chart.min']==='0' &&
      status==='partial' && unread.length===1 && unread[0]==='with uncertainty bands'));
  }
});

test('keeps explicit settings on the created chart and does not guess other axes or conflicting bounds',async t=>{
  const reader=createReader();
  t.after(()=>reader.close());
  const base='Draw a scatter plot of ad spend against revenue';
  const supported=await readings(reader,base+
    ', with a regression line, with the legend on the right, with the y axis ending at nine');
  assert.ok(supported.some(({properties,unread,status})=>properties['chart.xField']==='revenue' &&
    properties['chart.yField']==='ad spend' && properties['chart.trendLine']==='show' &&
    properties['chart.legend']==='right' && properties['chart.max']==='9' && status==='matched' && !unread.length));
  for (const suffix of [
    'with the x axis starting at zero, with gridlines behind it',
    'with the y axis starting at zero, with the y axis starting at one, with gridlines behind it',
    'with the y axis starting at 1,000, with gridlines behind it',
  ]) {
    const data=await readings(reader,base+', '+suffix);
    assert.ok(data.some(({properties,unread})=>properties['chart.grid']==='show' &&
      properties['chart.min']===undefined && unread.length===1),suffix);
  }
});

test('keeps speech boundaries, axis titles, and page coordinates out of source fields',async t=>{
  const reader=createReader();
  t.after(()=>reader.close());
  for (const text of [
    'Draw a scatter plot of heater load and delete the diagram',
    'Do not draw a scatter plot of heater load and fuel consumption',
    'Draw a scatter plot of heater load and fuel consumption if approved',
    'Draw a scatter plot of heater load and "fuel consumption"',
    'Set the x axis label on the chart to Fuel',
    'Move the chart left',
  ]) {
    const data=await readings(reader,text);
    assert.ok(data.every(({properties})=>!properties['chart.xField'] && !properties['chart.yField']),text);
  }
  const titled=await readings(reader,'Draw a scatter plot of heater load and fuel draw label the y axis Sales');
  const fields=titled.filter(({properties})=>properties['chart.xField']);
  assert.ok(fields.length);
  assert.ok(fields.every(({properties,unread})=>[properties['chart.xField'],properties['chart.yField']]
    .every(field=>['heater load','fuel draw'].includes(field)) && unread.includes('label the y axis Sales')));
});
