import { literalField, literalRanges } from './evidence.mjs';
import { tokens } from './lexicon.mjs';
import { quotedSpans } from './literal-roles.mjs';
import { consumeUnread } from './nominal-evidence.mjs';
import { observeMeaning, supportedMeaning } from './training-evidence.mjs';
import { parse, serialize } from '../.cache/knowledge/tools/sopworld/sopworld.mjs';

const requestType = 'w.request.request';
const targetType = 'w.request.target';
const constraintType = 'w.request.constraint';
const unreadType = 'w.request.unread';
const nameSlot = 'target.name';
const word = /^[\p{L}\p{M}\p{N}_]+$/u;
const textValue = /\p{L}/u;
const punctuation = /^[,.;:!?—–，。！？；：]$/u;
const decode = value => value?.startsWith('"') ? JSON.parse(value) : value;
const field = (wire, key) => decode(wire.attrs[key]?.[0]);
const keyOf = (request, target) => JSON.stringify([field(target,'family'), field(request,'act'), field(target,'mode')]);
const normalized = text => text.normalize('NFKC').toLowerCase().trim().replace(/\s+/gu,' ');
const asAtom = value => /^[\p{L}_][\p{L}\p{M}\p{N}_.-]*$/u.test(value) ? value : JSON.stringify(value);

function vocabulary(worlds) {
  return new Set(worlds.requestKeys.filter(k => k.head.split('+').includes('span') && !k.values.length)
    .map(k => JSON.stringify([k.family,k.name])));
}

function located(scope, ts, quotes, value) {
  if (!value || !textValue.test(value)) return;
  const hits = literalRanges(scope,value);
  if (hits.length !== 1) return;
  const [[start,end]] = hits;
  let from = Array.from(scope.slice(0,start)).length, to = from + Array.from(scope.slice(start,end)).length;
  const touched = quotes.filter(quote => quote.start < to && from < quote.end);
  if (touched.length) {
    if (touched.length !== 1 || touched[0].value !== value) return;
    [{start:from,end:to}] = touched;
  }
  const a = ts.findIndex(token => token[2] === from), b = ts.findIndex(token => token[3] === to);
  return a >= 0 && b >= a ? [a,b+1] : undefined;
}

export function createOpenPairLearner(worlds) {
  const licensed = vocabulary(worlds), frames = new Map();
  return {
    observe(text, request, target, constraints) {
      const family = field(target,'family'), mode = field(target,'mode');
      if (!family || !field(request,'act') || !['new','existing'].includes(mode)) return;
      const ref = '$' + request.id;
      const slots = constraints.filter(wire => field(wire,'request') === ref && wire.attrs.value?.length === 1 &&
        licensed.has(JSON.stringify([family,field(wire,'attribute')])) &&
        field(wire,'on') === 'attribute' && (field(wire,'operator') ?? 'eq') === 'eq' &&
        !['no','not_all'].includes(field(wire,'want')) && !wire.attrs.unit && !wire.attrs.measure)
        .map(wire => ({key:field(wire,'attribute'),phase:field(wire,'phase') ?? 'result',value:field(wire,'value')}));
      if (mode === 'existing' && field(target,'name')) {
        slots.push({key:nameSlot,phase:'selector',value:field(target,'name')});
      }
      if (slots.length < 2) return;
      const scope = field(request,'words') ?? text;
      if (!literalRanges(text,scope).length) return;
      const ts = tokens(scope), quotes = quotedSpans(scope);
      const exact = slots.flatMap(slot => {
        const position = located(scope,ts,quotes,slot.value);
        return position ? [{...slot,position}] : [];
      }).sort((a,b) => a.position[0] - b.position[0]);
      const identity = keyOf(request,target);
      for (let i=1; i<exact.length; i++) {
        const left = exact[i-1], right = exact[i];
        const [start,end] = left.position, [next] = right.position;
        if (left.key === right.key || !start || next <= end || next - end > 4) continue;
        const connector = ts.slice(end,next).map(token => token[0]);
        if (!connector.every(token => word.test(token))) continue;
        const meaning = JSON.stringify([[left.key,left.phase],[right.key,right.phase]]);
        for (let width=1; width<=Math.min(start,4); width++) {
          const prefix = ts.slice(start-width,start).map(token => token[0]);
          if (!prefix.every(token => word.test(token))) break;
          const frame = JSON.stringify([identity,prefix,connector]);
          const evidence = frames.get(frame) ?? {observations:new Map(), operands:new Map()};
          frames.set(frame,evidence);
          const values = evidence.operands.get(meaning) ?? [new Set(),new Set()];
          evidence.operands.set(meaning,values);
          values[0].add(normalized(left.value));
          values[1].add(normalized(right.value));
          observeMeaning(evidence.observations,scope,meaning);
        }
      }
    },
    finish() {
      const learned = {};
      for (const [frame,{observations,operands}] of frames) {
        const meaning = supportedMeaning(observations);
        if (!meaning || observations.size < 4 || operands.get(meaning).some(values => values.size < 2)) continue;
        const [identity,prefix,connector] = JSON.parse(frame);
        (learned[identity] ??= []).push({prefix,connector,slots:JSON.parse(meaning),support:observations.size});
      }
      return learned;
    },
  };
}

