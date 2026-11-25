import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { createReader } from '../src/reader.mjs';
import { parse } from '../src/schema.mjs';

const positive='Give me a scatter plot of heater load and fuel consumption';
const pronoun='Set its width to 12';
const unknown='quibblo zentaflu';
const final='Draw a triangle';
const historyText=/\bw\.request\.(?:previous|history)\b|\bfrom="?previous\b/u;

function assertResult(result,text) {
  assert.equal(result.engine,'prolog');
  assert.equal(result.text,text);
  assert.ok(Array.isArray(result.candidates));
  assert.ok(Array.isArray(result.unresolved));
  assert.ok(result.candidates.every(candidate=>typeof candidate.sop==='string' &&
    !historyText.test(candidate.sop)));
}

function assertVariants(result) {
  const fields=result.candidates.map(candidate=>parse(candidate.sop)
    .filter(wire=>wire.type==='w.request.constraint').map(wire=>[wire.attrs.attribute?.[0],wire.attrs.value?.[0]].join('=')));
  for (const field of ['heater load','fuel consumption']) {
    assert.ok(fields.some(constraints=>constraints.includes('"chart.xField"="'+field+'"')));
  }
}

test('shared library exposes real Prolog proposals and keeps unresolved input visible', async t=>{
  const reader=await createReader({worldsOnly:true});
  t.after(()=>reader.close());
  const first=await reader.propose(positive);
  assertResult(first,positive);
  assert.equal(first.error,null);
  assertVariants(first);
  const reference=await reader.propose(pronoun);
  assertResult(reference,pronoun);
  assert.equal(reference.error,null);
  assert.ok(reference.candidates.length || reference.unresolved.length);
  const missing=await reader.propose(unknown);
  assertResult(missing,unknown);
  assert.equal(missing.error,null);
  assert.ok(missing.unresolved.length);
  assert.match((await reader.propose({text:positive,previous:'Draw a house'})).error,/string/u);
});

test('default batch works from another directory, loads one model and continues after errors',{
  skip:!existsSync(new URL('../.cache/model.json',import.meta.url)) && 'The optional trained model is not installed',
},()=>{
  const cli=fileURLToPath(new URL('../bin/formalise.mjs',import.meta.url));
  const probe=encodeURIComponent(`
    import fs from 'node:fs/promises';
    import { syncBuiltinESMExports } from 'node:module';
    const read=fs.readFile;
    fs.readFile=(path,...args)=>{
      if (String(path).endsWith('/.cache/model.json')) process.stderr.write('default-model-read\\n');
      return read(path,...args);
    };
    syncBuiltinESMExports();
  `);
  const inputs=[
    JSON.stringify({text:positive}), JSON.stringify({text:pronoun}), '',
    JSON.stringify({text:unknown}), '{"text":',
    ...['previous','history','context','clock'].map(key=>JSON.stringify({text:positive,[key]:'unsupported'})),
    JSON.stringify({text:final}),
  ];
  const env={...process.env};
  delete env.SOP_WORLDS;
  const ran=spawnSync(process.execPath,['--import','data:text/javascript,'+probe,cli,'--batch'],{
    cwd:tmpdir(),env,encoding:'utf8',input:inputs.join('\n')+'\n',maxBuffer:8*1024*1024,
  });
  assert.equal(ran.status,0,ran.stderr);
  assert.equal(ran.stderr.trim(),'default-model-read');
  const results=ran.stdout.trimEnd().split('\n').map(line=>JSON.parse(line));
  const expected=[positive,pronoun,unknown,null,positive,positive,positive,positive,final];
  assert.equal(results.length,expected.length);
  for (const [i,text] of expected.entries()) assertResult(results[i],text);
  for (const result of results.slice(0,3)) assert.equal(result.error,null);
  assert.ok(results[2].unresolved.length);
  assertVariants(results[0]);
  for (const result of results.slice(3,-1)) assert.ok(result.error && !result.candidates.length);
  assert.equal(results.at(-1).error,null);
  assert.ok(results.at(-1).candidates.length);
});
