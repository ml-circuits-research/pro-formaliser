import assert from 'node:assert/strict';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';
import {loadWorlds} from '../src/worlds.mjs';
import {createReader} from '../src/runtime.mjs';
import {parse} from '../src/schema.mjs';

test('attaches the written visibility cue to the value of either polarity',async t=>{
  const path=fileURLToPath(new URL('../sop-worlds/visibility-pilot',import.meta.url));
  const reader=createReader(undefined,loadWorlds({paths:[path]}));
  t.after(()=>reader.close());
  for (const [text,property,cue,value] of [
    ['Switch the gridlines on','gridlines','on','show'],
    ['Switch the gridlines off','gridlines','off','hide'],
    ['Ditch the legend','legend','Ditch','hide'],
  ]) {
    const {candidates}=await reader.propose(text,{evidence:true});
    const match=candidates.find(c=>c.source==='contextual-effects' && parse(c.sop).some(w=>
      w.attrs.key_words?.[0]===JSON.stringify(property) &&
      w.attrs.words?.[0]===JSON.stringify(cue) && w.attrs.value?.[0]===value));
    assert.ok(match,text);
    assert.deepEqual(match.evidence.missing,[]);
  }
  const {candidates}=await reader.propose('Switch the gridlines on or off');
  assert.ok(candidates.every(c=>c.source!=='contextual-effects'));
});
