import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { catalogIssues } from '../src/catalog.mjs';
import { evidenceInText } from '../src/grounding.mjs';
import { createPredicateTransfer } from '../src/predicate-transfer.mjs';
import { parse, validate } from '../src/schema.mjs';
import { loadWorlds } from '../src/worlds.mjs';

const worlds=loadWorlds();
function supported(text,candidate,knowledge=worlds) {
  assert.ok(validate(candidate.sop,knowledge),candidate.sop);
  assert.ok(evidenceInText(text,candidate.sop,knowledge),candidate.sop);
  assert.deepEqual(catalogIssues(parse(candidate.sop),knowledge),[]);
}

test('retrieves a typed ordered placement by the exact argument tail',()=>{
  const source={
    text:'I need you to move CV 2026 after Experience. I appreciate it.',
    sop:'@f w.request.filler text=need\n'+
      '@r w.request.request act=place mood=do words="move CV 2026 after Experience" predicate=move\n'+
      '@t w.request.target request=$r family=section mode=existing fill=written name="CV 2026"\n'+
      '@c w.request.constraint request=$r on=place attribute=section.order value=after operator=relation phase=result\n'+
      '@a w.request.constraint request=$r on=place attribute=section.order_anchor value=Experience operator=eq phase=result',
  };
  const read=createPredicateTransfer([source],worlds);
  const text='Please, put CV 2026 after Experience. Thanks!';
  const [candidate]=read(text);
  supported(text,candidate);
  assert.match(candidate.sop,/predicate="put"/u);
  assert.match(candidate.sop,/name="CV 2026"/u);
  assert.match(candidate.sop,/attribute=section\.order_anchor value=Experience/u);
  assert.match(candidate.sop,/w\.request\.filler text="Please"/u);
  assert.match(candidate.sop,/w\.request\.filler text="Thanks"/u);
  assert.doesNotMatch(candidate.sop,/text=need/u);
  for (const input of [
    'Put CV 2026 before Experience','Put CV 2025 after Experience','Did you put CV 2026 after Experience?',
    'Do not put CV 2026 after Experience','Don’t put CV 2026 after Experience',
    'Put CV 2026 after Experience Thanks','Put CV 2026 after Experience if the heading exists',
  ]) assert.deepEqual(read(input),[],input);
});

test('transfers compatible removal heads and prevents cross-action or coarse-change reuse',()=>{
  const read=createPredicateTransfer([
    {text:'get rid of the node n4',sop:'@r w.request.request act=remove mood=do predicate="get rid of"\n'+
      '@t w.request.target request=$r family=node mode=existing fill=written family_words=node ids=n4'},
    {text:'change the node n4 to blue',sop:'@r w.request.request act=change mood=do predicate=change\n'+
      '@t w.request.target request=$r family=node mode=existing fill=written family_words=node ids=n4\n'+
      '@c w.request.constraint request=$r on=attribute attribute=node.colour value=blue operator=eq phase=result'},
  ],worlds);
  const text='Delete the node n4.';
  const [candidate]=read(text);
  supported(text,candidate);
  assert.match(candidate.sop,/act=remove mood=do predicate="Delete"/u);
  assert.deepEqual(read('Make the node n4.'),[]);
  assert.deepEqual(read('Update the node n4 to blue'),[]);
  assert.deepEqual(read('Delete the node n4 to blue'),[]);
});

test('requires a matching frame tail before carrying a mode shared by declared predicates',t=>{
  const dir=mkdtempSync(fileURLToPath(new URL('../.cache/predicate-transfer-test-',import.meta.url)));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const overlay=join(dir,'frame.sop');
  writeFileSync(overlay,`
@f w.lang.en.frame name=test.retune act=change mode=retune role=thing
@head w.lang.en.part frame=test.retune at=1 is=word word=retune word="dial over"
@object w.lang.en.part frame=test.retune at=2 is=role role=thing takes=words
@end w.lang.en.part frame=test.retune at=3 is=word word=directly
`);
  const knowledge=loadWorlds({paths:[overlay]});
  const sop='@r w.request.request act=change mode=retune mood=do predicate=retune\n'+
    '@t w.request.target request=$r family=chart mode=existing family_words=chart';
  const read=createPredicateTransfer([{text:'retune the chart directly',sop},
    {text:'retune the chart soon',sop}],knowledge);
  const [candidate]=read('Dial over the chart directly');
  supported('Dial over the chart directly',candidate,knowledge);
  assert.match(candidate.sop,/act=change mode=retune mood=do predicate="Dial over"/u);
  assert.deepEqual(read('Dial over the chart soon'),[]);
});
