import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createReader } from '../src/runtime.mjs';
import { loadWorlds } from '../src/worlds.mjs';
import { evidenceInText } from '../src/grounding.mjs';
import { parse, validate } from '../src/schema.mjs';

const filler=text=>'@f w.request.filler text='+JSON.stringify(text);
const model=utterances=>({version:1,templates:[],lexicon:{},examples:utterances.map(text=>({text,sop:filler(text),count:1}))});
const coverage=async (reader,text)=>(await reader.propose(text)).candidates
  .filter(candidate=>candidate.source==='dialogue-coverage');

test('keeps complete social turns as effect-free text through the public generator',async t=>{
  const worlds=loadWorlds({paths:['sop-worlds']});
  const reader=createReader(model([
    'Well, thats great, thank you.', 'Oh, thats nice, cheers.', 'Thanks, thats good.',
  ]),worlds);
  t.after(()=>reader.close());
  for (const text of [
    'Hello!', 'Okay, many thanks; goodbye.', "Take care, that's all.",
    "Thank you, I’m happy with it.", 'Cheers, thats perfect.',
  ]) {
    const [candidate]=await coverage(reader,text);
    assert.ok(candidate,text);
    assert.deepEqual(parse(candidate.sop).map(wire=>wire.type),['w.request.filler']);
    assert.equal(JSON.parse(parse(candidate.sop)[0].attrs.text[0]),text);
    assert.ok(validate(candidate.sop,worlds));
    assert.ok(evidenceInText(text,candidate.sop,worlds));
  }
  for (const text of [
    'Yes', 'No', 'Not sure yet.', "Thanks, that's the one.", 'Thank you, take the second one.',
    'Thanks, could you remove it?', "Thanks, don't erase it.", 'Cheers. Add a blue dot.',
    'Thank you, can you check Tuesday?', 'Never mind, keep it as is.',
    'Great, leave it like that.', 'Name the tag "Thank you".', "That's all I want there.",
    'Thank you, I am happy with the red one.',
  ]) assert.deepEqual(await coverage(reader,text),[],text);
});

test('requires independent filler examples before accepting a missing apostrophe',async t=>{
  const worlds=loadWorlds({paths:['sop-worlds']});
  const reader=createReader(model(['Well, thats great.', 'Thats fine, thank you.']),worlds);
  t.after(()=>reader.close());
  assert.deepEqual(await coverage(reader,'Cheers, thats perfect.'),[]);
  assert.equal((await coverage(reader,"Cheers, that's perfect.")).length,1);
});
