import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { tokens } from '../src/lexicon.mjs';
import { createEstimator } from '../src/estimate.mjs';
import { createReader } from '../src/runtime.mjs';
import { parse, validate } from '../src/schema.mjs';
import { spellcheck } from '../src/spell.mjs';
import { loadWorlds } from '../src/worlds.mjs';

test('loads pinned action, language, request key, and domain vocabulary', () => {
  const start = performance.now();
  const worlds = loadWorlds({ paths: [] });
  assert.ok(performance.now() - start < 3000, 'cold world index should load within 3 seconds');
  assert.equal(loadWorlds({ paths: [] }), worlds);
  assert.ok(worlds.knownWords.has('treemap'));
  assert.ok(worlds.lookup('draw').some(entry => entry[0] === 'act' && entry[1] === 'make'));
  assert.deepEqual(worlds.lookup('object', new Set(['make']))
    .filter(entry => entry[0] === 'target' && entry[2] === 'drawn'), [
    ['target', 'make', 'drawn', 'new', '', 0],
  ]);
  assert.ok(worlds.requestKeys.some(key => key.name === 'node.slant' && key.values.includes('italic')));
  assert.equal(worlds.determiners.the, 'definite');
  assert.equal(worlds.joiners.then, 'sequence');
  assert.ok(worlds.negatives.has("n't"));
  assert.ok(worlds.fillerPhrases.has("thank you"));
  assert.ok(!worlds.fillerPhrases.has("then"));
});

