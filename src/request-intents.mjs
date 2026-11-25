import { parse, serialize, str } from '../.cache/knowledge/tools/sopworld/sopworld.mjs';
import { visibleTokens } from './composition.mjs';
import { literalRanges } from './evidence.mjs';
import { quotedSpans } from './literal-roles.mjs';
import { tokens } from './lexicon.mjs';
import { resolveWrittenMeasurement } from './owner-property.mjs';
import { tupleAssignments } from './tuple-assignments.mjs';
import { detachedDiscourse } from './trailing-discourse.mjs';

const requestType = 'w.request.request';
const word = /[\p{L}\p{N}]/u;
const one = (wire, key) => str(wire.attrs[key]?.[0]);
const terms = text => tokens(text).map(([key]) => key);
const matches = (keys, at, sequence) => sequence.every((key, i) => key === keys[at + i]);
const quote = JSON.stringify;

function replacementMarkers(facts) {
  const replacementFirst=new Set(facts('k.actions.verb').filter(wire=>one(wire,'object')==='replacement')
    .flatMap(wire=>(wire.attrs.text ?? []).map(raw=>terms(str(raw)).join(' '))));
  const byVerb=new Map();
  for (const wire of facts('k.actions.marking')) {
    const verb=terms(one(wire,'verb') ?? '').join(' '), role=one(wire,'role');
    if (!verb || role!=='replacement' && !(role==='thing' && replacementFirst.has(verb))) continue;
    const marker=terms(one(wire,'marker') ?? '');
    if (!marker.length) continue;
    const markers=byVerb.get(verb) ?? [];
    markers.push(marker);
    byVerb.set(verb,markers);
  }
  return byVerb;
}

function reservesReplacement(scope,predicate,intents,worlds) {
  const purposes=intents.filter(intent=>intent.role==='purpose' && intent.form==='nominal');
  if (!purposes.length) return false;
  const ts=tokens(scope), keys=visibleTokens(Array.from(scope),ts), bank=worlds.requestIntents.replacementMarkers;
  let head;
  for (let i=0;i<keys.length;i++) {
    const previous=keys[i-1];
    if (i && ![',',';'].includes(previous) && !['coordination','sequence','clause'].includes(worlds.joiners[previous])) continue;
    for (let end=i+1;end<=Math.min(i+8,keys.length);end++) {
      const markers=bank.get(keys.slice(i,end).join(' '));
      if (markers) head={end,markers};
    }
  }
  if (!head) {
    const markers=bank.get(terms(predicate).join(' ')), locations=literalRanges(scope,predicate);
    if (!markers || locations.length!==1) return false;
    head={end:tokens(scope.slice(0,locations[0][1])).length,markers};
  }
  const {end,markers}=head;
  if (!purposes.some(intent=>markers.some(marker=>matches(intent.cue,0,marker))) ||
      !ts.slice(end).some(token=>word.test(token[0]))) return false;
  // A later purpose remains possible after the predicate's own complement.
  return !keys.some((_,i)=>i>end && markers.some(marker=>matches(keys,i,marker) &&
    ts.slice(i+marker.length).some(token=>word.test(token[0]))));
}

function unresolvedDestinationFrames(facts) {
  const list=(wire,key)=>(wire.attrs[key] ?? []).map(value=>terms(str(value)));
  const repetition=new Set(facts('w.lang.en.ellipsis.repeat').flatMap(wire=>list(wire,'text'))
    .map(words=>words.join(' ')));
  return facts('pro.reader.unresolved_destination').flatMap(wire=>{
    const act=one(wire,'act'), lead=terms(one(wire,'lead') ?? '');
    if (!repetition.has(lead.join(' '))) return [];
    const verbs=facts('k.actions.verb').filter(verb=>one(verb,'act')===act && one(verb,'object')==='thing')
      .flatMap(verb=>list(verb,'text')).filter(keys=>keys.length).sort((a,b)=>b.length-a.length);
    const places=facts('k.actions.role').filter(role=>one(role,'act')===act && one(role,'name')==='place' &&
      one(role,'holds')==='place').flatMap(role=>list(role,'marker')).filter(keys=>keys.length);
    const markers=list(wire,'marker').filter(keys=>places.some(place=>matches(keys,keys.length-place.length,place)));
    const heads=list(wire,'head').filter(keys=>keys.length);
    return verbs.length && markers.length && heads.length ? [{act,lead,verbs,markers,heads}] : [];
  });
}

