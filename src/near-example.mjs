import { literalField, literalRanges, sortRanges } from './evidence.mjs';
import { tokenize } from './model.mjs';
import { parse } from './schema.mjs';

const request = 'w.request.request';
const filler = 'w.request.filler';
const unresolved = 'w.request.unread';
const contextual = new Set(['w.request.clock', 'w.request.context', 'w.request.previous']);
const terminal = /^[.!?。！？]$/u;
const question = /^[?？]$/u;
const separator = /^[,，:—–]$/u;
const word = /^[\p{L}\p{N}\p{M}_]+$/u;
const decode = value => value.startsWith('"') ? JSON.parse(value) : value;
const encode = value => JSON.stringify(value);

function makeBody(discourse) {
  // Other declared fillers can express timing, degree, or uncertainty. Keep
  // them in the exact body along with quoted text and internal punctuation.
  const phrases = discourse
    .filter(({ class: kind }) => kind === 'politeness' || kind === 'interjection')
    .map(({text}) => tokenize(text).map(token => token.key))
    .filter(keys => keys.length)
    .sort((a, b) => b.length - a.length);
  return text => {
    const ts = tokenize(text);
    const extras = [];
    let first = 0, after = ts.length;
    while (after && terminal.test(ts[after - 1].raw)) after--;
    const interrogative = ts.slice(after).some(({raw}) => question.test(raw));
    const matches = (keys, from) => keys.every((key, i) => ts[from + i].key === key);
    const surface = (from, to) => text.slice(ts[from].start, ts[to - 1].end);
    for (const keys of phrases) {
      const next = keys.length;
      if (next >= after || !matches(keys, 0) ||
          !separator.test(ts[next].raw) && ts[next - 1].end === ts[next].start) continue;
      extras.push(surface(0, next));
      first = next + Number(separator.test(ts[next].raw));
      break;
    }
    for (const keys of phrases) {
      const from = after - keys.length;
      if (from <= first || !matches(keys, from) ||
          !separator.test(ts[from - 1].raw) && ts[from - 1].end === ts[from].start) continue;
      extras.push(surface(from, after));
      after = from - Number(separator.test(ts[from - 1].raw));
      break;
    }
    if (first >= after || !ts.slice(first, after).some(({raw}) => word.test(raw))) return;
    const start = ts[first].start, end = ts[after - 1].end;
    const key = (interrogative ? '?' : '.') + text.slice(start, end);
    return { start, end, extras, key };
  };
}

function transfer(example, from, to) {
  const text = example.text;
  const wires = parse(example.sop);
  if (!wires.some(wire => wire.type === request) || wires.some(wire =>
    contextual.has(wire.type) || wire.type === 'w.request.lookup' && decode(wire.attrs.from?.[0] ?? '') === 'previous')) return;

  const copied = [], unread = [];
  const inside = ([start, end]) => from.start <= start && end <= from.end;
  for (const {id, type, attrs} of wires) {
    if (type === filler && attrs.text?.every(item => {
      const span = literalRanges(text, decode(item));
      return span.length && span.every(([start, end]) => end <= from.start || start >= from.end);
    })) continue;

    for (const [key, values] of Object.entries(attrs)) {
      for (const [index, item] of values.entries()) {
        const value = decode(item);
        const ranges = type === 'w.request.target' && key === 'sort' && !attrs.sort_words
          ? sortRanges(text, value) : literalRanges(text, value);
        if (ranges.some(inside)) continue;
        if (type === request && key === 'words' && ranges.length === 1) {
          // Request words can enclose the whole utterance. Narrow this scope
          // to the unchanged body without changing any dependent evidence.
          const [start, end] = ranges[0];
          const clipStart = Math.max(start, from.start), clipEnd = Math.min(end, from.end);
          if (clipStart >= clipEnd) return;
          values[index] = encode(text.slice(clipStart, clipEnd));
          continue;
        }
        const required = literalField(key) || type === 'w.request.constraint' && key === 'value' &&
          (!attrs.words || item.startsWith('"'));
        if (required || ranges.length && !item.startsWith('$')) return;
      }
    }
    if (type === unresolved) unread.push(...(attrs.text ?? []).map(decode));
    copied.push({id, type, attrs});
  }

  const ids = new Set(wires.map(({id}) => id));
  let n = 0;
  for (const text of to.extras) {
    let id;
    do { id = 'near.f' + (++n); } while (ids.has(id));
    copied.push({id, type:filler, attrs:{text:[encode(text)]}});
  }
  const sop = copied.map(({id, type, attrs}) => ['@' + id, type,
    ...Object.entries(attrs).flatMap(([key, values]) => values.map(value => key + '=' + value)),
  ].join(' ')).join('\n');
  return { sop, support:example.count ?? 1, unread:unread.join(' ') };
}

export function createNearExample(examples, {discourse = []} = {}) {
  const body = makeBody(discourse);
  const index = new Map();
  for (const example of examples) {
    const surface = body(example.text);
    if (!surface) continue;
    const found = index.get(surface.key);
    if (Array.isArray(found)) found.push(example);
    else index.set(surface.key, found ? [found, example] : example);
  }
  return text => {
    const surface = body(text);
    if (!surface) return [];
    const readings = new Map();
    const found = index.get(surface.key);
    if (!found) return [];
    for (const example of Array.isArray(found) ? found : [found]) {
      if (example.text === text) continue;
      try {
        const candidate = transfer(example, body(example.text), surface);
        if (!candidate) continue;
        const previous = readings.get(candidate.sop);
        if (previous) previous.support += candidate.support;
        else readings.set(candidate.sop, candidate);
      } catch (error) {
        if (error.name !== 'SopError') throw error;
      }
    }
    return [...readings.values()].sort((a, b) => Number(Boolean(a.unread)) - Number(Boolean(b.unread)) ||
      b.support - a.support);
  };
}
