import { tokens } from './lexicon.mjs';
import { parse } from './schema.mjs';

const quotes = new Map([['"', '"'], ["'", "'"], ['“', '”'], ['‘', '’']]);
const requestType = 'w.request.request';
const targetType = 'w.request.target';
const constraintType = 'w.request.constraint';
const decode = value => value?.startsWith('"') ? JSON.parse(value) : value;
const one = (wire, key) => decode(wire.attrs[key]?.[0]);
const word = /[\p{L}\p{N}]/u;
const keyOf = text => tokens(text).map(([key]) => key).join(' ');

function visibleTokens(chars, ts) {
  let quote = '';
  const visible = ts.map(([word, raw, start, end]) => {
    if ((raw === "'" || raw === '’') &&
        /[\p{L}\p{N}]/u.test(chars[start-1] ?? '') && /[\p{L}\p{N}]/u.test(chars[end] ?? '')) return '';
    if (quote) {
      if (raw === quote) {
        let slash = start;
        while (chars[slash-1] === '\\') slash--;
        if ((start-slash) % 2 === 0) quote = '';
      }
      return '';
    }
    if (quotes.has(raw)) { quote = quotes.get(raw); return ''; }
    return word;
  });
  // A literal list can contain words that are also imperative verbs. Only
  // matched brackets protect a span, so an unfinished list cannot hide the tail.
  const starts = [];
  for (let i=0;i<visible.length;i++) {
    if (visible[i]==='[') starts.push(i);
    if (visible[i]===']' && starts.length) {
      const start=starts.pop();
      visible.fill('',start,i+1);
    }
  }
  return visible;
}

export function coordinationActs(worlds, learned = {}) {
  const {grammar = new Set(), filler = new Set()} = worlds.evidenceVocabulary ?? {};
  const determiners = worlds.determiners ?? {};
  const rows = surface => [...worlds.lookup(surface), ...(Object.hasOwn(learned,surface) ? learned[surface] : [])];
  const isArgumentLead = surface => surface && (Object.hasOwn(determiners,surface) || worlds.isReference?.(surface));
  return (surface, { next, clause = surface } = {}) => {
    const head = surface.split(' ')[0];
    if (grammar.has(head) || filler.has(head) || Object.hasOwn(determiners,head)) return false;
    const lexical = worlds.lookup(surface);
    const licensed = lexical.some(([role,,mood])=>role==='act' && (!mood || mood==='do'));
    const entries = [...lexical,...(Object.hasOwn(learned,surface) ? learned[surface] : [])];
    const acts = entries.filter(([role,,mood])=>role==='act' && (!mood || mood==='do' || mood==='propose'));
    if (!acts.length) return false;
    const verbs = acts.reduce((sum,row)=>sum+row.at(-1),0);
    const nominals = entries.filter(([role])=>role==='target' ||
      role==='constraint' && (!licensed || !next));
    const nominal = nominals.length && (!verbs || nominals.some(row=>row.at(-1)===0) ||
      nominals.reduce((sum,row)=>sum+row.at(-1),0)>=verbs);
    const boundedArgument = isArgumentLead(next);
    if (nominal && !boundedArgument) return false;
    // A verb can also be an adjective in an independently grounded phrase.
    // An explicit argument can distinguish that command from the modifier.
    if (!boundedArgument && clause!==surface && rows(clause).some(([role])=>role==='constraint' || role==='target')) return false;
    return Boolean(next) || licensed;
  };
}

// Weak connectors may join nouns, modifiers or clauses. Only independently
// supported, clause-leading predicates or preservation frames justify a cut.
export function clausePrefixes(prefixes) {
  const byHead = new Map();
  for (const phrase of prefixes) {
    const keys = keyOf(phrase).split(' ');
    if (!keys.some(key=>word.test(key))) continue;
    if (!byHead.has(keys[0])) byHead.set(keys[0],[]);
    byHead.get(keys[0]).push(keys);
  }
  return byHead;
}