export function unresolvedDestinationReadings(text,ts,worlds) {
  const frames=worlds.requestIntents.unresolvedDestinations;
  if (!frames.length) return [];
  const chars=Array.from(text), quotes=quotedSpans(text);
  const keys=ts.map(([key,,start,stop])=>quotes.some(quote=>quote.start<stop && start<quote.end) ? '' : key);
  const end=keys.length-Number(['.','?','!'].includes(keys.at(-1)));
  if (end<5 || end>72 || keys.slice(0,end).some(key=>worlds.joiners[key] ||
      worlds.scopeGrammar.choices.has(key) || worlds.negatives.has(key) || worlds.scopeGrammar.conditionals.has(key) ||
      (key && !word.test(key)))) return [];
  const span=(start,stop)=>chars.slice(ts[start][2],ts[stop-1][3]).join('');
  const candidates=[];
  for (const {act,lead,verbs,markers,heads} of frames) {
    const verb=verbs.find(words=>matches(keys,0,words) && matches(keys,words.length,lead));
    if (!verb) continue;
    for (let i=verb.length+lead.length;i<end;i++) {
      for (const head of heads) {
        const markerStart=i+head.length;
        if (!matches(keys,i,head)) continue;
        for (const marker of markers) {
          const destination=markerStart+marker.length;
          if (destination>=end || !matches(keys,markerStart,marker) ||
              (!['definite','demonstrative','possessive'].includes(worlds.determiners[keys[destination]]) &&
               !quotes.some(quote=>quote.start===ts[destination][2])) ||
              destination+1>=end ||
              keys.slice(destination+1,end).some((_,offset)=>
                markers.some(other=>matches(keys,destination+offset+1,other)))) continue;
          const words=span(markerStart,end), value=span(destination,end);
          candidates.push({source:'unresolved-destination',status:'partial',sop:serialize([
            {id:'r',type:requestType,attrs:{act:[act],mood:['do'],predicate:[quote(span(0,verb.length))],words:[quote(text)]}},
            {id:'destination',type:'w.request.intent',attrs:{request:['$r'],role:['destination'],value:[quote(value)],words:[quote(words)]}},
            {id:'operand',type:'w.request.unread',attrs:{request:['$r'],text:[quote(span(verb.length,markerStart))]}},
          ])});
        }
      }
    }
  }
  return candidates;
}

export function compileRequestIntents(facts, argumentSequences) {
  const frames = (type, fields) => facts(type).flatMap(wire =>
    (wire.attrs.text ?? []).map(raw => ({cue: terms(str(raw)), ...Object.fromEntries(
      fields.map(key => [key, one(wire, key)]))})).filter(frame => frame.cue.length));
  const results = frames('pro.reader.result_request', ['question', 'qualifier'])
    .sort((a, b) => Number(Boolean(b.qualifier)) - Number(Boolean(a.qualifier)));
  const continuations = new Map();
  for (const entries of argumentSequences.values()) for (const frame of entries) {
    const [separator, effect] = frame.parts.slice(-2);
    if (!frame.owned || separator?.literal?.[0] !== ',' || !effect?.bank ||
        effect.lexical || effect.key.startsWith('$')) continue;
    for (const [form] of effect.bank) {
      const phrase = [...separator.literal.slice(1), ...form];
      if (phrase.length < 2) continue;
      const surface = phrase.join(' '), roles = continuations.get(surface) ?? new Set();
      roles.add(effect.key);
      continuations.set(surface, roles);
    }
  }
  return {
    results,
    unresolvedDestinations:unresolvedDestinationFrames(facts),
    replacementMarkers:replacementMarkers(facts),
    predicates: new Set(results.map(frame => frame.cue.join(' '))),
    intents: frames('pro.reader.request_intent_frame', ['role', 'form', 'owner', 'want', 'resolution'])
      .sort((a, b) => b.cue.length - a.cue.length),
    continuations,
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
  let end = keys.length - Number(['.', '?', '!'].includes(keys.at(-1)));
  if (end < 4 || end > 72) return [];
  const courtesy = worlds.discourseEdges.after.has(keys[end-1]) &&
    detachedDiscourse(text,{before:new Map(),after:worlds.discourseEdges.after});
  if (courtesy) end = tokens(courtesy.body).length;
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
    let continuation;
    for (let j = tail.at(-1).valueStart + 1; j < end - 1; j++) {
      if (keys[j] !== ',') continue;
      const roles = worlds.requestIntents.continuations.get(keys.slice(j + 1, end).join(' '));
      if (!roles) continue;
      continuation = {boundary: j, roles, words: span(j + 1,end)};
      break;
    }
    const intents = tail.map(({start, valueStart, frame}, j) => {
      const stop = tail[j + 1]?.boundary ?? continuation?.boundary ?? end;
      if (valueStart >= stop) return;
      let quantity, bareQuantity;
      let remaining = valueStart;
      if (frame.role === 'purpose' && frame.form === 'nominal') {
        const comma = keys.indexOf(',', valueStart);
        const operandEnd = comma >= valueStart && comma < stop ? comma : stop;
        if (operandEnd > valueStart) {
          quantity = span(valueStart, operandEnd);
          bareQuantity = resolveWrittenMeasurement(quantity, worlds)?.value !== undefined;
          if (bareQuantity) remaining = operandEnd;
        }
      }
      if (keys.slice(remaining, stop).some(key => !key || ['.', '?', '!', ';'].includes(key) ||
          worlds.scopeGrammar.conditionals.has(key))) return;
      const value = span(valueStart, stop);
      return crossesRequest(value) ? undefined : {...frame, value, quantity, bareQuantity, words: span(start, stop)};
    });
    if (!intents.every(Boolean)) return [];
    const body = span(0,first.boundary);
    const plan = {body,intents,fillers:courtesy?.extras ?? []};
    if (!continuation) return [plan];
    const suffix = chars.slice(ts[continuation.boundary][2],ts[end-1][3]).join('');
    return [{...plan,body:body+suffix,continuation,seam:body.length},
      {...plan,unread:continuation.words}];
  });
}

