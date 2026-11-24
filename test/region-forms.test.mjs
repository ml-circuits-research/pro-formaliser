import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {test} from 'node:test';
import {createReader} from '../src/runtime.mjs';
import {parse} from '../src/schema.mjs';
import {loadWorlds} from '../src/worlds.mjs';
import {nativeNominalPhraseReadings} from '../src/nominal-phrases.mjs';
import {tokens} from '../src/lexicon.mjs';

const field=(wire,name)=>{
  const raw=wire.attrs[name]?.[0];
  return raw?.startsWith('"') ? JSON.parse(raw) : raw;
};
const model={version:1,examples:[],templates:[],lexicon:Object.fromEntries(
  ['seal','corner','edge','lighthouse','goat','part','middle'].map(name=>[name,[['target','make','drawn','new',name,10]]]))};

function owned(candidates,kind,expected) {
  return candidates.flatMap(({sop})=>{
    const wires=parse(sop), target=wires.find(w=>w.type==='w.request.target' &&
      [field(w,'sort'),field(w,'family_words')].includes(kind) && field(w,'mode')==='new');
    if (!target) return [];
    const ref=field(target,'request');
    const local=wires.filter(w=>field(w,'request')===ref);
    const region=local.find(w=>w.type==='w.request.constraint' && field(w,'operator')==='region' &&
      field(w,'value')===expected);
    return region ? [{local,region}] : [];
  });
}

test('reads qualified corners and centred regions without an orphan object lookup',async t=>{
  const reader=createReader(model);
  t.after(()=>reader.close());
  for (const [text,value,span] of [
    ['Draw a seal into the lower right corner','bottom_right','into the lower right corner'],
    ['Draw a seal in the upper-left corner','top_left','in the upper-left corner'],
    ['Draw a seal toward the right edge','right','toward the right edge'],
    ['Draw a seal on the far left','left','on the far left'],
    ['Draw a seal in the bottom part','bottom','in the bottom part'],
    ['Draw a seal right in the middle','middle','right in the middle']
  ]) {
    const {candidates}=await reader.propose(text);
    const clauses=owned(candidates,'seal',value);
    assert.ok(clauses.some(({local,region})=>field(region,'words')===span &&
      !local.some(w=>field(w,'attribute')==='drawn.anchor' || field(w,'constraint'))),text);
    assert.ok(candidates.some(c=>c.sop.includes('drawn.anchor') || c.sop.includes('w.request.unread')),text);
  }
});

test('links a preposed region to the only grounded target in its local packet',()=>{
  const worlds=loadWorlds();
  const text='In the far right part, a goat';
  const sop=[
    '@r w.request.request act=make mood=do',
    '@t w.request.target request=$r family=drawn mode=new determiner=indefinite sort=goat',
    '@m w.request.constraint request=$r on=place attribute=drawn.relation value=in operator=relation phase=result',
    '@a w.request.constraint request=$r on=place attribute=drawn.anchor value="the far right part" operator=relation phase=selector',
    '@l w.request.lookup request=$r constraint=$a key=thing from=page'
  ].join('\n');
  const apply=sop=>nativeNominalPhraseReadings(text,tokens(text),[],{sop},worlds.nominalPositions,worlds);
  assert.ok(owned(apply(sop),'goat','right').some(({local,region})=>
    field(region,'words')==='In the far right part' &&
    !local.some(w=>field(w,'attribute')==='drawn.anchor' || field(w,'constraint'))));
  assert.deepEqual(apply(sop+'\n@x w.request.lookup request=$r constraint=$m key=thing from=page'),[]);
});

test('does not co-opt an object-owned edge, a written name, or a second placement',async t=>{
  const reader=createReader(model);
  t.after(()=>reader.close());
  for (const text of [
    'Draw a seal toward the right edge of the lighthouse',
    'Draw a seal by the lighthouse in the bottom left corner',
    'Draw a seal near “the lower right corner”',
    'Draw a seal in the bottom left corner of the lighthouse',
  ]) {
    const {candidates}=await reader.propose(text);
    assert.deepEqual([...owned(candidates,'seal','bottom_left'),...owned(candidates,'seal','right')],[],text);
  }
});

test('compiles a custom family region from overlay slots with no trainable examples',async t=>{
  const dir=mkdtempSync(fileURLToPath(new URL('../.cache/region-form-overlay-',import.meta.url)));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  writeFileSync(join(dir,'region.sop'),[
    '@lab std.schema.world name=w.workbench',
    '@device std.schema.kind of=w.workbench.device world=w.workbench acts=make',
    '@noun core.word text=quilloscope means=w.workbench.device',
    '@ground core.word text="polar alcove zone" means=w.workbench.device',
    '@zone w.request.key tab=workbench family=device name=device.zone head=class value=north_bay',
    '@anchor w.request.key tab=workbench family=device name=device.anchor head="fill+span"',
    '@relation w.request.key tab=workbench family=device name=device.relation head=class value=in',
    '@spatial pro.reader.spatial tab=workbench family=device relation_key=device.relation anchor_key=device.anchor region_key=device.zone',
    '@bay k.layouts.slot layout=workbench_grid name=north_bay count=one x=0 y=0 w=10 h=10',
    '@reader.region pro.reader.region_form layout=workbench_grid value=north_bay alias="polar alcove" prefix="in the" head=zone'
  ].join('\n'));
  const reader=createReader(undefined,loadWorlds({paths:[dir]}));
  t.after(()=>reader.close());
  const {candidates}=await reader.propose('Make a quilloscope in the polar alcove zone');
  assert.ok(owned(candidates,'quilloscope','north_bay').some(({region})=>field(region,'attribute')==='device.zone'));
});
