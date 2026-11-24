import { tokenize } from './model.mjs';
import { parse } from './schema.mjs';

const terminal = new Set(['.', '!', '。', '！']);
const separators = new Set([',', '.', '!', ':', '–', '—', '，', '。', '！']);
const word = /[\p{L}\p{N}]/u;
const atom = /^[\p{L}\p{N}_][\p{L}\p{N}_.-]*$/u;
const number = /^[+-]?\d+(?:\.\d+)?$/u;
const date = /^\d{4}-\d{2}-\d{2}$/u;
const time = /^\d{1,2}:\d{2}(?::\d{2})?$/u;
const unsafeOpen = /[;.!?]|\b(?:not|never|no|without|except|neither|nor|then|instead|but|and|or)\b|n['’]t\b/iu;
const numericFields = new Set(['value', 'count', 'measure', 'number', 'min', 'max']);
const literalFields = new Set(['name', 'description', 'ids']);
const contexts = new Set(['w.request.previous', 'w.request.clock', 'w.request.context']);
const mutable = new Set(['value', 'name', 'description', 'sort', 'amount', 'quantity', 'ordinal',
  'quantifier', 'ids', 'count', 'measure', 'number', 'min', 'max']);
const decode = value => value?.startsWith('"') ? JSON.parse(value) : value;
const first = (wire, key) => decode(wire.attrs[key]?.[0]);
const literal = key => key.normalize('NFKC').replace(/[‘’]/gu, "'").replace(/[“”]/gu, '"');
const tokens = text => tokenize(text).map(token => ({ ...token, key: literal(token.key) }));
const evidence = (type, key) => key === 'predicate' || key === 'words' || key.endsWith('_words') ||
  (key === 'text' && ['w.request.request', 'w.request.unread'].includes(type));

function makeEnvelope(declarations) {
  const phrases = [...declarations].map(entry => {
    const { text, class: kind } = typeof entry === 'string' ? { text: entry, class: 'filler' } : entry;
    return { keys: tokens(text).map(token => token.key), kind };
  }).filter(({keys}) => keys.length > 0).sort((a,b) => b.keys.length - a.keys.length);
  const before = new Map(), after = new Map();
  for (const phrase of phrases) {
    for (const [index, key] of [[before, phrase.keys[0]], [after, phrase.keys.at(-1)]]) {
      if (!index.has(key)) index.set(key, []);
      index.get(key).push(phrase);
    }
  }

  return text => {
    const ts = tokens(text), leading = [], trailing = [];
    let start = 0, end = ts.length;
    while (end && terminal.has(ts[end - 1].key)) end--;
    while (start < end) {
      const phrase = (before.get(ts[start].key) ?? []).find(({ keys, kind }) => {
        const boundary = start + keys.length;
        return boundary < end && keys.every((key, i) => ts[start + i].key === key) &&
          (separators.has(ts[boundary].key) || ['politeness', 'interjection'].includes(kind) &&
            ts[boundary - 1].end < ts[boundary].start);
      });
      if (!phrase) break;
      const boundary = start + phrase.keys.length;
      leading.push({ kind: phrase.kind, text: rawSpan(text, ts, start, boundary) });
      start = boundary;
      while (start < end && separators.has(ts[start].key)) start++;
    }
    while (end > start) {
      const phrase = (after.get(ts[end - 1].key) ?? []).find(({keys}) => {
        const boundary = end - keys.length;
        return boundary > start && separators.has(ts[boundary - 1].key) &&
          keys.every((key, i) => ts[boundary + i].key === key);
      });
      if (!phrase) break;
      const boundary = end - phrase.keys.length;
      trailing.push({ kind: phrase.kind, text: rawSpan(text, ts, boundary, end) });
      end = boundary;
      while (end > start && separators.has(ts[end - 1].key)) end--;
    }
    return { core: ts.slice(start, end), extras: [...leading, ...trailing.reverse()] };
  };
}

function grams(ts) {
  const out = new Set();
  for (let size = 1; size <= 3; size++) {
    for (let i = 0; i + size <= ts.length; i++) {
      const keys = ts.slice(i, i + size).map(token => token.key);
      if (keys.some(key => word.test(key))) out.add(keys.join(' '));
    }
  }
  return out;
}

function rawSpan(text, ts, start, end) {
  return text.slice(ts[start].start, ts[end - 1].end);
}

function spans(ts, value) {
  const keys = tokens(value).map(token => token.key);
  const matches = [];
  if (!keys.length) return matches;
  for (let i = 0; i + keys.length <= ts.length; i++) {
    if (keys.every((key, j) => ts[i + j].key === key)) matches.push([i, i + keys.length]);
  }
  return matches;
}

function sameSpan(left, right) {
  return left[0] === right[0] && left[1] === right[1];
}

function overlaps(left, right) {
  return left[0] < right[1] && right[0] < left[1];
}

function encode(value, previous) {
  return previous.startsWith('"') || !atom.test(value) && !number.test(value) ? JSON.stringify(value) : value;
}

function quoted(ts, [start, end]) {
  const mark = ts[start - 1]?.key;
  return (mark === '"' || mark === "'") && ts[end]?.key === mark;
}

function matchingEvidence(ts, value, envelope) {
  const matches = spans(ts, value);
  if (matches.length) return matches;
  const trimmed = envelope(value).core;
  return trimmed.length ? spans(ts, trimmed.map(token => token.raw).join(' ')) : [];
}

function slotSurface(wire, key, value, ts) {
  let matches = spans(ts, value);
  if (!matches.length && value.includes('_')) matches = spans(ts, value.replaceAll('_', ' '));
  if (!matches.length) {
    // A canonical value may have a separately annotated spoken form.
    const aliases = key === 'value' ? ['words'] : [key + '_words'];
    for (const alias of aliases) {
      const surface = first(wire, alias);
      if (surface) matches.push(...spans(ts, surface));
    }
  }
  return matches;
}

function prepare(example, ts, envelope) {
  const all = parse(example.sop);
  const fillers = all.filter(wire => wire.type === 'w.request.filler').flatMap(wire =>
    spans(ts, first(wire, 'text') ?? '').map(span => ({ id: wire.id, span })));
  const wires = all.filter(wire => wire.type !== 'w.request.filler');
  if (!wires.some(wire => wire.type === 'w.request.request') ||
      wires.some(wire => contexts.has(wire.type) ||
        wire.type === 'w.request.lookup' && first(wire, 'from') === 'previous')) return;
  const fields = [];
  const full = tokens(example.text);
  const targets = new Map();
  for (const wire of wires) {
    if (wire.type !== 'w.request.target') continue;
    const req = first(wire, 'request');
    const family = first(wire, 'family');
    if (targets.has(req) && targets.get(req) !== family) targets.set(req, undefined);
    else targets.set(req, family);
  }
  for (const [index, wire] of wires.entries()) {
    for (const [key, values] of Object.entries(wire.attrs)) {
      for (const [item, encoded] of values.entries()) {
        const value = decode(encoded);
        if (evidence(wire.type, key)) {
          const matches = matchingEvidence(ts, value, envelope);
          if (!matches.length) return;
          fields.push({ index, key, item, encoded, matches, evidence: true,
            value, act: first(wire, 'act'), mode: first(wire, 'mode'), mood: first(wire, 'mood'),
            type: wire.type });
        } else if (mutable.has(key) && !encoded.startsWith('$')) {
          const matches = slotSurface(wire, key, value, ts);
          if (!matches.length && spans(full, value).length) return;
          fields.push({ index, key, item, encoded, value, matches,
            type: wire.type, attribute: first(wire, 'attribute'),
            family: first(wire, 'family') ?? targets.get(first(wire, 'request')),
            open: first(wire, 'open_value') === 'true' });
        }
      }
    }
  }
  const slotFields = fields.filter(field => !field.evidence || field.key === 'predicate');
  const starts = new Map();
  for (const field of slotFields) {
    if (field.matches.length !== 1) continue;
    const span = field.matches[0];
    const peers = slotFields.filter(peer => peer.matches.some(match => overlaps(span, match)));
    if (peers.some(peer => peer.matches.length !== 1 || !sameSpan(span, peer.matches[0]))) continue;
    if (!starts.has(span[0])) starts.set(span[0], { span, fields: peers });
  }
  return { wires, fields, starts, fillers };
}

function valueFor(field, oldSurface, surface, delimited, resolveValue) {
  if (field.value === oldSurface) {
    if (numericFields.has(field.key)) {
      for (const kind of [number, date, time]) {
        if (kind.test(oldSurface)) return kind.test(surface) ? surface : undefined;
      }
    }
    if (!unsafeOpen.test(surface) && word.test(surface)) {
      if (field.key === 'name' || field.key === 'ids') {
        if (delimited || /^\p{Lu}/u.test(oldSurface) && /^\p{Lu}/u.test(surface) ||
          /^[\p{L}_]+\d+$/u.test(oldSurface) && /^[\p{L}_]+\d+$/u.test(surface)) return surface;
      }
      if (field.key === 'value' && (field.open || delimited)) return surface;
    }
  }
  if (!resolveValue || unsafeOpen.test(surface)) return;
  const value = resolveValue({
    type: field.type, key: field.key, attribute: field.attribute, family: field.family,
    oldValue: field.value, surface, oldSurface, act: field.act, mode: field.mode, mood: field.mood,
  });
  if (field.key === 'predicate') return field.act && value === field.act ? surface : undefined;
  if (typeof value === 'string' && value.length) return value;
}

function align(example, source, text, { core: input, extras }, resolveValue, envelope) {
  const { wires, fields, starts, fillers } = prepare(example, source, envelope) ?? {};
  if (!wires) return [];
  const memo = new Map();

  function paths(i, j) {
    if (i === source.length || j === input.length) {
      return i === source.length && j === input.length ? [[]] : [];
    }
    const id = i * input.length + j;
    if (memo.has(id)) return memo.get(id);
    const out = [];
    memo.set(id, out);
    if (source[i].key === input[j].key) {
      for (const rest of paths(i + 1, j + 1)) out.push([{ from: i, to: j, after: j + 1, end: i + 1 }, ...rest]);
    }
    const slot = starts.get(i);
    if (!slot || out.length >= 2) return out;
    const end = slot.span[1];
    const oldSurface = rawSpan(example.text, source, i, end);
    const limit = Math.min(input.length, j + Math.max(12, end - i));
    for (let after = j + 1; after <= limit && out.length < 2; after++) {
      // A substituted span must have an unchanged right boundary.
      if (end < source.length && source[end].key !== input[after]?.key) continue;
      if (end === source.length && after !== input.length) continue;
      const surface = rawSpan(text, input, j, after);
      if (literal(surface.toLowerCase()) === literal(oldSurface.toLowerCase())) continue;
      const delimited = quoted(source, slot.span) && quoted(input, [j, after]);
      const values = slot.fields.map(field => valueFor(field, oldSurface, surface, delimited, resolveValue));
      if (values.some(value => value === undefined)) continue;
      for (const rest of paths(end, after)) {
        if (rest[0]?.slot) continue;
        out.push([{ from: i, to: j, after, end, slot, values }, ...rest]);
      }
    }
    return out;
  }

  const results = [];
  for (const path of paths(0, 0)) {
    const anchors = path.filter(step => !step.slot && word.test(source[step.from].key)).length;
    const changed = path.filter(step => step.slot)
      .reduce((total, step) => total + Math.max(step.end - step.from, step.after - step.to), 0);
    if (changed && (anchors < 2 || anchors * 2 < changed)) continue;
    const startsAt = new Map(path.map(step => [step.from, step.to]));
    const endsAt = new Map(path.map(step => [step.end, step.after]));
    const rewritten = new Map();
    const canonicalAliases = [];
    const mark = (field, value) => rewritten.set(field, encode(value, field.encoded));
    for (const step of path) {
      step.slot?.fields.forEach((field, index) => {
        const value = step.values[index];
        const surface = rawSpan(text, input, step.to, step.after);
        mark(field, value);
        if ((field.key === 'sort' || field.key === 'value') && value !== surface) {
          canonicalAliases.push({ field, surface, value });
        }
      });
    }
    let supported = true;
    for (const field of fields) {
      if (rewritten.has(field) || !field.evidence && !literalFields.has(field.key)) continue;
      const values = new Set(field.matches
        .filter(([start, end]) => startsAt.has(start) && endsAt.has(end))
        .map(([start, end]) => rawSpan(text, input, startsAt.get(start), endsAt.get(end))));
      if (values.size === 1) {
        const [value] = values;
        mark(field, value);
      } else if (!values.has(decode(field.encoded))) {
        supported = false;
        break;
      }
    }
    if (!supported) continue;
    const copy = wires.map(wire => ({
      ...wire, attrs: Object.fromEntries(Object.entries(wire.attrs).map(([key, values]) => [key, [...values]])),
    }));
    for (const [field, value] of rewritten) copy[field.index].attrs[field.key][field.item] = value;
    for (const { field, surface, value } of canonicalAliases) {
      const { attrs } = copy[field.index];
      const key = field.key === 'sort' ? 'sort_words' : 'words';
      if (!Object.hasOwn(attrs, key)) attrs[key] = [encode(surface, '""')];
      if (atom.test(value)) attrs[field.key][field.item] = value;
    }
    for (const wire of copy) {
      const { type, attrs } = wire;
      if (type === 'w.request.request' && first(wire, 'words') === text) delete attrs.words;
      if (type === 'w.request.target' && first(wire, 'sort_words') === first(wire, 'sort')) delete attrs.sort_words;
      if (type === 'w.request.constraint' && attrs.value?.length === 1 &&
        first(wire, 'words') === first(wire, 'value')) delete attrs.words;
    }
    const ids = new Set(copy.map(wire => wire.id));
    const root = copy.find(wire => wire.type === 'w.request.request').id;
    let number = 0;
    const ornaments = [...extras];
    for (const {id, span} of fillers) {
      const [start, end] = span;
      if (!startsAt.has(start) || !endsAt.has(end) ||
          path.some(step => step.slot && overlaps(span, [step.from, step.end]))) continue;
      ornaments.push({ id, text: rawSpan(text, input, startsAt.get(start), endsAt.get(end)) });
    }
    const unread = [];
    for (const ornament of ornaments) {
      const {kind, text} = ornament;
      let id = ornament.id;
      while (!id || ids.has(id)) id = 'alignment.f' + (++number);
      ids.add(id);
      const context = kind === 'context';
      if (context) unread.push(text);
      const attrs = { text: [encode(text, '')] };
      if (context) attrs.request = ['$' + root];
      copy.push({ id, type: context ? 'w.request.unread' : 'w.request.filler', attrs });
    }
    results.push({ sop: serialize(copy), similarity: anchors / Math.max(1, anchors + changed), unread: unread.join(' ') });
  }
  return results;
}

function serialize(wires) {
  return wires.map(({ id, type, attrs }) => [
    '@' + id, type, ...Object.entries(attrs).flatMap(([key, values]) => values.map(value => key + '=' + value)),
  ].join(' ')).join('\n');
}

const requestsType = 'w.request.request';
const localRefs = wire => [...new Set(Object.values(wire.attrs).flat()
  .filter(value => value.startsWith('$')).map(value => value.slice(1)))];

function* excerpts(example) {
  const marker = ' ' + requestsType + ' ';
  const offset = example.sop.indexOf(marker);
  if (offset < 0 || example.sop.indexOf(marker, offset + marker.length) < 0) return;

  let wires;
  try {
    wires = parse(example.sop);
  } catch (error) {
    if (error.name === 'SopError') return;
    throw error;
  }
  const requests = wires.filter(wire => wire.type === requestsType);
  if (requests.length < 2) return;
  const ids = new Map(wires.map(wire => [wire.id, wire]));
  const incoming = new Map();
  for (const wire of wires) {
    for (const id of localRefs(wire)) {
      if (!incoming.has(id)) incoming.set(id, []);
      incoming.get(id).push(wire.id);
    }
  }
  let previousEnd = 0;
  const segments = [];
  for (const request of requests) {
    const text = first(request, 'words');
    const start = text ? example.text.indexOf(text) : -1;
    if (start < previousEnd || example.text.indexOf(text, start + 1) !== -1) return;
    previousEnd = start + text.length;
    segments.push({ text, request });
  }

  for (const {text, request} of segments) {
    const selected = new Set([request.id]);
    let complete = true;
    for (const id of selected) {
      const wire = ids.get(id);
      if (!wire || wire !== request && wire.type === requestsType || contexts.has(wire.type) ||
          wire.type === 'w.request.lookup' && first(wire, 'from') !== 'page') {
        complete = false;
        break;
      }
      for (const ref of [...localRefs(wire), ...(incoming.get(id) ?? [])]) selected.add(ref);
    }
    if (!complete || !first(request, 'predicate')) continue;
    const fragment = wires.filter(wire => selected.has(wire.id));
    const ts = tokens(text);
    const says = value => spans(ts, decode(value)).length > 0;
    const targets = fragment.filter(wire => wire.type === 'w.request.target');
    if (!targets.length || targets.some(wire => first(wire, 'mode') === 'bound' ||
      !['name', 'description', 'sort', 'sort_words', 'family_words', 'ids']
        .some(key => wire.attrs[key]?.some(says)))) continue;
    const localEvidence = fragment.every(wire => Object.entries(wire.attrs).every(([key, values]) =>
      !(evidence(wire.type, key) || literalFields.has(key) ||
        wire.type === 'w.request.constraint' && key === 'value' && !wire.attrs.words) || values.every(says)));
    if (!localEvidence) continue;
    for (const wire of wires) {
      const filler = first(wire, 'text');
      if (wire.type === 'w.request.filler' && !selected.has(wire.id) && filler && says(JSON.stringify(filler)) &&
        example.text.indexOf(filler) === example.text.lastIndexOf(filler)) fragment.push(wire);
    }
    const names = new Map(fragment.map(({id}, i) => [id, 'excerpt.' + (i+1)]));
    const named = fragment.map(wire => ({
      ...wire, id: names.get(wire.id), attrs: Object.fromEntries(Object.entries(wire.attrs)
        .map(([key, values]) => [key, values.map(value => value.startsWith('$') ? '$' + names.get(value.slice(1)) : value)])),
    }));
    yield { text, sop: serialize(named), count: example.count, excerpt: true };
  }
}

export function createTransfer(examples, { resolveValue, fillerPhrases = [] } = {}) {
  const envelope = makeEnvelope(fillerPhrases);
  const postings = new Map();
  const indexed = [];
  function index(example) {
    const ts = envelope(example.text).core;
    if (!ts.length || ts.length > 128) return;
    const id = indexed.length;
    indexed.push({example, length: ts.length});
    for (const gram of grams(ts)) {
      if (!postings.has(gram)) postings.set(gram, []);
      postings.get(gram).push(id);
    }
  }
  for (const example of examples) index(example);
  for (const example of examples) {
    for (const excerpt of excerpts(example)) index(excerpt);
  }
  return text => {
    const input = envelope(text);
    if (!input.core.length || input.core.length > 128) return [];
    const weights = new Map();
    const sets = [...grams(input.core)].map(gram => postings.get(gram)).filter(Boolean);
    sets.sort((left, right) => left.length - right.length);
    // Common words and phrases cannot nominate examples on their own once a
    // more discriminating posting supplies the search pool.
    for (const indices of sets) {
      const weight = Math.log1p(indexed.length / indices.length);
      if (weights.size > 4096) {
        for (const index of indices) {
          if (weights.has(index)) weights.set(index, weights.get(index) + weight);
        }
      } else {
        for (const index of indices) weights.set(index, (weights.get(index) ?? 0) + weight);
      }
    }
    const distance = id => Math.abs(indexed[id].length - input.core.length);
    const ranked = [...weights].sort((a, b) => b[1] - a[1] || distance(a[0]) - distance(b[0])).slice(0, 64);
    const candidates = new Map();
    for (const [index] of ranked) {
      const {example} = indexed[index];
      if (text === example.text && !example.excerpt) continue;
      try {
        for (const { sop, similarity, unread } of align(example, envelope(example.text).core, text, input, resolveValue, envelope)) {
          const support = example.count ?? 1;
          const previous = candidates.get(sop);
          if (!previous || similarity > previous.similarity) {
            candidates.set(sop, { sop, similarity, support, source: 'alignment', unread });
          } else if (similarity === previous.similarity) {
            previous.support += support;
          }
        }
      } catch (error) {
        if (error.name !== 'SopError') throw error;
      }
    }
    return [...candidates.values()].sort((a, b) => b.similarity - a.similarity || b.support - a.support);
  };
}
