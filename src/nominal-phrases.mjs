import { supportedMeaning } from './training-evidence.mjs';
import { literalField, literalRanges } from './evidence.mjs';
import { tokens } from './lexicon.mjs';
import { quotedSpans } from './literal-roles.mjs';
import { consumeUnread } from './nominal-evidence.mjs';
import { parse, serialize } from '../.cache/knowledge/tools/sopworld/sopworld.mjs';

const requestType = 'w.request.request', targetType = 'w.request.target';
const constraintType = 'w.request.constraint', unreadType = 'w.request.unread';
const lookupType = 'w.request.lookup';
const decode = value => value?.startsWith('"') ? JSON.parse(value) : value;
const field = (wire, key) => decode(wire.attrs[key]?.[0]);
const noun = target => field(target, 'sort_words') ?? field(target, 'family_words') ?? field(target, 'sort');
const word = /^[\p{L}\p{M}\p{N}_]+$/u;
const normalize = text => tokens(text).map(token => token[0]).join(' ');
const modeKey = (target, request) => [field(target, 'family'), field(request, 'act'), field(target, 'mode')];
const encode = value => /^[\p{L}_][\p{L}\p{M}\p{N}_.-]*$/u.test(value) ? value : JSON.stringify(value);
const allowedFields = new Set(['id', 'request', 'attribute', 'on', 'value', 'words', 'operator', 'phase']);
const allowedOperators = new Set(['eq', 'region', 'degree']);
const boundary = /^[,.;:!?—–，。！？；：]$/u;

function nounPosition(ts, head) {
  const words = normalize(head).split(' ');
  if (!words.every(token => word.test(token))) return;
  const matches = ts.flatMap((_, i) => words.every((token, j) => ts[i + j]?.[0] === token) ? [i] : []);
  if (matches.length === 1) return [matches[0], matches[0] + words.length];
}

export function createNominalPhraseLearner() {
  const observations = new Map();
  return {
    observe(text, target, constraint, request) {
      const active = modeKey(target, request);
      const head = noun(target), surface = field(constraint, 'words');
      const key = field(constraint, 'attribute'), value = field(constraint, 'value');
      const on = field(constraint, 'on'), operator = field(constraint, 'operator') ?? 'eq';
      const phase = field(constraint, 'phase') ?? 'result';
      if (!active[0] || !active[1] || !['new', 'existing'].includes(active[2]) ||
          !head || !surface || !value || !key || !on || constraint.attrs.value.length !== 1 ||
          constraint.attrs.words.length !== 1) return;
      const phrase = normalize(surface), words = phrase.split(' ');
      if (words.length < 2 || words.length > 8 || !words.every(token => word.test(token))) return;
      const ts = tokens(text), at = nounPosition(ts, head)?.[1];
      if (at === undefined || !words.every((token, i) => ts[at + i]?.[0] === token)) return;
      const start = ts[at][2], end = ts[at + words.length - 1][3];
      if (quotedSpans(text).some(q => q.start < end && q.end > start)) return;
      const identity = JSON.stringify([...active, words[0]]);
      const group = observations.get(identity) ?? new Map();
      observations.set(identity, group);
      const usable = allowedOperators.has(operator) && on !== 'place' &&
        Object.keys(constraint.attrs).every(name => allowedFields.has(name));
      const semantics = usable && JSON.stringify([key, value, on, operator, phase]);
      const witness = normalize(text);
      const sort = field(target, 'sort') ?? head;
      const witnesses = group.get(phrase) ?? new Map();
      group.set(phrase, witnesses);
      const entry = witnesses.get(witness);
      if (!entry) witnesses.set(witness, {semantics, sort:normalize(sort)});
      else if (entry.semantics !== semantics) entry.semantics = false;
      else if (entry.sort !== normalize(sort)) entry.sort = undefined;
    },
    finish() {
      return Object.fromEntries([...observations].flatMap(([id, group]) => {
        const forms = [...group].flatMap(([surface, witnesses]) => {
          const meaning = supportedMeaning(witnesses,2);
          return meaning ? [[surface.split(' '), ...JSON.parse(meaning)]] : [];
        });
        return forms.length ? [[id, forms]] : [];
      }));
    },
  };
}

function spatialPair(wires, constraints, family, surface, worlds) {
  const pairs = [];
  for (const {relationKey, anchorKey} of worlds.spatialBindings.filter(binding => binding.family === family)) {
    for (const relation of constraints.filter(w => field(w, 'attribute') === relationKey &&
      field(w, 'on') === 'place' && field(w, 'operator') === 'relation' && w.attrs.value?.length === 1)) {
      const marker = normalize(field(relation, 'words') ?? field(relation, 'value'));
      for (const anchor of constraints.filter(w => field(w, 'attribute') === anchorKey &&
        field(w, 'on') === 'place' && field(w, 'operator') === 'relation' && field(w, 'phase') === 'selector' &&
        w.attrs.value?.length === 1 && !w.attrs.words)) {
        if (marker + ' ' + normalize(field(anchor, 'value')) !== surface) continue;
        const lookups = wires.filter(w => w.type === lookupType && field(w, 'constraint') === '$' + anchor.id);
        pairs.push([relation, anchor, ...lookups]);
      }
    }
  }
  if (pairs.length !== 1) return [];
  const drop = new Set(pairs[0]);
  const refs = new Set([...drop].map(w => '$' + w.id));
  return wires.some(w => !drop.has(w) && Object.values(w.attrs).flat().some(value => refs.has(value)))
    ? [] : pairs[0];
}