test('formalises new domain and key declarations from an overlay without retraining', async t => {
  const cache = fileURLToPath(new URL('../.cache/', import.meta.url));
  const dir = mkdtempSync(join(cache, 'worlds-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, 'domain.sop');
  const source = `
@workbench std.schema.world name=w.workbench
@sample std.schema.kind of=w.workbench.sample world=w.workbench acts=make acts=calibrate
@sample_finish core.slot of=w.workbench.sample key=finish
@sample_word core.word
  text=fluxometer means=w.workbench.sample
@finish_word core.word text="surface finish" means=sample_finish
@surface_type core.type of=w.workbench.finish shared=true
@surface_name core.slot of=w.workbench.finish key=name kind=string
@surface_normalized core.slot of=w.workbench.finish key=normalized kind=atom
@surface_status core.slot of=w.workbench.finish key=status kind=atom
@surface_allowed w.workbench.finish name="fine texture" name=vitrifinish normalized=frosted status=active
@surface_blocked w.workbench.finish name=glintometer normalized=frosted status=retired
@surface_uncited w.workbench.finish name=fluxmottle normalized=frosted status=active
@finishes w.reader.en.binding name=finish_bank cat=VALUE source_type=w.workbench.finish text_key=name source_id=surface_allowed
@active_finish w.reader.en.filter binding=finish_bank key=status value=active
@finish_concept w.reader.en.feature binding=finish_bank key=concept value=sample_finish
@finish_operator w.reader.en.feature binding=finish_bank key=operator value=eq
@finish_value w.reader.en.feature binding=finish_bank key=value from_key=normalized
@finish_key w.request.key tab=workbench family=sample name=sample.finish head=class value=frosted means=sample_finish
@width_key w.request.key tab=workbench family=sample name=sample.aperture head=number means=sample_aperture
@width_slot core.slot of=w.workbench.sample key=aperture kind=number
@width_word core.word text="lens opening" means=sample_aperture
@title_key w.request.key tab=workbench family=sample name=sample.inscription head=span
@calibrate k.actions.act name=calibrate about="check against a reference" role=thing
@trim k.actions.verb text="trim the scale" act=calibrate
@sample_sort pro.reader.target of=w.workbench.sample family=sample sort=fluxmeter mode=existing
`;
  writeFileSync(file, source);
  const worlds = loadWorlds({ paths: [dir] });
  assert.equal(loadWorlds({ paths: [] }).knownWords.has('fluxometer'), false);
  assert.ok(worlds.knownWords.has('fluxometer'));
  assert.ok(worlds.knownWords.has('vitrifinish'));
  assert.ok(!worlds.knownWords.has('glintometer'));
  assert.ok(!worlds.knownWords.has('fluxmottle'));
  assert.ok(!loadWorlds({ paths: [] }).knownWords.has('vitrifinish'));
  assert.equal(spellcheck('vitrifniish', { context: null }).text, 'vitrifniish');
  assert.equal(spellcheck('vitrifniish', { knownWords: worlds.knownWords, context: null }).text, 'vitrifinish');
  assert.deepEqual(worlds.lookup('trim the scale'), [['act', 'calibrate', '', 0]]);
  assert.deepEqual(worlds.lookup('fluxometer', new Set(['calibrate'])), [
    ['target', 'calibrate', 'sample', 'existing', 'fluxmeter', 0],
  ]);
  assert.deepEqual(worlds.lookup('surface finish fine texture'), [
    ['constraint', '*', 'sample',
      'on=attribute attribute="sample.finish" value="frosted" operator=eq phase=result key_words="surface finish" words="fine texture"', 0],
  ]);
  assert.deepEqual(worlds.familyTabs.sample, ['workbench']);
  const estimator = createEstimator(worlds);
  try {
    const candidates = ['drawn','sample'].map(family=>({sop:
      '@r w.request.request act=make predicate=create\n@t w.request.target request=$r family='+family+' mode=new'}));
    for (const context of [{tab:'workbench'},{turns:[{text:'Let us discuss the fluxometer'}]}]) {
      assert.equal((await estimator.estimate(candidates,context)).selectedIndex,1);
    }
  } finally { await estimator.close(); }
  assert.deepEqual(worlds.properties('lens opening'), [
    { family: 'sample', attribute: 'sample.aperture', kind: 'number' },
  ]);
  assert.deepEqual(worlds.properties('inscription'), [
    { family: 'sample', attribute: 'sample.inscription', kind: 'quoted' },
  ]);
  const propertyHits = directPropertyHits(worlds, [
    { text: String.raw`🪐 Lens opening: -19.36, inscription = "A ! \"réplique\""`, allowConstraints: true },
    { text: 'lens opening; 91', allowConstraints: true },
    { text: 'lens opening 99:00', allowConstraints: true },
    { text: 'inscription then "skip"', allowConstraints: true },
    { text: 'inscription "unterminated', allowConstraints: true },
    { text: 'not lens opening 71', allowConstraints: false },
    { text: 'retain "lens opening 71"', allowConstraints: true },
  ]);
  assert.equal(propertyHits[0].length, 2);
  const [numeric, quoted] = propertyHits[0];
  assert.equal(numeric[0], 2);
  assert.equal(numeric[1], 22);
  assert.match(numeric[2][3], /attribute="sample.aperture" value="-19.36".*key_words="Lens opening"$/);
  const [parsed] = parse('@value w.request.constraint ' + quoted[2][3]);
  assert.equal(JSON.parse(parsed.attrs.value[0]), 'A ! "réplique"');
  assert.equal(JSON.parse(parsed.attrs.words[0]), String.raw`"A ! \"réplique\""`);
  assert.deepEqual(propertyHits.slice(1), [[], [], [], [], [], []]);
  assert.ok(validate('@r w.request.request act=calibrate predicate=calibrate', worlds));
  assert.ok(!validate('@r w.request.request act=calibrate predicate=calibrate'));
  const reader = createReader(undefined, worlds);
  try {
    const result = await reader.formalise('trim the scale on the fluxometer surface finish vitrifinish');
    assert.match(result.sop, /act=calibrate/);
    assert.match(result.sop, /family=sample mode=existing/);
    assert.match(result.sop, /value="?frosted"?/);
    assert.match(result.sop, /key_words="surface finish" words="vitrifinish"/);
    const typed = await reader.formalise('trim the scale on the fluxometer lens opening -19.36 inscription "Aurora Pair"');
    assert.match(typed.sop, /attribute="sample.aperture" value="-19.36"/);
    assert.match(typed.sop, /attribute="sample.inscription" value="Aurora Pair"/);
    const quoted = await reader.formalise('trim the scale on the fluxometer inscription "not now!"');
    assert.match(quoted.sop, /attribute="sample.inscription" value="not now!"/);
  } finally {
    await reader.close();
  }
  writeFileSync(file, source.replace('text=fluxometer', 'text=fluxograph').replace(' source_id=surface_allowed', '') + `
@other_number w.request.key tab=workbench family=sample name=sample.secondary head=number means=sample_aperture
@finish_alternate w.request.key tab=workbench family=sample name=sample.finish_extra head=class value=frosted means=sample_finish
`);
  const reloaded = loadWorlds({ paths: [file] });
  assert.ok(!reloaded.knownWords.has('fluxometer'));
  assert.ok(reloaded.knownWords.has('fluxograph'));
  assert.ok(reloaded.knownWords.has('fluxmottle'));
  assert.ok(!reloaded.knownWords.has('glintometer'));
  assert.deepEqual(reloaded.properties('lens opening'), []);
  assert.deepEqual(reloaded.lookup('surface finish vitrifinish'), []);
  assert.deepEqual(reloaded.lookup('vitrifinish'), []);
  assert.ok(reloaded.lookup('finish extra vitrifinish').some(entry => entry[2] === 'sample'));

});

function directPropertyHits(worlds, cases) {
  const url = relative => fileURLToPath(new URL(relative, import.meta.url));
  const examples = cases.map(query => {
    const spans = tokens(query.text);
    const properties = [];
    for (let i = 0; i < spans.length; i++) {
      for (let j = i; j < spans.length; j++) {
        const phrase = spans.slice(i, j + 1).map(([lower]) => lower).join(' ');
        for (const record of worlds.properties(phrase)) properties.push([spans[i][2], spans[j][3], record]);
      }
    }
    return { ...query, properties };
  });
  const output = spawnSync(url('../tools/swipl'), [
    '-q', '-f', 'none', '-s', url('../prolog/properties.pl'),
    '-g', 'use_module(library(readutil)), use_module(library(apply)), read_line_to_string(user_input, Line), properties:atom_json_dict(Line, Payload, []), ' +
      'get_dict(cases, Payload, Cases), maplist(property_constraints, Cases, Results), properties:json_write_dict(current_output, Results)',
    '-t', 'halt',
  ], { input: JSON.stringify({ cases: examples }), encoding: 'utf8' });
  assert.equal(output.status, 0, output.stderr);
  return JSON.parse(output.stdout);
}