export function withRequestIntents(text, plan, candidate, worlds) {
  const wires = parse(candidate.sop);
  const requests = wires.filter(wire => wire.type === requestType);
  const owner = requests.findLast(request => {
    const words = one(request, 'words');
    return words ? plan.body.endsWith(words) : requests.length === 1;
  });
  if (!owner || !one(owner, 'predicate') || plan.intents.some(intent => intent.owner === 'answer') &&
      !(one(owner, 'act') === 'ask' && one(owner, 'question'))) return;
  const ref = '$' + owner.id;
  const families = new Set(wires.filter(wire => one(wire, 'request') === ref && wire.type === 'w.request.target')
    .map(wire => one(wire, 'family')));
  if (!families.size && !one(owner, 'asked_words')) return;
  const scope = one(owner, 'words') ?? plan.body;
  const predicate=one(owner,'predicate');
  if (reservesReplacement(scope,predicate,plan.intents,worlds)) return;
  const scopeStart = plan.body.length - scope.length;
  const pendingCommand=wires.some(wire=>{
    if (wire.type!=='w.request.unread' || one(wire,'request')!==ref) return false;
    const written=one(wire,'text');
    if (!written || !scope.endsWith(written)) return false;
    const [joiner,...tail]=terms(written);
    return worlds.joiners[joiner]==='coordination' && tail.slice(0,5).some((_,i)=>
      worlds.lookup(tail.slice(0,i+1).join(' ')).some(([role,act])=>role==='act' && act!=='ask'));
  });
  if (pendingCommand) return;
  if (plan.continuation && (scopeStart >= plan.seam || !wires.some(wire=>
    wire.type === 'w.request.constraint' && one(wire,'request') === ref && one(wire,'phase') === 'result' &&
    plan.continuation.roles.has(one(wire,'attribute')) &&
    literalRanges(plan.continuation.words,one(wire,'words') ?? one(wire,'value')).length))) return;
  const first = text.length - text.trimStart().length;
  owner.attrs.words = [quote(text.slice(first + scopeStart))];
  const ids = new Set(wires.map(wire => wire.id));
  let n = 0;
  let hasUnresolved = false;
  for (const {role, value, words, want, resolution, quantity, bareQuantity} of plan.intents) {
    while (ids.has('intent.' + n)) n++;
    const id = 'intent.' + n++;
    const measured = !bareQuantity && quantity && families.size && [...worlds.ownerPropertyUnits.keys()].some(binding => {
      const [family,key] = JSON.parse(binding);
      return families.has(family) && resolveWrittenMeasurement(quantity, worlds, family, key)?.measurement;
    });
    if (resolution === 'unresolved' || bareQuantity || measured) {
      hasUnresolved = true;
      wires.push({id, type: 'w.request.unread', attrs: {
        request: [ref], text: [quote(words)], note: [quote('unresolved ' + (bareQuantity || measured ? 'quantity' : role))],
      }});
    } else {
      wires.push({id, type: 'w.request.intent', attrs: {
        request: [ref], role: [role], value: [quote(value)], words: [quote(words)], want: [want],
      }});
    }
  }
  if (plan.unread) {
    while (ids.has('intent.' + n)) n++;
    wires.push({id:'intent.'+n++,type:'w.request.unread',attrs:{request:[ref],text:[quote(plan.unread)]}});
    hasUnresolved = true;
  }
  for (const filler of plan.fillers) {
    while (ids.has('intent.' + n)) n++;
    wires.push({id:'intent.'+n++,type:'w.request.filler',attrs:{text:[quote(filler)]}});
  }
  return {sop: serialize(wires), status: hasUnresolved ? 'partial' : candidate.status, source: 'request-intent'};
}
