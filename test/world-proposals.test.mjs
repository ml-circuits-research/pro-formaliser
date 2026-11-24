import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {World,parse} from '../.cache/knowledge/tools/sopworld/sopworld.mjs';
import {createReader} from '../src/runtime.mjs';
import {loadWorlds} from '../src/worlds.mjs';

const folder=new URL('../sop-worlds/',import.meta.url);
const pinned=new URL('../.cache/knowledge/docs/worlds/',import.meta.url);
const contents=(base,file)=>readFileSync(new URL(file,base),'utf8');
const attr=(wire,key)=>wire.attrs[key]?.[0]?.replace(/^"|"$/g,'');
const moduleName='w.relational';

test('imports additive relational declarations and checks typed references in real request graphs',()=>{
  const library=Object.fromEntries(['k.named','k.actions','w.request'].map(name=>[name,contents(pinned,name+'/schema.sop')]));
  library[moduleName]=contents(folder,moduleName+'/schema.sop');
  const w=new World({library});
  const ok=result=>assert.ok(result.ok,JSON.stringify(result.violations));
  for(const name of ['std.acts','k.actions','w.request',moduleName]) ok(w.use(name));
  ok(w.tell(contents(pinned,'k.actions/shards/acts.sop'),{factsOnly:true}));
  const keys=parse(contents(pinned,'w.request/shards/keys.sop')).filter(wire=>
    ['drawn.colour','node.width','node.height'].includes(attr(wire,'name')));
  ok(w.tell(keys,{factsOnly:true}));
  ok(w.tell(contents(folder,moduleName+'/shards/predicates.sop'),{factsOnly:true}));
  const base='@r w.request.request act=change mood=do\n@t w.request.target request=$r family=drawn mode=existing count=2';
  ok(w.tell(base,{factsOnly:true}));
  const pair='@p w.relational.reciprocal request=$r members=$t predicate=$w.relational.faces words="face each other"';
  ok(w.fork().tell(pair,{factsOnly:true}));
  ok(w.fork().tell('@s w.relational.shared request=$r members=$t property=$w.request.key.drawing.drawn.colour words="the same colour"',{factsOnly:true}));
  const scaled='@x w.relational.scaled request=$r result=$n result_key=$w.request.key.diagram.node.height source=$n source_key=$w.request.key.diagram.node.width source_phase=result factor=2 words="twice the new width"';
  ok(w.tell('@n w.request.target request=$r family=node mode=existing',{factsOnly:true}));
  ok(w.fork().tell(scaled,{factsOnly:true}));
  ok(w.tell('@other w.request.request act=change mood=do\n@single w.request.target request=$r family=drawn mode=existing count=1',{factsOnly:true}));
  for(const invalid of [pair.replace('request=$r','request=$other'),pair.replace('members=$t','members=$single'),
        scaled.replace('source=$n','source=$r'),
        scaled.replace('source_phase=result ',''),
        pair.replace('members=$t','members=$r'),pair.replace('predicate=$w.relational.faces','predicate=$t'),
        scaled.replace('source_phase=result','source_phase=later'),scaled.replace('factor=2','factor=twice')]){
    assert.equal(w.fork().tell(invalid,{factsOnly:true}).ok,false,invalid);
  }
});

test('the staged vocabulary supplies only scoped canonical property values through the public reader',async t=>{
  const vocab=new URL('vocabulary/',folder);
  const reader=createReader(undefined,loadWorlds({paths:[fileURLToPath(vocab)]}));
  t.after(()=>reader.close());
  const forms=[
    ['the route of the link','link.route','curvy','curved'],
    ['the route of the link','link.route','right-angled','orthogonal'],
    ['the route of the link','link.route','straight-line','straight'],
    ['the style of the link','link.style','dash pattern','dashed'],
    ['the style of the link','link.style','dot pattern','dotted'],
    ['the alignment of the paragraph','block.align','flush left','left'],
    ['the alignment of the paragraph','block.align','flush right','right'],
    ['the alignment of the paragraph','block.align','fully justified','justify'],
  ];
  for(const [owner,key,surface,value] of forms){
    const input='Set '+owner+' to '+surface;
    const out=await reader.propose(input);
    assert.ok(out.candidates.some(c=>parse(c.sop).some(w=>attr(w,'attribute')===key && attr(w,'phase')==='result' &&
      attr(w,'value')===value && attr(w,'words')===surface)),input);
  }
});

test('loads the staged native grammar and applies it to different property owners',async t=>{
  const path=fileURLToPath(new URL('language/',folder));
  const grammar=contents(folder,'language/property-frames.sop');
  const lang=new World({library:{'w.lang.en':contents(pinned,'w.lang.en/schema.sop')}});
  assert.ok(lang.use('w.lang.en').ok);
  const loaded=lang.tell(grammar,{factsOnly:true});
  assert.ok(loaded.ok,JSON.stringify(loaded.violations));
  const reader=createReader(undefined,loadWorlds({paths:[path]}));
  t.after(()=>reader.close());
  for(const [text,key,assigned] of [
    ['What width does the node have?','node.width'],
    ['What style does the link have?','link.style'],
    ['Set the width on the node to 15','node.width','15'],
    ['Set the style on the link to dotted','link.style','dotted'],
  ]){
    const {candidates}=await reader.propose(text);
    assert.ok(candidates.some(c=>c.source==='native-property-frame' && parse(c.sop).some(w=>
      assigned ? attr(w,'attribute')===key && attr(w,'value')===assigned : attr(w,'asked')===key)),text);
  }
});
