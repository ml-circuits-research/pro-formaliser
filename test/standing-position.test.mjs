import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createReader} from '../src/runtime.mjs';
import {parse} from '../src/schema.mjs';

const get=(wire,key)=>{
  const raw=wire.attrs[key]?.[0];
  return raw?.startsWith('"') ? JSON.parse(raw) : raw;
};

test('grounds the specified position and exact standing scope on the written existing owner',async t=>{
  const reader=createReader({version:1,examples:[],templates:[],lexicon:{
    tree:[['target','change','drawn','existing','tree',1]],
    girl:[['target','change','drawn','existing','girl',1]],
  }});
  t.after(()=>reader.close());
  for (const [text,family,owner,attribute,scope,region,denied,unread] of [
    ['In every picture the rule is simple: the tree stays on the left.','drawn','the tree','drawn.at',
      'In every picture','left'],
    ['From here on in, have the girl stay on the left side, never on the right, just so, in our little drawing.',
      'drawn','the girl','drawn.at','From here on in','left','right','just so, in our little drawing'],
    ['From now on, the node must stay on the right.','node','the node','node.at','From now on','right'],
  ]) {
    const {candidates}=await reader.propose(text,{evidence:true});
    const candidate=candidates.find(c=>c.source==='standing-position' && parse(c.sop).some(w=>
      w.type==='w.request.target' && get(w,'family')===family && get(w,'description')===owner &&
      get(w,'mode')==='existing'));
    assert.ok(candidate,text);
    const wires=parse(candidate.sop), request=wires.find(w=>w.type==='w.request.request');
    const owned=wires.filter(w=>w.type==='w.request.constraint' && get(w,'request')==='$'+request.id);
    assert.ok(owned.some(w=>get(w,'attribute')==='preference.scope' && get(w,'value')===scope));
    assert.ok(owned.some(w=>get(w,'attribute')===attribute && get(w,'value')===region && get(w,'want')!=='no'));
    assert.deepEqual(owned.filter(w=>get(w,'want')==='no').map(w=>get(w,'value')),denied ? [denied] : []);
    assert.deepEqual(wires.filter(w=>w.type==='w.request.unread').map(w=>get(w,'text')),unread ? [unread] : []);
    assert.ok(owned.every(w=>!get(w,'attribute').endsWith('.keep')));
    assert.deepEqual(candidate.evidence.missing,[]);
    assert.deepEqual(candidate.catalog.issues,[]);
    assert.ok(!candidate.evidence.counts.uncovered);
  }

  for (const text of [
    'From now on, the node stays put.',
    'From now on, the node does not stay on the right.',
    'From now on, the node should stay on the right?',
    'From now on, the node should stay on the left if approved.',
    'From now on, the node stays on the left, never on the right, if approved.',
    'From now on, the node stays on the left, never on the left.',
    'Label the node "from now on, the node stays on the right".',
  ]) assert.ok((await reader.propose(text)).candidates.every(c=>c.source!=='standing-position'),text);
});

test('keeps written trailing scope on the existing placement and proves the following creation independently',async t=>{
  const reader=createReader({version:1,examples:[],templates:[],lexicon:{
    stays:[['act','place','do',10]], circle:[['target','make','drawn','new','circle',10]],
  }});
  t.after(()=>reader.close());
  const lead='The node stays below the box — from now on';
  const closing="and that's it for this part of the picture";
  const text=lead+', and a small circle up top — '+closing;
  const {candidates}=await reader.propose(text,{evidence:true});
  const matched=candidates.find(c=>c.source==='trailing-standing-position' &&
    parse(c.sop).filter(w=>w.type==='w.request.request').length===2);
  assert.ok(matched);
  const wires=parse(matched.sop), [place,make]=wires.filter(w=>w.type==='w.request.request');
  const fields=(r,k)=>wires.filter(w=>get(w,'request')==='$'+r.id && get(w,'attribute')===k);
  assert.deepEqual(fields(place,'preference.scope').map(w=>get(w,'value')),['from now on']);
  assert.deepEqual(fields(place,'node.position').map(w=>[get(w,'value'),get(w,'phase')]),[['below','result']]);
  assert.deepEqual(fields(place,'node.anchor').map(w=>[get(w,'value'),get(w,'phase')]),[['the box','selector']]);
  assert.equal(get(make,'act'),'make');
  assert.equal(get(make,'predicate'),undefined);
  assert.deepEqual(fields(make,'drawn.at').map(w=>get(w,'value')),['top']);
  assert.deepEqual(fields(make,'drawn.size').map(w=>get(w,'value')),['small']);
  assert.equal(fields(make,'drawn.direction').length,0);
  assert.equal(fields(make,'preference.scope').length,0);
  assert.deepEqual(wires.filter(w=>w.type==='w.request.unread').map(w=>[get(w,'request'),get(w,'text')]),
    [['$'+make.id,closing]]);
  assert.ok(!wires.some(w=>w.type==='w.request.intent'));
  assert.deepEqual(matched.evidence.missing,[]);
  assert.deepEqual(matched.catalog.issues,[]);
  assert.ok(!matched.evidence.counts.uncovered);

  const lone=await reader.propose(lead);
  assert.ok(lone.candidates.some(c=>c.source==='trailing-standing-position' && c.status==='matched'));
  for (const unsafe of [lead+' if approved', 'Quote "'+lead+'"', lead+'?',
    'The node does not stay below the box — from now on',
  ]) assert.ok((await reader.propose(unsafe)).candidates.every(c=>c.source!=='trailing-standing-position'),unsafe);
});