export function sequenceParts(text, ts, joiners, { isAct, isPreservation, prefixes, requireLeftAct = true } = {}) {
  const chars = Array.from(text);
  const words = visibleTokens(chars, ts);
  const max = Math.max(1, ...Object.keys(joiners).map(phrase => phrase.split(' ').length));
  const parts = [];
  let start = 0, pending = [];
  const offset = index => ts[index]?.[2] ?? chars.length;
  const phrase = (from, to) => chars.slice(offset(from),offset(to)).join('').trim();
  const connector = key => Object.hasOwn(joiners,key);

  function hasPreservationLead(from, to) {
    if (!isPreservation || from >= to) return false;
    for (let stop=from+1; stop<to; stop++) {
      if (connector(words[stop]) && isPreservation(phrase(from,stop))) return true;
    }
    return isPreservation(phrase(from,to));
  }

  function hasActLead(from, to) {
    if (!isAct) return false;
    const starts = new Set([from]);
    for (const index of starts) {
      for (const lead of prefixes?.get(words[index]) ?? []) {
        if (index+lead.length>=to || !lead.every((key,i)=>words[index+i]===key)) continue;
        let next = index+lead.length;
        while (words[next]===',' && next<to) next++;
        if (next<to) starts.add(next);
      }
      const head = [], clause = words.slice(index,to).filter(Boolean).join(' ');
      for (let i=index; i<to && i<index+8; i++) {
        const key = words[i];
        if (!key || !word.test(key) || connector(key)) break;
        head.push(key);
        const follow = i+1<to ? ts[i+1][0] : undefined;
        const next = follow && (word.test(follow) || quotes.has(follow)) ? follow : undefined;
        if (isAct(head.join(' '),{next,clause})) return true;
      }
    }
    return false;
  }

  function hasLead(from, to) {
    return hasActLead(from,to) || hasPreservationLead(from,to);
  }

  for (let i=0; i<ts.length;) {
    let key = '', kind, end = i;
    for (let j=i; j<ts.length && j<i+max && words[j]; j++) {
      key += (j===i ? '' : ' ') + words[j];
      if (!Object.hasOwn(joiners,key)) continue;
      kind = joiners[key];
      end = j+1;
    }
    if (!kind) {
      pending = [];
      i++;
      continue;
    }
    if (!pending.length) pending.push(i);
    pending[1] = end;
    const [first] = pending;
    const adjacent = end < ts.length && connector(words[end]);
    const strong = ['sequence','clause'].includes(kind);
    if (!adjacent && first>start && end<ts.length) {
      let next = end+1;
      while (next<ts.length && !connector(words[next])) next++;
      const left = phrase(start,first);
      const preservation = kind==='contrast' && hasPreservationLead(end,ts.length);
      const weak = ['coordination','addition','list-or-clause','contrast'].includes(kind) &&
        (hasActLead(end,next) || hasPreservationLead(end,ts.length));
      if (word.test(left) && (strong || (weak || preservation) && (!requireLeftAct || hasLead(start,first)))) {
        parts.push(left);
        if (parts.length >= 8) return [];
        start = end;
        pending = [];
      }
    }
    i = end;
  }
  const tail = phrase(start,ts.length);
  return parts.length && tail ? [...parts,tail] : [];
}

const serialize = wires => wires.map(wire => ['@'+wire.id,wire.type,
  ...Object.entries(wire.attrs).flatMap(([key,vs]) => vs.map(v => key+'='+v)),
].join(' ')).join('\n');

