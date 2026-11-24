import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createReader } from '../src/runtime.mjs';
import { parse } from '../src/schema.mjs';
import { loadWorlds } from '../src/worlds.mjs';

const decode=raw=>raw?.startsWith('"') ? JSON.parse(raw) : raw;
const first=(wire,key)=>decode(wire?.attrs[key]?.[0]);

test('native region cues follow grounded local properties, including authored hyphenation', async t=>{
  const dir=mkdtempSync(join(fileURLToPath(new URL('../.cache/',import.meta.url)),'region-native-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const file=join(dir,'region.sop');
  writeFileSync(file,'@fixture.left w.lang.en.cue name=fixture.left on=place relation=at takes=none value=left lead="on the left-hand side"');
  const worlds=loadWorlds({paths:[file]});
  const reader=createReader({
    version:1,examples:[],templates:[],
    lexicon:{girl:[['target','make','drawn','new','girl',10]]},
  },worlds);
  t.after(()=>reader.close());

  function regionReadings(result) {
    return result.candidates.flatMap(candidate=>{
      const wires=parse(candidate.sop);
      const girl=wires.find(w=>w.type==='w.request.target' && first(w,'sort')==='girl' && first(w,'mode')==='new');
      if (!girl) return [];
      const ref=first(girl,'request');
      const request=wires.find(w=>'$'+w.id===ref);
      if (first(request,'act')!=='make') return [];
      const properties=new Map(wires.filter(w=>w.type==='w.request.constraint' && first(w,'request')===ref)
        .map(w=>[first(w,'attribute'),w]));
      return properties.has('drawn.at') ? [properties] : [];
    });
  }
  const input='Draw a girl sad facing right on the left-hand side.';
  const readings=regionReadings(await reader.propose(input));
  assert.ok(readings.some(props=>first(props.get('drawn.expression'),'value')==='sad' &&
    first(props.get('drawn.facing'),'value')==='right' && first(props.get('drawn.at'),'value')==='left' &&
    first(props.get('drawn.at'),'words')==='on the left-hand side'));

  for (const blocked of [
    'Draw a girl near the tree on the left-hand side.',
    'Draw a girl sad facing right; on the left-hand side.',
  ]) assert.deepEqual(regionReadings(await reader.propose(blocked)),[],blocked);
});
