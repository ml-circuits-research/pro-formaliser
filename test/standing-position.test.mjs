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
