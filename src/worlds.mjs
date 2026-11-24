import { readFileSync, readdirSync, statSync } from 'node:fs';
import { delimiter, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, quote, str } from '../.cache/knowledge/tools/sopworld/sopworld.mjs';
import { tokens } from './lexicon.mjs';

const pinned = fileURLToPath(new URL('../.cache/knowledge/docs/worlds/', import.meta.url));
const types = new Set([
  'core.word', 'std.schema.world', 'std.schema.kind', 'core.slot',
  'k.actions.act', 'k.actions.verb', 'k.actions.role', 'w.request.key', 'pro.reader.target', 'pro.reader.spatial',
  'w.lang.en.det', 'w.lang.en.prep', 'w.lang.en.pron', 'w.lang.en.anaphor', 'w.lang.en.joiner', 'w.lang.en.neg', 'w.lang.en.skip',
  'w.reader.en.binding', 'w.reader.en.feature', 'w.reader.en.filter',
]);
const wireStart = /^[\t ]*[@?][^\s]+[\t ]+([^\s#]+)/gm;
const values = (wire, key) => (wire.attrs[key] ?? []).map(str);
const one = (wire, key) => str(wire.attrs[key]?.[0]);
const phrase = text => tokens(text).map(([lower]) => lower).join(' ');
const label = value => value.replaceAll('_', ' ');
let baseFacts;
let baseWorlds;

function* worldFiles(dir, overlay) {
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
    const file = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!entry.name.startsWith('.') && !['preview', 'node_modules'].includes(entry.name)) {
        yield* worldFiles(file, overlay);
      }
    } else if (entry.isFile() && extname(entry.name) === '.sop') {
      if (overlay || entry.name === 'schema.sop' || dir.endsWith('/shards')) yield file;
    }
  }
}

function readFacts(file, selectedTypes) {
  const text = readFileSync(file, 'utf8');
  try {
    if (!selectedTypes) return parse(text);
    // Pinned shards start each wire on a fresh line. Read complete declarations
    // for the types used here and leave out unrelated geometry and glosses.
    const selected = [];
    let start;
    for (const match of text.matchAll(wireStart)) {
      if (start !== undefined) selected.push(text.slice(start, match.index));
      start = selectedTypes.has(match[1]) ? match.index : undefined;
    }
    if (start !== undefined) selected.push(text.slice(start));
    return selected.length ? parse(selected.join('\n')) : [];
  } catch (cause) {
    throw new Error(`Cannot read SOP world ${file}: ${cause.message}`, { cause });
  }
}

function index(map, key, entry) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(entry);
}

function isEnglish(wire) {
  const languages = values(wire, 'lang');
  if (languages.length) return languages.some(lang => /^en(?:[-_]|$)/i.test(lang));
  return !/^w\.lang\.(?!en\.)/.test(wire.id);
}

function determination(wire) {
  const kind = one(wire, 'kind');
  const definite = one(wire, 'definite');
  if (kind === 'article' && definite) return definite === 'yes' ? 'definite' : 'indefinite';
  if (kind === 'numeral' || kind === 'quantifier') return 'quantified';
  if (kind === 'possessive' || kind === 'demonstrative') return kind;
}

function* boundLexicon(facts) {
  const features = new Map(), filters = new Map();
  for (const wire of facts('w.reader.en.feature')) index(features, one(wire, 'binding'), wire);
  for (const wire of facts('w.reader.en.filter')) index(filters, one(wire, 'binding'), wire);
  for (const binding of facts('w.reader.en.binding')) {
    const name = one(binding, 'name'), type = one(binding, 'source_type');
    const textKey = one(binding, 'text_key'), sourceId = one(binding, 'source_id');
    const cat = one(binding, 'cat');
    if (!name || !type || !textKey || !cat) continue;
    const definitions = features.get(name) ?? [];
    const tests = (filters.get(name) ?? []).map(wire => [one(wire, 'key'), one(wire, 'value')]);
    for (const source of facts(type)) {
      if ((sourceId && source.id !== sourceId) || !isEnglish(source)) continue;
      if (!tests.every(([field, value]) => values(source, field).includes(value))) continue;
      for (const text of values(source, textKey).filter(Boolean)) {
        if (!tests.every(([field, value]) => field !== textKey || text === value)) continue;
        let fields = [[]];
        for (const feature of definitions) {
          const key = one(feature, 'key'), from = one(feature, 'from_key');
          const literal = one(feature, 'value');
          const projected = literal !== undefined ? [literal] : one(feature, 'from_id') === 'true'
            ? [source.id] : from === textKey ? [text] : values(source, from);
          fields = fields.flatMap(row => projected.map(value => [...row, [key, value]]));
        }
        for (const row of fields) yield { cat, text, feat: Object.fromEntries(row) };
      }
    }
  }
}

