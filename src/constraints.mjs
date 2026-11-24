import { readFileSync } from 'node:fs';
import { parse } from './schema.mjs';

const tokenPattern = /[\p{L}\p{N}\p{M}_]+|[^\s]/gu;
const words = phrase => (phrase?.match(tokenPattern) ?? []).map(token => token.toLowerCase());
const compoundLimit = 8;
const recordLimit = 4096;
const clauses = /\b(?:not|never|no|without|except|avoid|neither|nor)\b|\b\w+n['’]t\b/i;
const numeric = /\p{N}/u;
const connector = new Set(['a', 'an', 'the', 'of', 'to', 'is', ',', ':', '=', 'and']);
const resultFields = ['on', 'attribute', 'value', 'words', 'operator', 'phase', 'key_words'];
const optionalDefaults = new Map([['want', 'yes'], ['origin', 'said'], ['character', 'requirement']]);
const allowedKeys = new Set(['request', ...resultFields, ...optionalDefaults.keys()]);

function decode(encoded) {
  if (!encoded?.startsWith('"')) return encoded;
  try {
    return JSON.parse(encoded);
  } catch {
    return undefined;
  }
}

function one(wire, key) {
  return decode(wire.attrs[key]?.[0]);
}

function sameAt(text, phrase, start) {
  return phrase.length > 0 && phrase.every((token, offset) => token === text[start + offset]);
}

function occurrences(text, phrase) {
  const spans = [];
  for (let start = 0; start <= text.length - phrase.length; start++) {
    if (sameAt(text, phrase, start)) spans.push([start, start + phrase.length]);
  }
  return spans;
}

function combinedPhrase(text, evidence) {
  const candidates = evidence.map(surface => occurrences(text, words(surface)));
  if (candidates.some(spans => spans.length === 0)) return undefined;
  let length = compoundLimit + 1;
  const phrases = new Set();
  const starts = new Set(candidates.flatMap(spans => spans.map(([start]) => start)));
  for (const start of starts) {
    for (let end = start + 1; end <= Math.min(text.length, start + length, start + compoundLimit); end++) {
      const window = candidates.map(spans => spans.filter(([s, e]) => s >= start && e <= end));
      if (window.some(spans => spans.length === 0)) continue;
      const coverage = Array(end - start).fill(false);
      for (const spans of window) {
        for (const [s, e] of spans) coverage.fill(true, s - start, e - start);
      }
      if (!coverage[0] || !coverage.at(-1)) continue;
      const tokens = text.slice(start, end);
      if (tokens.some((token, index) => !coverage[index] && !connector.has(token))) continue;
      if (coverage.filter(covered => !covered).length > 2) continue;
      if (end - start < length) phrases.clear();
      length = end - start;
      phrases.add(tokens.join(' '));
    }
  }
  return phrases.size === 1 ? phrases.values().next().value : undefined;
}

function tableEntry(map, key, init) {
  if (!map.has(key)) map.set(key, init());
  return map.get(key);
}

function loadKeys() {
  const input = new URL('../.cache/knowledge/docs/worlds/w.request/shards/keys.sop', import.meta.url);
  const keys = new Map();
  const listed = new Map();
  for (const wire of parse(readFileSync(input, 'utf8'))) {
    if (wire.type !== 'w.request.key') continue;
    const family = one(wire, 'family'), attribute = one(wire, 'name');
    const values = (wire.attrs.value ?? []).map(value => words(decode(value)).join(' '));
    const key = tableEntry(keys, JSON.stringify([family, attribute]), () => ({ valueBank: false, candidate: false }));
    key.valueBank ||= values.length > 0;
    key.candidate ||= (one(wire, 'head') ?? '').split('+').includes('candidate');
    for (const value of values) {
      tableEntry(listed, JSON.stringify([family, value]), () => new Set()).add(attribute);
    }
  }
  return { keys, listed };
}

function classify(wire) {
  const { attrs } = wire;
  if (Object.keys(attrs).some(key => !allowedKeys.has(key))) return undefined;
  if (attrs.operator?.[0] !== 'eq') return undefined;
  if (attrs.phase && attrs.phase[0] !== 'result') return undefined;
  if ([...optionalDefaults].some(([key, value]) => attrs[key] && attrs[key][0] !== value)) return undefined;
  if (!attrs.on || !attrs.attribute || !attrs.value?.length) return undefined;
  if (Object.entries(attrs).some(([key, values]) => !['value', 'key_words'].includes(key) && values.length !== 1)) {
    return undefined;
  }
  const values = attrs.value.map(decode);
  if (values.some(value => !value || numeric.test(value) || clauses.test(value) || value.startsWith('$'))) return undefined;
  return values;
}

function evidencePhrase(wire, values, scope) {
  const keyWords = (wire.attrs.key_words ?? []).map(decode);
  const valueWords = one(wire, 'words');
  if (!keyWords.length) {
    if (values.length !== 1 || (valueWords && words(valueWords).join(' ') !== words(values[0]).join(' '))) return undefined;
    const tokens = words(values[0]);
    if (tokens.length > compoundLimit || !occurrences(scope, tokens).length) return undefined;
    return { phrase: tokens.join(' '), implicit: true };
  }
  if (keyWords.some(surface => !surface || !words(surface).some(token => /\p{L}/u.test(token)))) return undefined;
  const valueEvidence = valueWords ? [valueWords, ...(values.length > 1 ? values : [])] : values;
  const onlyKey = combinedPhrase(scope, keyWords);
  const phrase = combinedPhrase(scope, [...keyWords, ...valueEvidence]);
  if (!phrase || phrase === onlyKey || numeric.test(phrase) || clauses.test(phrase)) return undefined;
  return { phrase, implicit: false };
}

function wireBody(wire) {
  return resultFields.flatMap(key => (wire.attrs[key] ?? []).map(value => key + '=' + value)).join(' ');
}

export function learnConstraints(rows) {
  const { keys, listed } = loadKeys();
  const candidates = new Map();
  const attributesByValue = new Map();
  for (const { text, sop } of rows) {
    if (!sop.includes('w.request.constraint')) continue;
    let wires;
    try {
      wires = parse(sop);
    } catch {
      continue;
    }
    const requests = wires.filter(wire => wire.type === 'w.request.request');
    for (const request of requests) {
      const requestRef = '$' + request.id;
      const act = one(request, 'act');
      if (!act) continue;
      const targets = wires.filter(wire => wire.type === 'w.request.target' && one(wire, 'request') === requestRef);
      if (targets.length !== 1) continue;
      const family = one(targets[0], 'family');
      if (!family) continue;
      const span = one(request, 'words') ?? (requests.length === 1 ? text : '');
      if (!span || !text.toLowerCase().includes(span.toLowerCase())) continue;
      const scope = words(span);
      const source = scope.join(' ');
      const negative = clauses.test(span);
      for (const wire of wires) {
        if (wire.type !== 'w.request.constraint' || one(wire, 'request') !== requestRef) continue;
        const attribute = one(wire, 'attribute');
        const key = keys.get(JSON.stringify([family, attribute]));
        if (!key) continue;
        // Count ambiguity in bare values across contexts, including selectors.
        // Evidence that names another key explicitly does not make a bare value ambiguous.
        if (!wire.attrs.key_words && wire.attrs.value?.length === 1) {
          const raw = wire.attrs.value[0];
          const value = words(decode(raw));
          const normalizedValue = value.join(' ');
          const valueWords = words(one(wire, 'words')).join(' ');
          if ((!valueWords || valueWords === normalizedValue) && !numeric.test(raw) &&
              occurrences(scope, value).length) {
            const field = JSON.stringify([family, normalizedValue]);
            tableEntry(attributesByValue, field, () => new Set()).add(attribute);
          }
        }
        if (negative) continue;
        const values = classify(wire);
        if (!values) continue;
        if (key.valueBank && values.some(value => {
          const label = JSON.stringify([family, words(value).join(' ')]);
          return !listed.get(label)?.has(attribute);
        })) continue;
        const evidence = evidencePhrase(wire, values, scope);
        if (!evidence) continue;

        const { phrase, implicit } = evidence;
        const field = JSON.stringify([family, phrase]);
        if (implicit) {
          const declared = listed.get(field);
          if (declared ? declared.size !== 1 || !declared.has(attribute) : key.valueBank || !key.candidate) continue;
        }
        const fingerprint = JSON.stringify([phrase, act, family]);
        const body = wireBody(wire);
        const options = tableEntry(candidates, fingerprint, () => new Map());
        const support = tableEntry(options, body, () => ({ phrase, act, family, body, field, implicit, sources: new Set() }));
        support.sources.add(source);
      }
    }
  }

  const records = [];
  for (const options of candidates.values()) {
    if (options.size !== 1) continue;
    const option = options.values().next().value;
    const count = option.sources.size;
    const implicit = option.implicit;
    if (implicit && attributesByValue.get(option.field)?.size !== 1) continue;
    const minimum = implicit && !listed.has(option.field) ? 5 : 2;
    if (count >= minimum) records.push({ ...option, count });
  }
  records.sort((left, right) => right.count - left.count ||
    left.phrase.localeCompare(right.phrase, 'en') || left.act.localeCompare(right.act, 'en') ||
    left.family.localeCompare(right.family, 'en'));

  const model = new Map();
  for (const { phrase, act, family, body, count } of records.slice(0, recordLimit)) {
    tableEntry(model, phrase, () => []).push(['constraint', act, family, body, count]);
  }
  return Object.fromEntries(model);
}
