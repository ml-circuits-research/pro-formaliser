import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createFormaliser } from '../src/formaliser.mjs';
import { parse } from '../src/schema.mjs';
import { createNominalInflection } from '../src/nominal-inflection.mjs';
import { loadWorlds } from '../src/worlds.mjs';

const nounFacts = parse(`
@singular_y w.lang.en.inflect op=singular set=lemma order=1 suffix=ies replace=y
@singular_esh w.lang.en.inflect op=singular set=lemma order=2 suffix=ches suffix=shes suffix=xes drop=2
@singular_s w.lang.en.inflect op=singular set=lemma order=3 suffix=s unless_suffix=ss unless_suffix=us drop=1
@plural_y w.lang.en.inflect op=plural order=1 drop=1 add=ies suffix=y after=consonant
@plural_es w.lang.en.inflect op=plural order=2 suffix=s suffix=x suffix=ch suffix=sh add=es
@plural_s w.lang.en.inflect op=plural order=3 add=s
@person w.lang.en.irregular singular=person plural=people
@wolf w.lang.en.irregular singular=wolf plural=wolves
@axe w.lang.en.irregular singular=axe plural=axes
@axis w.lang.en.irregular singular=axis plural=axes
@hoof w.lang.en.irregular_form lemma=hoof form=hooves num=pl variant=yes
`);
const inflected = createNominalInflection(type => nounFacts.filter(wire => wire.type === type));
const target = sort => ['target','make','thing','new',sort,0];

test('reads native regular and irregular noun inflections at the end of a compound', () => {
  const nouns = new Set(['ferry','oak box','person','wolf','hoof']);
  const lookup = lemma => nouns.has(lemma) ? [target(lemma)] : [];
  assert.deepEqual(inflected('ferries',lookup), [target('ferry')]);
  assert.deepEqual(inflected('oak boxes',lookup), [target('oak box')]);
  assert.deepEqual(inflected('people',lookup), [target('person')]);
  assert.deepEqual(inflected('wolves',lookup), [target('wolf')]);
  assert.deepEqual(inflected('hooves',lookup), [target('hoof')]);
  assert.deepEqual(inflected('oak boxes x2',lookup), []);
});

test('requires a licensed lemma and retains independent senses for that lemma', () => {
  const lookup = lemma => [target(lemma), ['act','change','',0]];
  assert.deepEqual(inflected('axes',lookup), []);
  assert.deepEqual(inflected('axes',lemma => lemma === 'axis' ? lookup(lemma) : []), [target('axis')]);
  assert.deepEqual(inflected('boxes',lemma => [['act','change','',0]]), []);
  assert.deepEqual(inflected('blue houses',lemma => lemma === 'blue house'
    ? [target(lemma),['target','make','drawing','new','house',0]] : []),
  [target('blue house'),['target','make','drawing','new','house',0]]);
  assert.deepEqual(inflected('bus',lookup), []);
});

test('keeps the original lexical proposal and adds the exact plural evidence', async t => {
  const dir = mkdtempSync(fileURLToPath(new URL('../.cache/morphology-', import.meta.url)));
  t.after(() => rmSync(dir, {recursive:true,force:true}));
  writeFileSync(join(dir,'kind.sop'), [
    '@workbench std.schema.world name=w.workbench',
    '@device std.schema.kind of=w.workbench.device world=w.workbench acts=make',
    '@tool core.word text=velocitrix means=w.workbench.device',
    '@thing pro.reader.target of=w.workbench.device family=device sort=velocitrix',
  ].join('\n'));
  const formaliser = createFormaliser(undefined,loadWorlds({paths:[dir]}));
  try {
    const {candidates} = await formaliser.formalise('Make two Velocitrixes');
    assert.equal(candidates[0].source,'lexicon');
    const alternate = candidates.find(candidate => candidate.source === 'nominal-inflection');
    assert.match(alternate?.sop ?? '',/family=device .*sort=velocitrix sort_words=Velocitrixes/u);
    assert.ok(candidates.some(candidate => candidate.sop.includes('sort_words=Velocitrixes count=2 quantity="two"')));
    const quoted = await formaliser.formalise('Make "Velocitrixes"');
    assert.ok(!quoted.candidates.some(candidate => candidate.source === 'nominal-inflection'));
  } finally { await formaliser.close(); }
});