function matchesAt(visible, start, keys) {
  return keys.every((key,i) => visible[start+i] === key);
}

function anchored(prefix, request, family, worlds) {
  for (let start=0; start<prefix.length; start++) {
    for (let end=start+1; end<=prefix.length; end++) {
      const surface = prefix.slice(start,end).join(' ');
      if (surface === field(request,'predicate')?.toLowerCase() ||
        worlds.lookup(surface).some(([role,,target]) => role === 'target' && target === family)) return true;
    }
  }
  return false;
}

function readOperand(ts, quotes, worlds, family, span, start, end) {
  if (start >= end || end - start > 14) return;
  const from = ts[start][2], to = ts[end-1][3];
  const touched = quotes.filter(quote => quote.start < to && from < quote.end);
  if (touched.length) {
    const [quote] = touched;
    if (touched.length !== 1 || quote.start !== from || quote.end !== to || !textValue.test(quote.value)) return;
    return {value:quote.value,from,to};
  }
  if (!word.test(ts[start][0]) || !word.test(ts[end-1][0]) ||
      !ts.slice(start,end).some(([token]) => textValue.test(token) && !Object.hasOwn(worlds.determiners,token)) ||
      worlds.lookup(ts[start][0]).some(([role]) => role === 'marker')) return;
  for (let i=start; i<end; i++) {
    const [token] = ts[i];
    const question = worlds.scopeGrammar.questions.get(token);
    if (punctuation.test(token) || worlds.negatives.has(token) || question && !question.requiresAsk ||
        worlds.scopeGrammar.auxiliary.has(token) || worlds.scopeGrammar.conditionals.has(token) ||
        ['sequence','clause','contrast'].includes(worlds.joiners[token]) ||
        worlds.lookup(token).some(([role,,kind]) => role === 'marker' && ['part','replacement','tool','format'].includes(kind))) return;
    for (let after=i+2; after<=Math.min(end,i+4); after++) {
      const cue = ts.slice(i,after).map(part => part[0]).join(' ');
      if (worlds.lookup(cue).some(([role,,target]) => role === 'target' && target === family)) return;
    }
  }
  const value = span(from,to);
  return textValue.test(value) && !worlds.isReference(value) ? {value,from,to} : undefined;
}

function safetyTail(ts, visible, start, stop, worlds) {
  for (let i=start; i<stop; i++) {
    if (!visible[i]) continue;
    const token = ts[i][0];
    if (punctuation.test(token) || ['sequence','clause','contrast'].includes(worlds.joiners[token])) return i;
    if (worlds.joiners[token] === 'coordination' &&
        worlds.lookup(visible[i+1] ?? '').some(([role]) => role === 'act')) return i;
  }
  return stop;
}

function readFrames(ts, quotes, span, request, target, forms, worlds, start, stop) {
  const visible = ts.map(([lower,,from]) => quotes.some(q => q.start <= from && from < q.end) ? '' : lower);
  const family = field(target,'family');
  const readings = [];
  for (const {prefix,connector,slots,support} of forms) {
    if (!anchored(prefix,request,family,worlds)) continue;
    for (let i=start; i+prefix.length<stop; i++) {
      if (!matchesAt(visible,i,prefix)) continue;
      const leftStart = i+prefix.length;
      const end = safetyTail(ts,visible,leftStart,stop,worlds);
      for (let split=leftStart+1; split+connector.length<end; split++) {
        if (!matchesAt(visible,split,connector)) continue;
        const first = readOperand(ts,quotes,worlds,family,span,leftStart,split);
        const second = readOperand(ts,quotes,worlds,family,span,split+connector.length,end);
        if (!first || !second) continue;
        readings.push({first,second,slots,support,start:i,split,end,connectorSize:connector.length,prefixSize:prefix.length});
      }
    }
  }
  if (!readings.length) return;
  readings.sort((a,b) => b.prefixSize-a.prefixSize || b.connectorSize-a.connectorSize || b.support-a.support);
  const best = readings[0];
  const signature = reading => JSON.stringify([reading.slots,reading.first,reading.second]);
  // More-specific aliases for the same occurrence do not create a second
  // reading. Independently eligible separators or spans stay ambiguous.
  if (readings.some(reading => signature(reading) !== signature(best) &&
    (reading.prefixSize === best.prefixSize && reading.connectorSize === best.connectorSize ||
     reading.first.from !== best.first.from ||
     reading.split >= best.split + best.connectorSize || best.split >= reading.split + reading.connectorSize))) return;
  return best;
}