// An explicit creation head can license separate, newly introduced list items.
// Requiring each item to begin with its own determiner or number keeps bare
// labels, coordinated attributes, and shared quantities in their original scope.
export function enumeratedParts(text, ts, worlds, { prefixes, learned = {} } = {}) {
  const chars = Array.from(text), visible = visibleTokens(chars,ts);
  const separators = new Set(['coordination','list-or-clause']);
  const starts = new Set([0]);
  const firstComma = visible.indexOf(',');
  const vocabulary = worlds.evidenceVocabulary;
  if (firstComma>0 && firstComma<=4 && visible.slice(0,firstComma).every(key=>
      key && !worlds.negatives?.has(key) && (vocabulary?.grammar.has(key) || vocabulary?.filler.has(key)))) {
    starts.add(firstComma+1);
  }
  const range = (from,to) => chars.slice(ts[from]?.[2] ?? chars.length,ts[to]?.[2] ?? chars.length).join('').trim();
  const nominalStart = position => ['indefinite','quantified'].includes(worlds.determiners[visible[position]]) ||
    /^\d+$/u.test(visible[position] ?? '');
  const targets = (from,to,act) => {
    const matches = [];
    for (let i=from+1;i<to;i++) {
      let phrase = '';
      for (let j=i;j<to && j<i+8 && visible[j] && word.test(visible[j]);j++) {
        phrase += (j===i?'':' ') + visible[j];
        const declared = worlds.lookup(phrase);
        const learnedHits = Object.hasOwn(learned,phrase) ? learned[phrase] : [];
        const modifier = declared.some(([role])=>role==='constraint');
        for (const [role,licence,family,mode,sort] of [...declared,...learnedHits]) {
          if (role==='target' && licence===act && mode==='new' &&
              (!modifier || !sort || keyOf(sort)===phrase))
            matches.push({family,sort,index:i});
        }
      }
    }
    if (!matches.length) return [];
    const earliest = matches[0].index;
    return matches.filter(match=>match.index===earliest);
  };
  for (const from of starts) {
    for (const lead of prefixes?.get(visible[from]) ?? []) {
      if (!lead.every((key,i)=>visible[from+i]===key)) continue;
      let next = from+lead.length;
      while (visible[next]===',') next++;
      if (next<ts.length) starts.add(next);
    }
    const normalized = [];
    for (let end=from+1;end<ts.length && end<=from+8;end++) {
      const token = visible[end-1];
      if (!word.test(token) || worlds.joiners[token]) break;
      normalized.push(token);
      if (!nominalStart(end)) continue;
      const actions = worlds.lookup(normalized.join(' ')).filter(([role,,mood])=>role==='act' && (!mood || mood==='do'));
      for (const [,act] of actions) {
        const bounds = [];
        let start=end, punctuation=false, pendingComplement=false, ambiguousCut=false;
        for (let i=end+1;i<ts.length;i++) {
          const kind=worlds.joiners[visible[i]];
          if (!separators.has(kind)) continue;
          let next=i+1;
          while (separators.has(worlds.joiners[visible[next]])) next++;
          if (!nominalStart(next)) {
            if (kind==='coordination' && targets(start,i,act).length) pendingComplement=true;
            continue;
          }
          if (pendingComplement) { ambiguousCut=true; break; }
          punctuation ||= visible.slice(i,next).some(key=>worlds.joiners[key]==='list-or-clause');
          bounds.push([start,i]);
          start=next;
          i=next;
        }
        if (ambiguousCut || !bounds.length || bounds.length>=8) continue;
        bounds.push([start,ts.length]);
        const items = bounds.map(([a,b])=>targets(a,b,act));
        if (items.some(item=>!item.length)) continue;
        // In an unpunctuated two-item phrase, a second indefinite phrase
        // can belong to a spatial complement of the first object.
        if (!punctuation && bounds.length===2) {
          const start = items[0][0].index+1;
          const marker = key => key && worlds.lookup(key).some(([role,licence])=>role==='marker' &&
            (licence==='*' || licence===act));
          const complement = visible.slice(start,bounds[0][1]).some((key,index)=>
            nominalStart(start+index) || marker(key));
          const tail = visible.slice(items[1][0].index+1,bounds[1][1]);
          const anchor = tail.findIndex(marker);
          // A second item's own relation to the first target licenses a
          // separate object without lending the first relation to the second.
          if (complement && (anchor<0 || !tail.slice(anchor+1).includes(visible[items[0][0].index]))) continue;
        }
        const predicate=range(from,end);
        return {
          act,predicate,items,
          parts:bounds.map(([a,b],i)=>range(i?a:0,b)),
          inputs:bounds.map(([a,b])=>predicate+' '+range(a,b)),
        };
      }
    }
  }
  return null;
}

