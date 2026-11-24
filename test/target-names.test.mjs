import assert from 'node:assert/strict';
import test from 'node:test';
import { loadWorlds } from '../src/worlds.mjs';
import { namedTargetReading } from '../src/target-names.mjs';
import { evidenceInText } from '../src/grounding.mjs';

const worlds=loadWorlds();
function bind(text, unread) {
  return namedTargetReading(text,{source:'lexicon',sop:[
    '@r w.request.request act=change predicate=reverse',
    '@t w.request.target request=$r mode=existing family=link sort=connection',
    '@u w.request.unread request=$r text='+JSON.stringify(unread),
  ].join('\n')},worlds);
}
test('binds a written name adjacent to its noun before lookup',()=>{
  for (const [text,name] of [['reverse connection z19','z19'],['reverse the Harbor West connection','Harbor West']]) {
    const proposal=bind(text,name);
    assert.ok(proposal.sop.includes('name='+JSON.stringify(name)));
    assert.ok(evidenceInText(text,proposal.sop,worlds));
  }
  assert.equal(bind('reverse connection later','later'),undefined);
  assert.equal(bind('reverse connection to Harbor West','Harbor West'),undefined);
});