export function openPairReadings(text, ts, quotes, candidate, learned, worlds) {
  if (!learned || !candidate.sop) return [];
  const wires = parse(candidate.sop);
  const requests = wires.filter(wire => wire.type === requestType), targets = wires.filter(wire => wire.type === targetType);
  if (requests.length !== 1 || targets.length !== 1) return [];
  const [request] = requests, [target] = targets;
  const forms = learned[keyOf(request,target)];
  const ref = '$' + request.id;
  if (!forms?.length || field(target,'request') !== ref) return [];
  const scope = field(request,'words') ?? text, located = literalRanges(text,scope);
  if (located.length !== 1) return [];
  const [utfStart] = located[0];
  const start = Array.from(text.slice(0,utfStart)).length, end = start + Array.from(scope).length;
  const chars = Array.from(text);
  const span = (a,b) => chars.slice(a,b).join('');
  const startIndex = ts.findIndex(token => token[2]>=start);
  const stopIndex = ts.findIndex(token => token[2]>=end);
  if (startIndex < 0 || ts.slice(startIndex,stopIndex<0 ? ts.length : stopIndex).some(([token,,from]) =>
    !quotes.some(q => q.start<=from && from<q.end) && (worlds.negatives.has(token) ||
      worlds.scopeGrammar.negatives.has(token) || worlds.scopeGrammar.conditionals.has(token)))) return [];
  const reading = readFrames(ts,quotes,span,request,target,forms,worlds,startIndex,stopIndex<0 ? ts.length : stopIndex);
  if (!reading) return [];
  const operands = [reading.first,reading.second], slots = reading.slots;
  const constraints = wires.filter(wire => wire.type === constraintType);
  const family = field(target,'family');
  if (slots.some(([key]) => key !== nameSlot && !worlds.requestKeys.some(prop =>
    prop.family === family && prop.name === key && prop.head.split('+').includes('span') && !prop.values.length))) return [];
  const added = [], ids = new Set(wires.map(w => w.id));
  let revised = target;
  for (const [index,[key,phase]] of slots.entries()) {
    const {value} = operands[index];
    if (key === nameSlot) {
      const name = field(target,'name');
      if (name && name !== value || field(target,'mode') !== 'existing') return [];
      if (name !== value) revised = {...target,attrs:{...target.attrs,fill:['written'],name:[JSON.stringify(value)]}};
      continue;
    }
    const existing = constraints.filter(w => field(w,'attribute') === key && (field(w,'phase') ?? 'result') === phase);
    if (existing.some(w => field(w,'value') !== value)) return [];
    if (existing.length) continue;
    const stem = target.id+'.pair'+(index+1);
    let id = stem;
    for (let n=2; ids.has(id); n++) id = stem+'.'+n;
    added.push({id,type:constraintType,attrs:{request:[ref],on:['attribute'],attribute:[asAtom(key)],
      value:[JSON.stringify(value)],words:[JSON.stringify(value)],operator:['eq'],phase:[phase]}});
  }
  if (revised === target && !added.length) return [];
  const replaced = new Set(slots.map(([key]) => key));
  const from = span(0,reading.first.from).length, to = span(0,reading.second.to).length;
  const overlaps = operand => literalRanges(text,operand).some(([a,b]) => a < to && b > from);
  for (const wire of wires) {
    if (wire === request || wire.type === unreadType || replaced.has(field(wire,'attribute'))) continue;
    const evidence = Object.keys(wire.attrs).filter(literalField);
    if (wire.type === constraintType && !wire.attrs.words && wire.attrs.value) evidence.push('value');
    if (evidence.some(k => wire.attrs[k].some(item => overlaps(decode(item))))) return [];
  }
  const remaining = consumeUnread(wires.map(wire => wire === target ? revised : wire), text, from, to);
  return [{sop:serialize([...remaining,...added]),source:'open-pair',support:reading.support,
    status:remaining.some(wire => wire.type === unreadType) ? 'partial' : 'matched'}];
}
