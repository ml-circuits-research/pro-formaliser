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

function makeLicensedBody(worlds,discourse) {
  const {scopeGrammar,bodyLeads}=worlds;
  const polite=new Set(discourse.filter(({class:kind})=>kind==='politeness'||kind==='interjection').map(({text})=>text));
  const unsafe=form=>worlds.joiners[form] || scopeGrammar.rejections.has(form) ||
    scopeGrammar.conditionals.has(form) || [form,...form.split(' ')].some(part=>
      worlds.negatives.has(part) || scopeGrammar.negatives.has(part));
  const actionOnly=new Set(bodyLeads?.actionOnly ?? []);
  const neutral=new Set([...polite,...(bodyLeads?.neutral ?? []),...actionOnly].filter(form=>!unsafe(form)));
  const nominal=new Set(bodyLeads?.nominal ?? scopeGrammar.proposals);
  const courtesy=scopeGrammar.courtesy;
  const ordinary=surface=>worlds.lookup(surface).some(([role,act,mood])=>role==='act' && act!=='ask' &&
    (!mood || mood==='do'));
  return text=>{
    const ts=tokenize(text);
    let first=0,after=ts.length;
    while (after && terminal.test(ts[after-1].raw)) after--;
    const interrogative=ts.slice(after).some(({raw})=>question.test(raw));
    const extras=[];
    const surface=(from,to)=>text.slice(ts[from].start,ts[to-1].end);
    const form=(from,to)=>ts.slice(from,to).map(token=>token.key).join(' ');
    const prefix=(forms,from)=>{
      for (let i=Math.min(after-1,from+12);i>from;i--) {
        if (forms.has(form(from,i))) return i;
      }
      return from;
    };
    for (let n=0;n<2;n++) {
      const next=prefix(neutral,first);
      if (next===first) break;
      const openingForm=form(first,next),plain=polite.has(openingForm),active=actionOnly.has(openingForm);
      const separated=separator.test(ts[next].raw);
      if (!plain && !active && !separated) break;
      extras.push({text:surface(first,next),range:[ts[first].start,ts[next-1].end],plain,active});
      first=next+Number(separated);
    }
    for (let i=Math.max(first+1,after-12);i<after;i++) {
      const formAt=form(i,after), separated=separator.test(ts[i-1].raw);
      if (!polite.has(formAt) && !(separated && courtesy.has(formAt))) continue;
      extras.push({text:surface(i,after),range:[ts[i].start,ts[after-1].end],plain:true});
      after=i-Number(separated);
      break;
    }
    if (first>=after || !word.test(ts[first].raw)) return [];
    const end=ts[after-1].end;
    const readings=[];
    const opening=prefix(nominal,first);
    const openingForm=form(first,opening);
    if (opening>first && !extras.some(extra=>extra.active) &&
        ['indefinite','quantified'].includes(worlds.determiners[ts[opening]?.key]) && !unsafe(openingForm) &&
        (scopeGrammar.proposals.has(openingForm) || scopeGrammar.subjects.has(ts[first].key)) &&
        !worlds.lookup(openingForm).some(([role])=>role==='act')) {
      const start=ts[opening].start;
      const leadEnd=ts[opening-1].end;
      readings.push({start,end,extras,opening:[ts[first].start,leadEnd],predicate:surface(first,opening),
        key:'nominal:'+text.slice(start,end)});
    }
    // A non-courtesy boundary opener is optional only before a grounded verb.
    const plain=extras.every(extra=>!extra.active);
    if (extras.length && (plain || Array.from({length:Math.min(after-first,8)},(_,i)=>first+i+1).some(i=>ordinary(form(first,i))))) {
      const start=ts[first].start;
      readings.push({start,end,extras,key:(interrogative?'?':'.')+text.slice(start,end)});
    }
    return readings;
  };
}