function compile(facts) {
  const knownWords = new Set();
  const acts = new Map(), targets = new Map(), constraints = new Map(), markers = new Map();
  const familyTabs = new Map();
  const determiners = new Map(), joiners = new Map(), negatives = new Set(), fillerPhrases = new Set(), discourse = [];
  const actFacts = facts('k.actions.act');
  const actNames = new Set(actFacts.map(wire => one(wire, 'name')).filter(Boolean));
  const words = facts('core.word').filter(isEnglish);
  const requestKeys = facts('w.request.key').map(wire => ({
    tab: one(wire, 'tab'), family: one(wire, 'family'), name: one(wire, 'name'),
    head: one(wire, 'head'), values: values(wire, 'value'), means: one(wire, 'means'),
  })).filter(key => key.tab && key.family && key.name && key.head);
  const keysByOwner = new Map();
  const slotOwners = new Map(), slotNames = new Map();
  for (const wire of facts('core.slot')) {
    const owner = one(wire, 'of'), key = one(wire, 'key');
    if (!owner || !key) continue;
    slotOwners.set(wire.id, owner);
    slotOwners.set(owner + '.' + key, owner);
    slotNames.set(wire.id, key);
    slotNames.set(owner + '.' + key, key);
  }
  const aliases = new Map();
  const valuesBySlot = new Map();
  const kindBindings = [];
  const boundValues = new Map(), boundAttributes = new Map(), properties = new Map();

  function spell(text) {
    for (const word of text.toLowerCase().match(/[\p{L}\p{M}]+/gu) ?? []) knownWords.add(word);
  }

  function bind({ of, family, sort = '', tab, acts, mode, surfaces }) {
    if (tab) index(familyTabs, family, tab);
    const binding = { family, sort, acts: [...new Set(acts.filter(act => actNames.has(act)))], mode };
    for (const text of new Set([...surfaces, ...(aliases.get(of) ?? [])])) {
      spell(text);
      index(targets, phrase(text), binding);
    }
  }

  for (const wire of words) {
    const texts = values(wire, 'text');
    const meanings = values(wire, 'means');
    const owners = values(wire, 'of');
    for (const text of texts) {
      spell(text);
      for (const meaning of meanings) {
        if (!owners.length || owners.includes('std.schema.world.name')) index(aliases, meaning, text);
        if ((!owners.length || owners.includes('k.actions.act.name')) && actNames.has(meaning)) {
          index(acts, phrase(text), ['act', meaning, '', 0]);
        }
        for (const owner of owners) index(valuesBySlot, owner, { text, value: meaning });
      }
    }
  }

  const references = new Set();
  for (const wire of facts('w.lang.en.pron')) {
    if (!values(wire, 'case').includes('object') || !values(wire, 'refers').includes('thing')) continue;
    for (const text of values(wire, 'text')) references.add(phrase(text));
  }
  for (const wire of facts('w.lang.en.anaphor')) {
    if (!['none', 'one'].includes(one(wire, 'head'))) continue;
    for (const text of values(wire, 'text')) references.add(phrase(text));
  }

  const spatial = new Map();
  for (const wire of facts('w.lang.en.prep')) {
    const relation = one(wire, 'rel');
    const space = one(wire, 'space');
    if (!relation || !space || Number(one(wire, 'arity') ?? 1) !== 1) continue;
    for (const text of values(wire, 'text')) {
      const form = phrase(text);
      index(spatial, form, relation);
      index(markers, form, ['marker', '*', 'spatial', relation, 0]);
    }
  }
  for (const wire of facts('k.actions.role')) {
    const act = one(wire, 'act'), role = one(wire, 'name'), holds = one(wire, 'holds');
    if (!actNames.has(act) || !role || !holds || one(wire, 'needed') === 'true') continue;
    for (const text of values(wire, 'marker')) {
      const form = phrase(text);
      for (const relation of (holds === 'place' ? spatial.get(form) : undefined) ?? ['']) {
        index(markers, form, ['marker', act, role, relation, 0]);
      }
    }
  }

  for (const wire of facts('k.actions.verb')) {
    const act = one(wire, 'act');
    for (const text of values(wire, 'text')) {
      spell(text);
      if (!actNames.has(act)) continue;
      const form = phrase(text);
      index(acts, form, ['act', act, '', 0]);
      if (one(wire, 'complement') === 'value') index(markers, form, ['frame', act, 'value', '', 0]);
    }
  }

  for (const { cat, text, feat } of boundLexicon(facts)) {
    spell(text);
    if (cat === 'VALUE' && feat.value && feat.operator === 'eq') {
      if (feat.attribute) index(boundAttributes, feat.attribute, { text, value: feat.value });
      else if (feat.concept) index(boundValues, feat.concept, { text, value: feat.value });
    }
    if (cat === 'PROPERTY' && feat.concept) index(properties, feat.concept, text);
  }

  for (const key of requestKeys) {
    index(familyTabs, key.family, key.tab);
    if (slotOwners.has(key.means)) index(keysByOwner, slotOwners.get(key.means), key);
    spell(label(key.name.split('.').at(-1)));
    for (const value of key.values) spell(label(value));
  }

  const schemas = new Set(facts('std.schema.world').map(wire => one(wire, 'name')));
  for (const wire of facts('std.schema.kind')) {
    const of = one(wire, 'of');
    if (!of) continue;
    const local = of.split('.').at(-1);
    for (const world of values(wire, 'world').filter(id => schemas.has(id) && id !== 'w.request')) {
      const tab = world.split('.').slice(1).join('.');
      const keys = keysByOwner.get(of) ?? [];
      const families = new Set(keys.map(key => key.family));
      if (!families.size) families.add(local);
      const surfaces = [label(local), ...(local === tab ? aliases.get(world) ?? [] : [])];
      for (const family of families) {
        kindBindings.push({ of, family, tab, surfaces, acts: values(wire, 'acts') });
      }
    }
  }

  // Explicit bindings supply a request family, mode and sort when they differ
  // from the vocabulary of the domain schema.
  const explicit = facts('pro.reader.target');
  const mapped = new Set(explicit.map(wire => one(wire, 'of')).filter(Boolean));
  for (const binding of kindBindings) {
    if (!mapped.has(binding.of)) bind(binding);
  }
  for (const wire of explicit) {
    const of = one(wire, 'of');
    const family = one(wire, 'family');
    const mode = one(wire, 'mode');
    const kind = kindBindings.find(binding => binding.of === of);
    if (!family || (mode && !['new', 'existing', 'bound'].includes(mode))) {
      throw new Error(`Invalid pro.reader.target binding @${wire.id}`);
    }
    const sort = one(wire, 'sort') ?? '';
    const surfaces = values(wire, 'text');
    const actionNames = values(wire, 'act');
    bind({
      of, family, sort, mode, tab: one(wire, 'tab') ?? kind?.tab,
      acts: actionNames.length ? actionNames : kind?.acts ?? [],
      surfaces: surfaces.length ? surfaces : sort ? [label(sort)] : kind?.surfaces ?? [],
    });
  }

  // A bare value needs a single declared key in its family. An explicit key
  // surface can disambiguate otherwise overlapping value banks.
  const compatibleValues = new Map(), propertyLabels = new Map();
  const canonicalSlots = new Map();
  for (const key of requestKeys) {
    if (slotNames.get(key.means) === key.name.split('.').at(-1)) {
      canonicalSlots.set(JSON.stringify([key.family, key.means]), key);
    }
  }
  for (const key of requestKeys) {
    const canonical = canonicalSlots.get(JSON.stringify([key.family, key.means]));
    const heads = new Set(key.head.split('+'));
    const canonicalHeads = new Set(canonical?.head.split('+'));
    // Prefer the canonical slot spelling for a narrower key with the same
    // value bank. Equal or incompatible key declarations remain ambiguous.
    const alias = canonicalHeads.size > heads.size && [...heads].every(head => canonicalHeads.has(head)) &&
      canonical.values.length === key.values.length && key.values.every(value => canonical.values.includes(value));
    const attribute = alias ? canonical.name : key.name;
    const keyAliases = [...(aliases.get(key.means) ?? []), ...(aliases.get(key.name) ?? [])];
    const concepts = new Set([key.name, key.means, slotNames.get(key.means), ...keyAliases].filter(Boolean));
    for (const concept of concepts) keyAliases.push(...(properties.get(concept) ?? []));
    const keyForms = new Set([label(key.name.split('.').at(-1)), ...keyAliases]);
    const kinds = [];
    if (heads.has('number')) kinds.push('number');
    if (heads.has('span')) kinds.push('quoted');
    for (const text of keyForms) {
      const surface = phrase(text);
      if (surface) index(propertyLabels, JSON.stringify([surface, key.family]), { attribute, kinds });
    }
    const candidate = heads.has('candidate');
    if (!heads.has('class') && !candidate) continue;
    const forms = key.values.map(value => ({ text: label(value), value }));
    for (const alias of valuesBySlot.get(key.means) ?? []) {
      if (key.values.includes(alias.value)) forms.push(alias);
    }
    const lexicalForms = [...(boundAttributes.get(key.name) ?? []), ...[...concepts]
      .flatMap(concept => boundValues.get(concept) ?? [])];
    for (const form of lexicalForms) {
      if (key.values.includes(form.value)) forms.push(form);
      else if (candidate) forms.push({ ...form, open: true });
    }
    for (const { text, value, open } of forms) {
      const valueEvidence = text !== value ? ` words=${quote(text)}` : '';
      const openValue = open && key.values.length ? ' open_value=true' : '';
      const body = `on=attribute attribute=${quote(attribute)} value=${quote(value)} operator=eq phase=result${openValue}`;
      for (const keyText of keyForms) {
        const surface = phrase(`${keyText} ${text}`);
        const evidence = ` key_words=${quote(keyText)}${valueEvidence}`;
        index(compatibleValues, JSON.stringify([key.family, surface]), [body, evidence]);
      }
      index(compatibleValues, JSON.stringify([key.family, phrase(text)]), [body, valueEvidence]);
    }
  }
  const propertiesBySurface = new Map();
  for (const [id, records] of propertyLabels) {
    const attributes = new Set(records.map(record => record.attribute));
    if (attributes.size !== 1) continue;
    const [surface, family] = JSON.parse(id);
    const [attribute] = attributes;
    for (const kind of new Set(records.flatMap(record => record.kinds))) {
      index(propertiesBySurface, surface, { family, attribute, kind });
    }
  }
  for (const [id, forms] of compatibleValues) {
    const bodies = new Map(forms);
    if (bodies.size !== 1) continue;
    const [family, surface] = JSON.parse(id);
    const [body, evidence] = bodies.entries().next().value;
    index(constraints, surface, ['constraint', '*', family, body + evidence, 0]);
  }

  for (const wire of facts('w.lang.en.det')) {
    const type = determination(wire);
    if (type) for (const text of values(wire, 'text')) determiners.set(phrase(text), type);
  }

  for (const wire of facts('w.lang.en.joiner')) {
    const kind = one(wire, 'kind');
    if (kind) for (const text of values(wire, 'text')) joiners.set(phrase(text), kind);
  }

  for (const wire of facts('w.lang.en.neg')) {
    for (const text of [...values(wire, 'text'), ...values(wire, 'ending')]) negatives.add(text.toLowerCase());
  }

  for (const wire of facts('w.lang.en.skip')) {
    if (!['filler', 'politeness', 'interjection'].includes(one(wire, 'class'))) continue;
    for (const text of values(wire, 'text')) {
      const surface = phrase(text);
      if (surface && !joiners.has(surface)) {
        fillerPhrases.add(surface);
        discourse.push({text:surface,class:one(wire,'class')});
        spell(text);
      }
    }
  }

  return {
    knownWords, requestKeys, negatives, fillerPhrases, discourse,
    spatialBindings: facts('pro.reader.spatial').map(wire => ({
      tab: one(wire, 'tab'), family: one(wire, 'family'),
      relationKey: one(wire, 'relation_key'), anchorKey: one(wire, 'anchor_key'),
    })),
    determiners: Object.fromEntries(determiners),
    joiners: Object.fromEntries(joiners),
    familyTabs: Object.fromEntries([...familyTabs].map(([family, tabs]) => [family, [...new Set(tabs)]])),
    lexicon: Object.fromEntries(acts),
    properties: surface => propertiesBySurface.get(surface) ?? [],
    isReference: text => references.has(phrase(text)),
    lookup(surface, activeActs = actNames) {
      const entries = [...(acts.get(surface) ?? []), ...(constraints.get(surface) ?? []), ...(markers.get(surface) ?? [])];
      if (references.has(surface)) entries.push(['reference', '*', 'thing', '', 0]);
      for (const { family, sort, mode, acts } of targets.get(surface) ?? []) {
        for (const act of acts) {
          if (!activeActs.has(act)) continue;
          entries.push(['target', act, family, mode ?? (act === 'make' ? 'new' : 'existing'), sort, 0]);
        }
      }
      return [...new Map(entries.map(entry => [JSON.stringify(entry), entry])).values()];
    },
    acts: actFacts,
  };
}

