import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createReader} from '../src/runtime.mjs';
import {parse} from '../src/schema.mjs';
import {loadWorlds} from '../src/worlds.mjs';

const read = (wire, key) => {
  const value = wire.attrs[key]?.[0];
  return value?.startsWith('"') ? JSON.parse(value) : value;
};

test('the default reader keeps categorical roles and rendering settings on the created chart', async t => {
  const reader = createReader(undefined, loadWorlds({paths: []}));
  t.after(() => reader.close());
  const readCharts = async text => {
    const {candidates} = await reader.propose(text, {evidence: true});
    return candidates.flatMap(candidate => {
      if (candidate.status !== 'matched' || candidate.evidence.counts.uncovered ||
        candidate.evidence.missing.length || candidate.catalog.issues.length) return [];
      const wires = parse(candidate.sop);
      const request = wires.find(wire => wire.type === 'w.request.request' && read(wire, 'act') === 'make');
      if (!request) return [];
      const owns = wire => read(wire, 'request') === '$' + request.id;
      const constraints = wires.filter(wire => wire.type === 'w.request.constraint' && owns(wire));
      const values = Object.fromEntries(constraints.map(wire => [read(wire, 'attribute'), read(wire, 'value')]));
      const purpose = wires.find(wire => wire.type === 'w.request.intent' && owns(wire) && read(wire, 'role') === 'purpose');
      return [{values, purpose: purpose && read(purpose, 'value')}];
    });
  };

  const explicit = await readCharts('Build a clustered column chart of returns by district, split by store type, with the legend on the left.');
  assert.ok(explicit.some(({values}) => values['chart.measure'] === 'returns' &&
    values['chart.dimension'] === 'district' && values['chart.seriesDimension'] === 'store type' &&
    values['chart.stacking'] === 'none' && values['chart.orientation'] === 'vertical' &&
    values['chart.legend'] === 'left'));

  const ambiguous = await readCharts('Draw a stacked bar chart of returns by district and store type for the monthly audit.');
  for (const [dimension, series] of [['district', 'store type'], ['store type', 'district']]) {
    assert.ok(ambiguous.some(({values, purpose}) => values['chart.dimension'] === dimension &&
      values['chart.seriesDimension'] === series && purpose === 'the monthly audit'));
  }
  assert.ok(ambiguous.every(({values}) => !['chart.dimension', 'chart.seriesDimension'].some(key =>
    values[key]?.includes('monthly audit'))));
});

test('resumes a declared rendering effect after a purpose without changing its owner or evidence', async t => {
  const reader=createReader(undefined,loadWorlds({paths:[]}));
  t.after(()=>reader.close());
  for (const [text,key,value] of [
    ['Make a grouped bar chart of average profit broken down by ship mode and customer segment for the summary slide, with the values printed on the marks','chart.show_values','show'],
    ['Make a stacked column chart of revenue by category and segment for the summary slide, and put the legend on the right','chart.legend','right'],
  ]) {
    const {candidates}=await reader.propose(text,{evidence:true});
    const relevant=candidates.filter(c=>c.source==='request-intent');
    assert.ok(relevant.every(c=>parse(c.sop).filter(w=>w.type==='w.request.intent')
      .every(w=>read(w,'value')==='the summary slide')),text);
    assert.ok(relevant.some(c=>{
      if (c.status!=='matched' || c.evidence.missing.length || c.evidence.counts.unread || c.evidence.counts.uncovered) return false;
      const wires=parse(c.sop), requests=wires.filter(w=>w.type==='w.request.request');
      if (requests.length!==1 || read(requests[0],'words')!==text) return false;
      const owner='$'+requests[0].id;
      return wires.some(w=>w.type==='w.request.intent' && read(w,'request')===owner &&
        read(w,'words')==='for the summary slide') &&
        wires.some(w=>read(w,'request')===owner && read(w,'attribute')===key && read(w,'value')===value);
    }),text);
  }
});