function normalSpans(text, value) {
  return literalRanges(text.toLowerCase(), value.toLowerCase());
}

function separatesPhrase(ts, next, worlds) {
  if (!ts[next] || boundary.test(ts[next][0])) return true;
  for (let end = next + 1; end <= Math.min(ts.length, next + 4); end++) {
    const continuation = ts.slice(next, end).map(token => token[0]).join(' ');
    if (worlds.joiners[continuation] ||
      worlds.lookup(continuation).some(([role, , kind, relation]) =>
        role === 'marker' && kind === 'spatial' && relation)) return true;
  }
  return false;
}

export function nominalPhraseReadings(text, ts, quotes, candidate, forms, worlds) {
  if (!forms || !candidate.sop) return [];
  const wires = parse(candidate.sop);
  const targets = wires.filter(w => w.type === targetType), requests = wires.filter(w => w.type === requestType);
  if (targets.length !== 1 || requests.length !== 1) return [];
  const [target] = targets, [request] = requests;
  const [family, act, mode] = modeKey(target, request);
  const head = noun(target);
  const ref = '$' + request.id;
  if (!head || !family || !act || field(target, 'request') !== ref || !['new', 'existing'].includes(mode)) return [];
  const position = nounPosition(ts, head);
  if (!position) return [];
  const [start, at] = position;
  const entries = forms[JSON.stringify([family, act, mode, ts[at]?.[0]])];
  if (!entries) return [];
  const matches = entries.filter(([words]) => words.every((token, i) => ts[at + i]?.[0] === token));
  // Competing forms with a common prefix may express different scopes.
  if (matches.length !== 1) return [];
  const [[keys, key, value, on, operator, phase]] = matches;
  if (!separatesPhrase(ts, at + keys.length, worlds)) return [];
  const fromChar = ts[at][2], toChar = ts[at + keys.length - 1][3];
  const headChar = ts[start][2];
  if (quotes.some(q => q.start < toChar && q.end > headChar)) return [];

  const chars = Array.from(text);
  const from = chars.slice(0, fromChar).join('').length;
  const to = chars.slice(0, toChar).join('').length;
  const namedScope = field(request, 'words');
  const scopes = namedScope ? literalRanges(text, namedScope) : [[0, text.length]];
  if (scopes.length !== 1 || chars.slice(0, headChar).join('').length < scopes[0][0] || to > scopes[0][1]) return [];
  const scopeTokens = tokens(text.slice(...scopes[0])).map(token => token[0]);
  if (scopeTokens.some((token, i) => {
    for (let end = i + 1; end <= Math.min(i + 4, scopeTokens.length); end++) {
      const phrase = scopeTokens.slice(i, end).join(' ');
      if (worlds.negatives.has(phrase) || worlds.scopeGrammar.negatives.has(phrase) ||
          worlds.scopeGrammar.conditionals.has(phrase) ||
          [...worlds.scopeGrammar.endings].some(ending => scopeTokens.slice(i, end).join('').endsWith(ending))) return true;
    }
    return false;
  })) return [];
  if (!worlds.requestKeys.some(prop => prop.family === family && prop.name === key &&
    prop.head.split('+').some(h => h === 'class' || h === 'candidate') &&
    (!prop.values.length || prop.values.includes(value)))) return [];

  const constraints = wires.filter(w => w.type === constraintType);
  if (constraints.some(w => field(w, 'attribute') === key) ||
      constraints.some(w => ['no', 'not_all'].includes(field(w, 'want')))) return [];
  const owned = constraints.filter(w => field(w, 'request') === ref);
  const drop = new Set(spatialPair(wires, owned, family, keys.join(' '), worlds));
  const overlap = (wire, fields) => fields.some(name => wire.attrs[name].some(item =>
    normalSpans(text, decode(item)).some(([a,b]) => a < to && b > from)));
  const observed = wires.filter(w => w.type === unreadType && field(w, 'request') === ref);
  if (!drop.size && !observed.some(w => overlap(w, ['text']))) return [];
  for (const w of wires) {
    if (drop.has(w) || w.type === unreadType || w === request) continue;
    const evidence = Object.keys(w.attrs).filter(literalField);
    if (w.type === constraintType && w.attrs.value && !w.attrs.words) evidence.push('value');
    if (overlap(w, evidence)) return [];
  }
  const ids = new Set(wires.map(w => w.id));
  const stem = target.id + '.phrase';
  let id = stem;
  for (let suffix = 2; ids.has(id); suffix++) id = stem + suffix;
  const kept = consumeUnread(wires.filter(w => !drop.has(w)), text, from, to);
  const support = {
    id, type:constraintType,
    attrs:{request:[ref], on:[on], attribute:[encode(key)], value:[encode(value)],
      words:[JSON.stringify(text.slice(from,to))], operator:[operator], phase:[phase]},
  };
  return [{sop:serialize([...kept, support]), source:'nominal-phrase',
    status:kept.some(w => w.type === unreadType) ? 'partial' : 'matched'}];
}
