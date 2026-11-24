import { parse, serialize } from '../.cache/knowledge/tools/sopworld/sopworld.mjs';
import { literalField } from './evidence.mjs';
import { tokens } from './lexicon.mjs';

const type = name => 'w.request.' + name;
const raw = (wire, name) => wire.attrs[name]?.[0];
const decode = value => value?.startsWith('"') ? JSON.parse(value) : value;
const get = (wire, name) => decode(raw(wire,name));
const word = /^[\p{L}\p{M}\p{N}_]+$/u;
const punctuation = new Set(['.', '!', '?']);

function locations(ts, surface, start = 0) {
  const forms = tokens(surface).map(token => token[0]);
  if (!forms.length) return [];
  return ts.flatMap((_,i) => i >= start && forms.every((word,j) => ts[i+j]?.[0] === word)
    ? [[i,i+forms.length]] : []);
}

function roleCues(grammar, family) {
  const cues = new Map();
  for (const {family:owner, attribute, role, surfaces} of grammar.bindings) {
    if (owner !== family) continue;
    const forms = role === 'name' ? [...surfaces,...grammar.namingLeads] : surfaces;
    for (const surface of forms) {
      const keys = cues.get(surface) ?? new Set();
      keys.add(attribute);
      cues.set(surface,keys);
    }
  }
  return cues;
}

function attachedCues(ts, headEnd, cues) {
  return [...cues].flatMap(([surface,keys]) => {
    const forms = surface.split(' ');
    return forms.every((form,i) => ts[headEnd+i]?.[0] === form)
      ? [{valueStart:headEnd+forms.length,keys}] : [];
  });
}

// Ground a trailing literal complement on a selected nominal. The input
// reading must leave that complement unread and supply the predicate and kind.
export function literalAttachments(text, candidate, worlds) {
  if (candidate.source !== 'lexicon' || !candidate.sop.includes(type('unread'))) return [];
  const wires = parse(candidate.sop);
  const requests = wires.filter(wire => wire.type === type('request'));
  const targets = wires.filter(wire => wire.type === type('target'));
  if (requests.length !== 1 || targets.length !== 1) return [];
  const [request] = requests, [target] = targets;
  const reference = '$' + request.id;
  const family = get(target,'family'), predicate = get(request,'predicate');
  const targetWords = get(target,'sort_words') ?? get(target,'family_words') ?? get(target,'sort');
  const mood = get(request,'mood');
  if (get(request,'act') !== 'make' || (mood && mood !== 'do') || get(target,'mode') !== 'new' ||
      raw(target,'request') !== reference || raw(target,'name') || !targetWords || !predicate) return [];
  const cues = roleCues(worlds.literalGrammar,family);
  if (!cues.size) return [];
  const ts = tokens(get(request,'words') ?? text);
  const chars = Array.from(get(request,'words') ?? text);
  const span = (first,last) => chars.slice(ts[first][2],ts[last-1][3]).join('');
  const pred = locations(ts,predicate);
  if (pred.length !== 1) return [];
  const [[verbStart,verbEnd]] = pred;
  const lead = ts.slice(0,verbStart).map(([form]) => form).filter(form => form !== ',').join(' ');
  if (!mood && lead && !worlds.literalGrammar.leads.has(lead) && !worlds.fillerPhrases.has(lead)) return [];
  const heads = locations(ts,targetWords,verbEnd)
    .map(([,end]) => ({end,matches:attachedCues(ts,end,cues)}))
    .filter(({matches}) => matches.length);
  if (heads.length !== 1) return [];
  const [{end:cueStart,matches}] = heads;
  let terminal = ts.length;
  while (punctuation.has(ts[terminal-1]?.[0])) terminal--;
  const unread = wires.filter(wire => wire.type === type('unread') && raw(wire,'request') === reference);
  const unreadSpans = unread.flatMap(wire => {
    const ranges = locations(ts,get(wire,'text'));
    return ranges.length === 1 ? [{wire,range:ranges[0]}] : [];
  });
  const grounded = wires.filter(wire => wire.type === type('constraint') && raw(wire,'request') === reference)
    .flatMap(wire => Object.entries(wire.attrs).flatMap(([slot,values]) =>
      (literalField(slot) || slot === 'value') ? values.flatMap(value => locations(ts,decode(value))) : []));
  const readings = [];
  for (const {valueStart,keys} of matches) {
    let end = valueStart;
    while (end < terminal && unreadSpans.some(({range:[a,b]}) => cueStart <= a && a <= end && end < b)) end++;
    if (valueStart >= end || (end < terminal &&
        !(grounded.some(([a]) => a === end) &&
          worlds.lookup(ts[end][0]).some(([role]) => role === 'marker')))) continue;
    const payload = ts.slice(valueStart,end);
    if (!payload.every(([form]) => word.test(form)) ||
        !payload.some(([form]) => /\p{L}/u.test(form))) continue;
    // An unquoted span cannot swallow a new clause or an adjunct. These
    // boundaries depend on the language world, and arbitrary text may be quoted.
    if (payload.some(([form]) => Object.hasOwn(worlds.joiners,form) ||
        worlds.negatives.has(form) || worlds.lookup(form).some(([role]) => role === 'marker'))) continue;
    const value = span(valueStart,end);
    if (worlds.isReference(value) || /[\r\n]/u.test(value)) continue;
    const covered = unreadSpans.filter(({range:[a,b]}) => cueStart <= a && b <= (end === terminal ? ts.length : end));
    if (grounded.some(([a,b]) => a < end && b > cueStart)) continue;
    const removed = new Set(covered.map(({wire}) => wire));
    let id = request.id + '.literal', suffix = 2;
    while (wires.some(wire => wire.id === id)) id = request.id + '.literal' + suffix++;
    for (const key of keys) {
      if (wires.some(wire => wire.type === type('constraint') &&
          get(wire,'attribute') === key && get(wire,'phase') === 'result')) continue;
      const constraint = {id,type:type('constraint'),attrs:{
        request:[reference],on:['attribute'],attribute:[key],value:[JSON.stringify(value)],
        operator:['eq'],phase:['result'],key_words:[JSON.stringify(span(cueStart,valueStart))],
      }};
      const attached = [...wires.filter(wire => !removed.has(wire)),constraint];
      readings.push({...candidate,sop:serialize(attached).trimEnd(),source:'literal-attachment',
        status:attached.some(wire => wire.type === type('unread')) ? 'partial' : 'matched'});
    }
  }
  return readings;
}
