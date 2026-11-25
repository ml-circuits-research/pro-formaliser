import assert from 'node:assert/strict';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';
import {createReader} from '../src/runtime.mjs';
import {loadWorlds} from '../src/worlds.mjs';
import {parse,validate} from '../src/schema.mjs';
import {serialize,str} from '../.cache/knowledge/tools/sopworld/sopworld.mjs';

const path=fileURLToPath(new URL('../sop-worlds/w.relational/',import.meta.url));
const get=(wire,key)=>str(wire.attrs[key]?.[0]);
const pairType='w.relational.landmark_pair';

test('links an affected item to two independently looked-up landmarks',async t=>{
  const worlds=loadWorlds({paths:[path]});
  const reader=createReader(undefined,worlds), base=createReader(undefined,loadWorlds({paths:[]}));
  t.after(()=>Promise.all([reader.close(),base.close()]));
  const text='Next move it midway between Red Dock and Green Valley.';
  const baseline=await base.propose(text);
  const result=await reader.propose(text,{evidence:true});
  assert.ok(baseline.candidates.every(c=>result.candidates.some(next=>next.sop===c.sop)));
  const midpoint=result.candidates.find(c=>c.source==='landmark-pair' &&
    parse(c.sop).some(w=>get(w,'attribute')==='node.position'));
  assert.ok(midpoint);
  assert.deepEqual(midpoint.evidence.missing,[]);
  assert.equal(midpoint.evidence.counts.uncovered,undefined);
  assert.deepEqual(midpoint.catalog.issues,[]);
  const wires=parse(midpoint.sop);
  const pair=wires.find(w=>w.type===pairType);
  assert.equal(get(pair,'mode'),'midpoint');
  const targets=wires.filter(w=>w.type==='w.request.target');
  assert.equal(targets.length,1);
  assert.equal(get(pair,'affected'),'$'+targets[0].id);
  for (const [key,name] of [['first','Red Dock'],['second','Green Valley']]) {
    const selector=get(pair,key);
    assert.ok(wires.some(w=>'$'+w.id===selector && get(w,'value')===name && get(w,'phase')==='selector'));
    assert.ok(wires.some(w=>get(w,'constraint')===selector && get(w,'from')==='page'));
  }
  assert.ok(validate(serialize(wires.toReversed()),worlds));
  const other=parse(midpoint.sop);
  other.push({id:'unrelated',type:'w.request.request',attrs:{act:['place']}});
  const foreign=other.find(w=>'$'+w.id===get(pair,'second'));
  foreign.attrs.request=['$unrelated'];
  assert.equal(validate(serialize(other),worlds),false);
  const duplicate=parse(midpoint.sop);
  const relation=duplicate.find(w=>w.type===pairType);
  relation.attrs.second=relation.attrs.first;
  assert.equal(validate(serialize(duplicate),worlds),false);
});

test('admits only explicit landmark selectors with their own page lookup and a catalogued anchor key',async t=>{
  const worlds=loadWorlds({paths:[path]});
  const reader=createReader(undefined,worlds);
  t.after(()=>reader.close());
  const {candidates}=await reader.propose('Next move it midway between Red Dock and Green Valley.');
  const candidate=candidates.find(c=>c.source==='landmark-pair' &&
    parse(c.sop).some(w=>get(w,'attribute')==='node.position'));
  assert.ok(candidate);
  const native=worlds.validationModules.bindActs(worlds.acts);
  const nativeAccepts=wires=>native.fork().tell(wires,{factsOnly:true,strict:true}).ok;
  assert.ok(nativeAccepts(parse(candidate.sop).reverse()));

  const withChangedSelector=(role,change)=>{
    const wires=parse(candidate.sop);
    const pair=wires.find(w=>w.type===pairType);
    const selector=wires.find(w=>'$'+w.id===get(pair,role));
    const lookup=wires.find(w=>get(w,'constraint')===get(pair,role));
    change(wires,selector,lookup);
    return wires;
  };
  const structuralFailures=[
    ['missing phase', (_w,selector)=>delete selector.attrs.phase],
    ['result phase', (_w,selector)=>{selector.attrs.phase=['result'];}],
    ['wrong role', (_w,selector)=>{selector.attrs.on=['attribute'];}],
    ['missing lookup', (w,_selector,lookup)=>w.splice(w.indexOf(lookup),1)],
    ['wrong lookup scope', (_w,_selector,lookup)=>{lookup.attrs.from=['any'];}],
    ['lookup from another request', (w,_selector,lookup)=>{
      w.push({id:'unrelated',type:'w.request.request',attrs:{act:['place']}});
      lookup.attrs.request=['$unrelated'];
    }],
  ];
  const catalogFailures=[
    ['ordinary property', (_w,selector)=>{selector.attrs.attribute=['node.colour'];}],
    ['anchor for another family', (_w,selector)=>{selector.attrs.attribute=['drawn.anchor'];}],
    ['empty landmark', (_w,selector)=>{selector.attrs.value=['" "'];}],
  ];
  for (const role of ['first','second']) {
    for (const [name,change] of structuralFailures) {
      const wires=withChangedSelector(role,change);
      assert.equal(nativeAccepts(wires),false,role+': '+name);
      assert.equal(validate(serialize(wires),worlds),false,role+': '+name);
    }
    for (const [name,change] of catalogFailures) {
      const wires=withChangedSelector(role,change);
      assert.equal(validate(serialize(wires),worlds),false,role+': '+name);
    }
  }
});

test('keeps the ordinary interval and requires affirmative placement with two named or grounded anchors',async t=>{
  const reader=createReader(undefined,loadWorlds({paths:[path]}));
  t.after(()=>reader.close());
  const result=await reader.propose('Could you place them between Harbour and Marina?');
  assert.ok(result.candidates.some(c=>c.source==='landmark-pair' &&
    parse(c.sop).some(w=>w.type===pairType && get(w,'mode')==='between')));
  for (const text of [
    'Move it midway between Deploy or Plan.',
    'Move it midway between Deploy and Deploy.',
    'Move it midway between Deploy and remove Plan.',
    'Move it midway between Deploy and Plan and Review.',
    'Move it midway between the qqq and the zzz.',
    'Do not move it midway between Deploy and Plan.',
    'If it fits, move it midway between Deploy and Plan.',
    'Is it between Deploy and Plan?',
    'Remove it between Deploy and Plan.',
    'Rename it "between Deploy and Plan".',
  ]) {
    const {candidates}=await reader.propose(text);
    assert.ok(candidates.every(c=>c.source!=='landmark-pair'),text);
  }
});
