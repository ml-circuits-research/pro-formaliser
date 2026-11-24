import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createReader} from '../src/runtime.mjs';
import {train} from '../src/model.mjs';
import {parse} from '../src/schema.mjs';

test('uses the declared comparative sense of a verb on a written instance',async t=>{
  const r=createReader();t.after(()=>r.close());
  const {candidates}=await r.propose('widen n4');
  assert.ok(candidates.some(c=>c.source==='verb-effect' && c.sop.includes('ids="n4"') &&
    c.sop.includes('attribute=node.width') && c.sop.includes('step=more')));
  const forbidden=await r.propose('do not widen n4');
  assert.ok(!forbidden.candidates.some(c=>c.source==='verb-effect'));
});

test('learns a property entailed by the verb across distinct objects and rejects conflicting evidence',async t=>{
  const row=(id,v)=>({text:'dash '+id,sop:[
    '@r w.request.request act=change mood=do predicate=dash',
    '@t w.request.target request=$r family=link mode=existing ids='+id+' fill=written',
    '@c w.request.constraint request=$r on=attribute attribute=link.style value='+v+' words=dash operator=eq phase=result',
  ].join('\n')});
  const examples=[row('e2','dashed'),row('e3','dashed')];
  const model=train(examples);
  assert.deepEqual(model.verbEffects,[['dash','change','link','link.style','dashed']]);
  const r=createReader(model);t.after(()=>r.close());
  const {candidates}=await r.propose('dash e7');
  assert.ok(candidates.some(c=>parse(c.sop).some(w=>w.attrs.attribute?.includes('link.style')) &&
    c.sop.includes('e7') && c.sop.includes('dashed')));
  assert.deepEqual(train([...examples,row('e5','dotted')]).verbEffects,[]);
});