export function composableWires(result, item) {
  let wires;
  try { wires = parse(result.sop); } catch { return null; }
  const requests = wires.filter(w => w.type===requestType);
  if (item) {
    if (requests.length!==1 || one(requests[0],'act')!==item.act ||
        one(requests[0],'predicate')!==item.predicate) return null;
    const targets = wires.filter(w=>w.type===targetType && one(w,'request')==='$'+requests[0].id);
    if (targets.length!==1 || one(targets[0],'mode')!=='new' ||
        !item.targets.some(({family,sort})=>one(targets[0],'family')===family && one(targets[0],'sort')===sort)) return null;
  } else if (requests.length===1) {
    if (!requests[0].attrs.predicate) return null;
  } else if (result.source!=='enumeration' || requests.length<2 ||
             requests.some(w=>!w.attrs.words)) return null;
  return wires;
}

export function composeParts(parts, results, enumeration) {
  const combined = [];
  if (parts.length !== results.length || parts.length < 2) return null;
  for (const [i, result] of results.entries()) {
    const item = enumeration && {act:enumeration.act,predicate:enumeration.predicate,targets:enumeration.items[i]};
    const wires = composableWires(result,item);
    if (!wires) return null;
    const ids = new Map(wires.map(w => [w.id,'s' + (i+1) + '.' + w.id]));
    for (const wire of wires) {
      if (Object.values(wire.attrs).some(values =>
        values.some(value => value.startsWith('$') && !ids.has(value.slice(1))))) return null;
      const attrs = Object.fromEntries(Object.entries(wire.attrs).map(([key,values]) => [key,values.map(value =>
        value.startsWith('$') ? '$'+ids.get(value.slice(1)) : value)]));
      if (wire.type===requestType) {
        if (enumeration || !attrs.words) attrs.words = [JSON.stringify(parts[i])];
        if (enumeration && i>0) delete attrs.predicate;
      }
      combined.push({...wire,id:ids.get(wire.id),attrs});
    }
  }
  return serialize(combined);
}

const surfaceFields = ['description', 'name', 'sort_words', 'family_words', 'sort'];
const literalList = values => values.map(value => JSON.stringify(value));
const boundary = /^[,;.!\u2013\u2014]$/u;
function locate(ts, keys) {
  const positions = [];
  for (let i=0; i+keys.length<=ts.length; i++) {
    if (keys.every((key,j)=>ts[i+j][0]===key)) positions.push(i);
  }
  return positions;
}

function preservationPatterns(examples, families, determiners) {
  const propertyNames = [...new Set([...families.values()].flatMap(keys => [...keys.keys()]))];
  const byHead = new Map(), seen = new Map();
  for (const {text,sop,count=1} of examples) {
    if (!propertyNames.some(name => sop.includes(name))) continue;
    let wires;
    try { wires = parse(sop); } catch { continue; }
    for (const constraint of wires) {
      if (constraint.type !== constraintType || one(constraint,'phase') !== 'result' ||
          one(constraint,'operator') !== 'eq' || ![undefined,'yes'].includes(one(constraint,'want'))) continue;
      const attribute = one(constraint,'attribute'), value = one(constraint,'value');
      const ref = constraint.attrs.request?.[0];
      const req = wires.find(wire => '$'+wire.id === ref && wire.type === requestType);
      if (!req || one(req,'mood') !== 'do') continue;
      const act = one(req,'act'), predicate = one(req,'predicate');
      const clause = one(req,'words') ?? text;
      if (!['change','place'].includes(act) || !predicate || !text.includes(clause)) continue;
      const targets = wires.filter(wire => wire.type === targetType && wire.attrs.request?.[0] === ref);
      if (targets.length !== 1 || one(targets[0],'mode') !== 'existing') continue;
      const family = one(targets[0],'family');
      const property = families.get(family)?.get(attribute);
      if (!property?.values.has(value)) continue;
      const binding = property.binding;
      const ts = tokens(clause);
      while (ts.length && boundary.test(ts.at(-1)[0])) ts.pop();
      const predicateKeys = keyOf(predicate).split(' ');
      const predicates = locate(ts,predicateKeys);
      const descriptions = surfaceFields.map(key => one(targets[0],key)).filter(Boolean)
        .map(text => keyOf(text).split(' ')).sort((a,b) => b.length-a.length);
      if (predicates.length !== 1 || !descriptions.length) continue;
      const desc = descriptions.find(keys=>locate(ts,keys).length===1);
      if (!desc) continue;
      let [start] = locate(ts,desc);
      const end = start+desc.length;
      // Include a written determiner when the separate noun annotation omits it.
      if (start && Object.hasOwn(determiners,ts[start-1][0])) start--;
      const pred = predicates[0], predEnd = pred+predicateKeys.length;
      if (start < predEnd && pred < end) continue;
      const keys = ts.map(([key])=>key);
      const prefix = keys.slice(0,start), suffix = keys.slice(end);
      const evidence = one(constraint,'words');
      if (!suffix.length || prefix.length+suffix.length <= predicateKeys.length ||
          prefix.length+suffix.length > 16 || !evidence || !clause.includes(evidence)) continue;
      const predicateSide = pred < start ? 'prefix' : 'suffix';
      const predicateOffset = predicateSide === 'prefix' ? pred : pred-end;
      const pattern = { prefix,suffix,predicateSide,predicateOffset,predicateLength:predicateKeys.length,act,value,binding };
      const signature = JSON.stringify(pattern);
      if (seen.has(signature)) {
        seen.get(signature).count += count;
        continue;
      }
      pattern.count = count;
      seen.set(signature,pattern);
      const head = prefix[0] ?? '';
      if (!byHead.has(head)) byHead.set(head,[]);
      byHead.get(head).push(pattern);
    }
  }
  return byHead;
}

