import { parse, serialize, str } from '../.cache/knowledge/tools/sopworld/sopworld.mjs';
import { visibleTokens } from './composition.mjs';
import { tokens } from './lexicon.mjs';
import { tupleAssignments } from './tuple-assignments.mjs';

const requestType = 'w.request.request';
const word = /[\p{L}\p{N}]/u;
const one = (wire, key) => str(wire.attrs[key]?.[0]);
const terms = text => tokens(text).map(([key]) => key);
const matches = (keys, at, sequence) => sequence.every((key, i) => key === keys[at + i]);
const quote = JSON.stringify;

export function compileRequestIntents(facts) {
  const frames = (type, fields) => facts(type).flatMap(wire =>
    (wire.attrs.text ?? []).map(raw => ({cue: terms(str(raw)), ...Object.fromEntries(
      fields.map(key => [key, one(wire, key)]))})).filter(frame => frame.cue.length));
  const results = frames('pro.reader.result_request', ['question', 'qualifier'])
    .sort((a, b) => Number(Boolean(b.qualifier)) - Number(Boolean(a.qualifier)));
  return {
    results,
    predicates: new Set(results.map(frame => frame.cue.join(' '))),
    intents: frames('pro.reader.request_intent_frame', ['role', 'form', 'owner', 'want', 'resolution'])
      .sort((a, b) => b.cue.length - a.cue.length),
  };
}

export function resultRequestReading(text, ts, worlds) {
  const keys = ts.map(([key]) => key);
  const frame = worlds.requestIntents.results.find(({cue, qualifier}) =>
    matches(keys, 0, cue) && (!qualifier || keys[cue.length] === qualifier));
  if (!frame || keys.some(key => worlds.joiners[key] || worlds.negatives.has(key) ||
    worlds.scopeGrammar.conditionals.has(key)) || requestIntentPlans(text,worlds).length) return;
  const end = ts.length - Number(['.', '?', '!'].includes(keys.at(-1)));
  const first = frame.cue.length;
  const operand = keys.slice(first, end);
  if (operand.length <= Number(Boolean(frame.qualifier)) || operand.some(key => !word.test(key))) return;
  const chars = Array.from(text);
  const predicate = chars.slice(0, ts[first - 1][3]).join('');
  const asked = chars.slice(ts[first][2], ts[end - 1][3]).join('');
  return {source: 'written-result-request', status: 'matched', sop: serialize([
    {id: 'r', type: requestType, attrs: {act: ['ask'], mood: ['do'], question: [frame.question],
      predicate: [quote(predicate)], asked_words: [quote(asked)], words: [quote(text)]}},
  ])};
}

export function requestIntentPlans(text, worlds, crossesRequest = () => false) {
  const ts = tokens(text), chars = Array.from(text), keys = visibleTokens(chars, ts);
  const end = keys.length - Number(['.', '?', '!'].includes(keys.at(-1)));
  if (end < 4 || end > 72) return [];
  const span = (from, to) => chars.slice(ts[from][2], ts[to - 1][3]).join('');
  const events = [];
  const verbalPurpose = (start, frame) => {
    const ends = ts.slice(start, start + 5).map((_, offset) => start + offset + 1)
      .filter(stop => worlds.lookup(keys.slice(start, stop).join(' ')).some(([role]) => role === 'act'));
    if (!ends.length) return false;
    return !ends.some(stop => worlds.tuples(keys.slice(start-frame.cue.length,stop).join(' '))
      .some(tuple => tupleAssignments(ts,stop,tuple.labels)));
  };
  for (let i = 1; i < end; i++) {
    for (const frame of worlds.requestIntents.intents) {
      const valueStart = i + frame.cue.length;
      if (valueStart >= end || !matches(keys, i, frame.cue) || !word.test(keys[valueStart]) ||
          frame.form === 'nominal' && worlds.scopeGrammar.universalHeads.has(keys[valueStart]) ||
          frame.form === 'verbal' && !verbalPurpose(valueStart, frame)) continue;
      const previous = keys[i - 1];
      const boundary = previous === ',' || worlds.joiners[previous] === 'coordination' ? i - 1 : i;
      events.push({start: i, boundary, valueStart, frame});
      i = valueStart - 1;
      break;
    }
  }
  return events.flatMap((first, i) => {
    if (!first.boundary) return [];
    const tail = [first];
    for (const event of events.slice(i + 1)) {
      if (event.boundary >= tail.at(-1).valueStart &&
          (event.boundary < event.start || worlds.joiners[keys[event.start]] === 'coordination' ||
            event.frame.want === 'no' || event.frame.resolution === 'unresolved')) {
        tail.push(event);
      }
    }
    const intents = tail.map(({start, valueStart, frame}, j) => {
      const stop = tail[j + 1]?.boundary ?? end;
      if (valueStart >= stop || keys.slice(valueStart, stop).some(key => !key || ['.', '?', '!', ';'].includes(key) ||
          worlds.scopeGrammar.conditionals.has(key))) return;
      const value = span(valueStart, stop);
      return crossesRequest(value) ? undefined : {...frame, value, words: span(start, stop)};
    });
    return intents.every(Boolean) ? [{body: span(0, first.boundary), intents}] : [];
  });
}

export function withRequestIntents(text, plan, candidate) {
  const wires = parse(candidate.sop);
  const requests = wires.filter(wire => wire.type === requestType);
  const owner = requests.findLast(request => {
    const words = one(request, 'words');
    return words ? plan.body.endsWith(words) : requests.length === 1;
  });
  if (!owner || !one(owner, 'predicate') || plan.intents.some(intent => intent.owner === 'answer') &&
      !(one(owner, 'act') === 'ask' && one(owner, 'question'))) return;
  const ref = '$' + owner.id;
  const keepsMeaning = wires.some(wire => one(wire, 'request') === ref && wire.type === 'w.request.target') ||
    one(owner, 'asked_words');
  if (!keepsMeaning) return;
  const scope = one(owner, 'words') ?? plan.body;
  owner.attrs.words = [quote(text.slice(plan.body.length - scope.length))];
  const ids = new Set(wires.map(wire => wire.id));
  let n = 0;
  let hasUnresolved = false;
  for (const {role, value, words, want, resolution} of plan.intents) {
    while (ids.has('intent.' + n)) n++;
    const id = 'intent.' + n++;
    if (resolution === 'unresolved') {
      hasUnresolved = true;
      wires.push({id, type: 'w.request.unread', attrs: {
        request: [ref], text: [quote(words)], note: [quote('unresolved ' + role)],
      }});
    } else {
      wires.push({id, type: 'w.request.intent', attrs: {
        request: [ref], role: [role], value: [quote(value)], words: [quote(words)], want: [want],
      }});
    }
  }
  return {sop: serialize(wires), status: hasUnresolved ? 'partial' : candidate.status, source: 'request-intent'};
}
