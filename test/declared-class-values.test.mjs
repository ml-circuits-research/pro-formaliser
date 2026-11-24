import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createFormaliser } from '../src/formaliser.mjs';
import { loadWorlds } from '../src/worlds.mjs';

test('binds declared values of a bankless class through exact key and slot identities', async t => {
  const cache = fileURLToPath(new URL('../.cache/', import.meta.url));
  const dir = mkdtempSync(join(cache, 'class-values-'));
  t.after(() => rmSync(dir, {recursive:true, force:true}));
  writeFileSync(join(dir, 'class.sop'), `
@workbench std.schema.world name=w.workbench
@specimen std.schema.kind of=w.workbench.specimen world=w.workbench acts=make
@neighbor std.schema.kind of=w.workbench.neighbor world=w.workbench acts=make
@sample_word core.word text=quillometer means=w.workbench.specimen
@sample_size core.slot of=w.workbench.specimen key=size kind=number
@neighbor_size core.slot of=w.workbench.neighbor key=size kind=number
@mix_key w.request.key tab=workbench family=specimen name=specimen.size head="number+class+step" means=sample_size
@other_key w.request.key tab=workbench family=neighbor name=neighbor.size head="number+class+step" means=neighbor_size
@slot_value core.word text="hand held" means=pocket of=sample_size
@bare_size core.word text="size label" means=sample_size
@special_example demo.class text="table top" value=bench
@short_example demo.class text="bench top" value=bench
@generic_example demo.class text="very tall" value=giant
@project w.reader.en.binding name=slot_project cat=VALUE source_type=demo.class text_key=text source_id=special_example
@project_value w.reader.en.feature binding=slot_project key=value from_key=value
@project_operator w.reader.en.feature binding=slot_project key=operator value=eq
@project_concept w.reader.en.feature binding=slot_project key=concept value=sample_size
@exact w.reader.en.binding name=exact_project cat=VALUE source_type=demo.class text_key=text source_id=short_example
@exact_value w.reader.en.feature binding=exact_project key=value from_key=value
@exact_operator w.reader.en.feature binding=exact_project key=operator value=eq
@exact_key w.reader.en.feature binding=exact_project key=attribute value=specimen.size
@generic w.reader.en.binding name=generic_project cat=VALUE source_type=demo.class text_key=text source_id=generic_example
@generic_value w.reader.en.feature binding=generic_project key=value from_key=value
@generic_operator w.reader.en.feature binding=generic_project key=operator value=eq
@generic_key w.reader.en.feature binding=generic_project key=concept value=size
`);
  const worlds = loadWorlds({paths:[dir]});
  const constraints = text => worlds.lookup(text).filter(([role]) => role === 'constraint');
  for (const [surface, value] of [['hand held', 'pocket'], ['table top', 'bench'], ['bench top', 'bench']]) {
    const [entry, extra] = constraints(surface);
    assert.equal(extra, undefined);
    assert.equal(entry[2], 'specimen');
    assert.ok(entry[3].includes('attribute="specimen.size" value="' + value + '"'));
    assert.ok(entry[3].includes('words="' + surface + '"'));
  }
  assert.deepEqual(constraints('very tall'), []);
  assert.deepEqual(constraints('size label'), []);
  assert.deepEqual(worlds.properties('size label'), [
    {family:'specimen', attribute:'specimen.size', kind:'number'},
  ]);
  const formaliser = createFormaliser(undefined, worlds);
  try {
    const result = await formaliser.formalise('Make a hand held quillometer');
    assert.ok(result.candidates.some(({sop}) => sop.includes('attribute="specimen.size" value=pocket') &&
      sop.includes('words="hand held"')));
  } finally {
    await formaliser.close();
  }
});