function collect(facts, file, selection) {
  for (const wire of readFacts(file, selection)) {
    if (wire.pattern || Object.values(wire.attrs).some(items => items.some(item => item.startsWith('?')))) continue;
    if (!facts.has(wire.type)) facts.set(wire.type, new Map());
    facts.get(wire.type).set(wire.id, wire);
  }
}

function providerTypes(facts) {
  return new Set([...(facts.get('w.reader.en.binding')?.values() ?? [])]
    .map(binding => one(binding, 'source_type')).filter(Boolean));
}

function compileFacts(facts) {
  return compile(type => [...(facts.get(type)?.values() ?? [])]);
}

let pinnedFiles;
let pinnedProviders;
function loadPinned(facts, selection) {
  for (const file of pinnedFiles) collect(facts, file, selection);
}

export function loadWorlds({ paths = (process.env.SOP_WORLDS ?? '').split(delimiter).filter(Boolean) } = {}) {
  if (!baseFacts) {
    pinnedFiles = [...worldFiles(pinned, false)];
    baseFacts = new Map();
    loadPinned(baseFacts, types);
    pinnedProviders = providerTypes(baseFacts);
    loadPinned(baseFacts, new Set([...pinnedProviders].filter(type => !types.has(type))));
  }
  if (!paths.length) return baseWorlds ??= compileFacts(baseFacts);

  const overlay = new Map();
  for (const entry of paths) {
    const path = resolve(entry);
    const files = statSync(path).isDirectory() ? worldFiles(path, true) : [path];
    for (const file of files) collect(overlay, file);
  }
  const facts = new Map([...baseFacts].map(([type, wires]) => [type, new Map(wires)]));
  const extra = new Set([...providerTypes(overlay)].filter(type => !types.has(type) && !pinnedProviders.has(type)));
  if (extra.size) loadPinned(facts, extra);
  for (const [type, wires] of overlay) {
    for (const [id, wire] of wires) {
      if (!facts.has(type)) facts.set(type, new Map());
      facts.get(type).set(id, wire);
    }
  }
  return compileFacts(facts);
}