function encodeTarget(family, text, determiner) {
  const attrs = { request:['$preserve'], family:literalList([family]), mode:['existing'],
    fill:['description'], description:literalList([text]) };
  if (determiner) attrs.determiner = [determiner];
  return attrs;
}

// The property bank licenses value/family pairs. Text patterns come solely
// from grounded preservation annotations, with just the scoped target varying.
export function createPreservation(examples, worlds, learned = {}) {
  const families = new Map();
  const declared = new Map((worlds.preservationBindings ?? []).map(({family,attribute,concept}) =>
    [JSON.stringify([family,attribute]), concept ? {concept} : {family,attribute}]));
  for (const key of worlds.requestKeys) {
    if (key.head !== 'class' || !key.values.length) continue;
    const binding = declared.get(JSON.stringify([key.family,key.name]));
    if (!binding) continue;
    const group = families.get(key.family) ?? new Map();
    const property = group.get(key.name) ?? {binding,values:new Set()};
    for (const value of key.values) property.values.add(value);
    group.set(key.name,property);
    families.set(key.family,group);
  }
  const patterns = preservationPatterns(examples,families,worlds.determiners ?? {});
  const lookup = term => [...worlds.lookup(term), ...(Object.hasOwn(learned,term) ? learned[term] : [])];
  const isAct = coordinationActs(worlds,learned);
  const aliasPatterns = new Map();
  if (worlds.stativeVerbAliases) {
    for (const pattern of [...patterns.values()].flat()) {
      if (pattern.predicateLength !== 1) continue;
      const suffixIndex = pattern.predicateSide === 'suffix' && pattern.predicateOffset === pattern.suffix.length-1 ? 1 : 0;
      const anchor = pattern.suffix.at(-1-suffixIndex);
      if (!anchor) continue;
      const key = suffixIndex + ':' + anchor;
      if (!aliasPatterns.has(key)) aliasPatterns.set(key,[]);
      aliasPatterns.get(key).push(pattern);
    }
  }

  function permitsAlias(form, predicate) {
    if (!word.test(form)) return false;
    const replacement = worlds.stativeVerbAliases(form);
    if (replacement.synonyms.has(predicate) || replacement.parents.has(predicate)) return true;
    return worlds.stativeVerbAliases(predicate).synonyms.has(form);
  }

  function match(text) {
    const ts = tokens(text), chars = Array.from(text);
    if (!ts.length || ts.at(-1)[0] === '?') return [];
    while (ts.length && boundary.test(ts.at(-1)[0])) ts.pop();
    if (!ts.length) return [];
    const surface = (from,to) => chars.slice(ts[from][2],ts[to-1][3]).join('');
    const candidates = [];
    const exact = [...(patterns.get(ts[0][0]) ?? []), ...(patterns.get('') ?? [])];
    const aliases = new Set([...(aliasPatterns.get('0:'+ts.at(-1)?.[0]) ?? []),
      ...(aliasPatterns.get('1:'+ts.at(-2)?.[0]) ?? [])]);
    for (const p of new Set([...exact,...aliases])) {
      const start = p.prefix.length, end = ts.length-p.suffix.length;
      if (start >= end || end-start>16) continue;
      const pred = (p.predicateSide === 'prefix' ? 0 : end)+p.predicateOffset;
      const agrees = (key,index) => ts[index][0] === key ||
        p.predicateLength === 1 && index === pred && aliases.has(p);
      if (p.prefix.some((key,i)=>!agrees(key,i)) || p.suffix.some((key,i)=>!agrees(key,end+i))) continue;
      const oldForm = p[p.predicateSide][p.predicateOffset];
      const alias = p.predicateLength === 1 && ts[pred][0] !== oldForm;
      if (alias && !permitsAlias(ts[pred][0],oldForm)) continue;
      const target = surface(start,end);
      if (!word.test(target) || /[;!?]/u.test(target) ||
          sequenceParts(target,tokens(target),worlds.joiners ?? {},{isAct,requireLeftAct:false}).length) continue;
      candidates.push({ ...p,alias,target,ts:ts.slice(start,end),predicate:surface(pred,pred+p.predicateLength) });
    }
    return candidates.sort((a,b) => b.prefix.length+b.suffix.length-a.prefix.length-a.suffix.length ||
      Number(a.alias)-Number(b.alias) || b.count-a.count);
  }

  return {
    recognises(text) { return match(text).length > 0; },
    readings(text, existing = []) {
      const out = [], seen = new Set();
      for (const { act,value,target,ts,predicate,binding } of match(text)) {
        const targetCandidates = new Map();
        for (const reading of existing) {
          let wires;
          try { wires = parse(reading.sop); } catch { continue; }
          if (wires.filter(wire=>wire.type===requestType).length !== 1) continue;
          for (const t of wires.filter(wire=>wire.type===targetType && one(wire,'mode')==='existing')) {
            const family = one(t,'family');
            if (!families.has(family) || !surfaceFields.some(key=> {
              const evidence = one(t,key);
              return evidence && locate(ts,keyOf(evidence).split(' ')).length>0;
            })) continue;
            const name = one(t,'name');
            const attrs = encodeTarget(family,target,one(t,'determiner'));
            if (target === name) { attrs.name = literalList([name]); attrs.fill = ['written']; delete attrs.description; }
            targetCandidates.set(family,attrs);
          }
        }
        for (let i=0; i<ts.length; i++) {
          let term = '';
          for (let j=i; j<ts.length && j<i+8; j++) {
            term += (j===i?'':' ')+ts[j][0];
            for (const [role,,family,,sort] of lookup(term)) {
              if (role !== 'target' || targetCandidates.has(family) || !families.has(family)) continue;
              const attrs = encodeTarget(family,target,worlds.determiners?.[ts[0][0]]);
              if (sort && keyOf(sort) === term) attrs.sort = literalList([sort]);
              targetCandidates.set(family,attrs);
            }
          }
        }
        for (const [family, attrs] of targetCandidates) {
          const keys = [...families.get(family)].filter(([attribute,property]) => property.values.has(value) &&
            (binding.concept ? binding.concept === property.binding.concept :
              binding.family === family && binding.attribute === attribute));
          if (keys.length !== 1) continue;
          const [[key]] = keys;
          const signature = JSON.stringify([act,family,key,value,target]);
          if (seen.has(signature)) continue;
          seen.add(signature);
          const sop = serialize([
            {id:'preserve',type:requestType,attrs:{act:[act],mood:['do'],predicate:literalList([predicate])}},
            {id:'preserve.t',type:targetType,attrs},
            {id:'preserve.c',type:constraintType,attrs:{request:['$preserve'],on:['attribute'],
              attribute:[key],value:[/^[\p{L}\p{N}_][\p{L}\p{N}_.-]*$/u.test(value) ? value : JSON.stringify(value)],operator:['eq'],phase:['result'],words:literalList([text])}},
          ]);
          out.push({sop,source:'preservation',status:'matched'});
        }
      }
      return out;
    },
  };
}