function transfer(example, from, to, input, worlds) {
  const text = example.text;
  const wires = parse(example.sop);
  if (!wires.some(wire => wire.type === request) || wires.some(wire =>
    contextual.has(wire.type) || wire.type === 'w.request.lookup' && decode(wire.attrs.from?.[0] ?? '') === 'previous')) return;
  if (from.extras.some(extra=>typeof extra!=='string' && !extra.plain && !wires.some(wire=>
    wire.type===filler && wire.attrs.text?.some(item=>literalRanges(text,decode(item),...extra.range).length)))) return;
  const requestWires=wires.filter(wire=>wire.type===request);
  const get=(wire,key)=>decode(wire.attrs[key]?.[0] ?? '');
  if (from.extras.some(extra=>extra.active) || to.extras.some(extra=>extra.active)) {
    if (requestWires.length!==1) return;
    const [r]=requestWires, predicate=get(r,'predicate'),act=get(r,'act');
    if (get(r,'mood')!=='do' || !literalRanges(text,predicate,from.start,from.end).some(([start])=>start===from.start) ||
        !worlds.lookup(tokenize(predicate).map(token=>token.key).join(' ')).some(([role,sense,mood])=>
          role==='act' && sense===act && act!=='ask' && (!mood || mood==='do'))) return;
  }

  if (to.opening) {
    const targets=wires.filter(wire=>wire.type==='w.request.target');
    if (!from.opening || requestWires.length!==1 || targets.length!==1) return;
    const [r]=requestWires,[target]=targets;
    const act=get(r,'act'),family=get(target,'family');
    if (get(r,'mood')!=='do' || act!=='make' || get(target,'mode')!=='new' ||
        get(target,'request')!=='$'+r.id || !worlds.literalGrammar.licenses(family,act)) return;
  }

  const copied = [], unread = [];
  const inside = ([start, end]) => from.start <= start && end <= from.end;
  for (const {id, type, attrs} of wires) {
    if (type === filler && attrs.text?.every(item => {
      const span = literalRanges(text, decode(item));
      return span.length && span.every(([start, end]) => end <= from.start || start >= from.end);
    })) continue;

    if (type===request && to.opening) {
      if (attrs.predicate?.some(item=>!literalRanges(text,decode(item),...from.opening).length)) return;
      if (attrs.words?.some(item=>!literalRanges(text,decode(item)).some(([left,right])=>
        left<=from.start && from.end<=right))) return;
      attrs.predicate=[encode(to.predicate)];
      attrs.words=[encode(input.slice(to.opening[0],to.end))];
    }

    for (const [key, values] of Object.entries(attrs)) {
      if (type===request && to.opening && ['words','predicate'].includes(key)) continue;
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
  for (const extra of to.extras) {
    let id;
    do { id = 'near.f' + (++n); } while (ids.has(id));
    copied.push({id, type:filler, attrs:{text:[encode(typeof extra==='string' ? extra : extra.text)]}});
  }
  const sop = copied.map(({id, type, attrs}) => ['@' + id, type,
    ...Object.entries(attrs).flatMap(([key, values]) => values.map(value => key + '=' + value)),
  ].join(' ')).join('\n');
  return { sop, support:example.count ?? 1, unread:unread.join(' ') };
}

export function createNearExample(examples, {discourse = [], worlds} = {}) {
  const body = makeBody(discourse);
  const licensed=worlds && makeLicensedBody(worlds,discourse);
  const surfaces=text=>{
    const original=body(text);
    const variants=new Map(original ? [[original.key,original]] : []);
    for (const reading of licensed?.(text) ?? []) if (!variants.has(reading.key)) variants.set(reading.key,reading);
    return [...variants.values()];
  };
  const index = new Map();
  for (const example of examples) {
    for (const surface of surfaces(example.text)) {
      const found = index.get(surface.key), entry={example,surface};
      if (Array.isArray(found)) found.push(entry);
      else index.set(surface.key, found ? [found,entry] : entry);
    }
  }
  return text => {
    const readings = new Map();
    const seen=new Map();
    for (const surface of surfaces(text)) {
      const found=index.get(surface.key);
      if (!found) continue;
      for (const {example,surface:from} of Array.isArray(found) ? found : [found]) {
        if (example.text === text) continue;
        try {
          const candidate = transfer(example,from,surface,text,worlds);
          if (!candidate) continue;
          const seenExamples=seen.get(candidate.sop) ?? new Set();
          if (seenExamples.has(example)) continue;
          seenExamples.add(example);
          seen.set(candidate.sop,seenExamples);
          const previous = readings.get(candidate.sop);
          if (previous) previous.support += candidate.support;
          else readings.set(candidate.sop, candidate);
        } catch (error) {
          if (error.name !== 'SopError') throw error;
        }
      }
    }
    return [...readings.values()].sort((a, b) => Number(Boolean(a.unread)) - Number(Boolean(b.unread)) ||
      b.support - a.support);
  };
}
