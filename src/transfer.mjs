import { tokenize } from './model.mjs';
import { parse } from './schema.mjs';
import { signatures } from './signatures.mjs';
import { quotedSpans } from './literal-roles.mjs';

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
const primaryLimit = 64;
const reserveLookahead = 440;
const reserveLimit = 32;
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
    const peers = slotFields.filter(peer => {
      const outer=peer.matches[0];
      // A written description can enclose its independently typed noun or
      // name. Its full span is reprojected from the finished alignment.
      if (field.type==='w.request.target' && ['sort','name','ids'].includes(field.key) &&
          peer.index===field.index && peer.key==='description' && peer.matches.length===1 &&
          outer[0]<=span[0] && span[1]<=outer[1] && !sameSpan(outer,span)) return false;
      return peer.matches.some(match => overlaps(span, match));
    });
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

function checkNumericResultKeys(propertyLabels, requestKeys, joiners) {
  if (!propertyLabels?.size || !requestKeys?.length) return wires=>wires;
  const numeric=new Set(requestKeys.filter(key=>key.head.split('+').includes('number'))
    .map(key=>JSON.stringify([key.family,key.name])));
  const cuts=new Set(['sequence','coordination','contrast','clause']);
  return (wires,text)=>{
    const requests=new Map(wires.filter(w=>w.type==='w.request.request').map(w=>['$'+w.id,w]));
    const targets=wires.filter(w=>w.type==='w.request.target');
    const labels=(ts,family)=>{
      const found=new Set();
      for (let start=0;start<ts.length;start++) {
        let surface='';
        for (let end=start;end<Math.min(ts.length,start+8);end++) {
          surface+=(end===start ? '' : ' ')+ts[end].key;
          const keys=propertyLabels.get(JSON.stringify([surface,family])) ?? [];
          for (const {attribute} of keys) {
            if (numeric.has(JSON.stringify([family,attribute]))) found.add(attribute);
          }
        }
      }
      return found;
    };
    const affected=[];
    for (const constraint of wires) {
      if (constraint.type!=='w.request.constraint' || first(constraint,'phase')==='selector' ||
          first(constraint,'on')!=='attribute') continue;
      const ref=first(constraint,'request'), req=requests.get(ref);
      const [target,...others]=targets.filter(w=>first(w,'request')===ref);
      if (!req || !target || others.length) continue;
      const family=first(target,'family'), key=first(constraint,'attribute');
      if (!numeric.has(JSON.stringify([family,key]))) continue;
      const surface=first(constraint,'words') ?? first(constraint,'value');
      if (!surface || !/\p{L}/u.test(surface)) continue;
      const mentions=labels(tokens(surface),family);
      if (!mentions.size || mentions.has(key)) continue;
      const scope=first(req,'words') ?? text, source=tokens(scope), matches=spans(source,surface);
      if (matches.length!==1) continue;
      const [[start,end]]=matches;
      const chars=Array.from(scope);
      const quotes=quotedSpans(scope).map(({start,end})=>[
        chars.slice(0,start).join('').length,chars.slice(0,end).join('').length]);
      const visible=token=>!quotes.some(([a,b])=>a<token.end && token.start<b);
      if (!source.slice(start,end).every(visible)) continue;
      let left=start;
      while (left>0 && !terminal.has(source[left-1].key) &&
        !/^[,，;—–]$/u.test(source[left-1].key) && !cuts.has(joiners[source[left-1].key])) left--;
      // Explicit roles earlier in this local clause can identify a result
      // whose value mentions a different property, as in a relative measure.
      const local=source.slice(left,start);
      const writtenKey=(constraint.attrs.key_words ?? []).map(decode).some(words=>
        labels(tokens(words),family).has(key) && spans(local,words).length===1);
      if (writtenKey || labels(local.filter(visible),family).has(key)) continue;
      affected.push({constraint,ref,surface});
    }
    if (!affected.length) return wires;
    const removed=new Set(affected.map(({constraint})=>constraint.id));
    const kept=wires.filter(w=>!removed.has(w.id));
    if (kept.some(w=>localRefs(w).some(ref=>removed.has(ref)))) return;
    const ids=new Set(wires.map(w=>w.id));
    const partial=new Set();
    for (const {ref,surface} of affected) {
      const evidence=JSON.stringify([ref,surface]);
      if (partial.has(evidence)) continue;
      partial.add(evidence);
      const existing=kept.find(w=>w.type==='w.request.unread' && first(w,'request')===ref && first(w,'text')===surface);
      if (existing) {
        delete existing.attrs.note;
        delete existing.attrs.value;
      } else {
        let id='alignment.property';
        while (ids.has(id)) id+='_';
        ids.add(id);
        kept.push({id,type:'w.request.unread',attrs:{request:[ref],text:[JSON.stringify(surface)]}});
      }
    }
    return kept;
  };
}

function align(example, source, text, { core: input, extras }, resolveValue, envelope, typedSlot, checkProperties) {
  const { wires, fields, starts, fillers } = prepare(example, source, envelope) ?? {};
  if (!wires) return [];
  const memo = new Map();

  // Preserve the original search independently of the short command reading.
  // Only a written, unchanged predicate licenses adjacent catalog arguments.
  const requests=wires.filter(w=>w.type==='w.request.request');
  const predicate=first(requests[0], 'predicate');
  const predicateLength=predicate ? tokens(predicate).length : 0;
  const typedCommand=typedSlot && requests.length===1 && predicateLength && input.length<=12 &&
    !wires.some(w=>w.type==='w.request.unread') &&
    spans(source,predicate).some(([start])=>start===0) && predicateLength<=input.length &&
    source.slice(0,predicateLength).every((token,index)=>token.key===input[index].key);
  let catalogOnly=false;

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
    if (!slot || out.length >= 2 || catalogOnly && !slot.fields.every(field=>typedSlot(field))) return out;
    const end = slot.span[1];
    const oldSurface = rawSpan(example.text, source, i, end);
    const limit = Math.min(input.length, j + Math.max(12, end - i));
    for (let after = j + 1; after <= limit && out.length < 2; after++) {
      // A substituted span must have an unchanged right boundary.
      if (end < source.length && source[end].key !== input[after]?.key &&
          !(catalogOnly && starts.get(end)?.fields.every(field=>typedSlot(field)))) continue;
      if (end === source.length && after !== input.length) continue;
      const surface = rawSpan(text, input, j, after);
      if (literal(surface.toLowerCase()) === literal(oldSurface.toLowerCase())) continue;
      const delimited = quoted(source, slot.span) && quoted(input, [j, after]);
      const values = slot.fields.map(field => valueFor(field, oldSurface, surface, delimited, resolveValue));
      if (values.some((value,index)=>value===undefined || catalogOnly && !typedSlot(slot.fields[index],value))) continue;
      for (const rest of paths(end, after)) {
        if (rest[0]?.slot && !catalogOnly) continue;
        out.push([{ from: i, to: j, after, end, slot, values }, ...rest]);
      }
    }
    return out;
  }

  const results = [];
  const ordinary=paths(0,0);
  const proposals=ordinary.map(path=>({path,typed:false}));
  if (typedCommand) {
    memo.clear();
    catalogOnly=true;
    for (const path of paths(0,0)) proposals.push({path,typed:true});
  }
  for (const {path,typed} of proposals) {
    const anchors = path.filter(step => !step.slot && word.test(source[step.from].key)).length;
    const changed = path.filter(step => step.slot)
      .reduce((total, step) => total + Math.max(step.end - step.from, step.after - step.to), 0);
    if (!typed && changed && (anchors < 2 || anchors * 2 < changed)) continue;
    if (typed && (!changed || !anchors ||
        path.some(step=>step.slot && step.from<predicateLength))) continue;
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
    const checked=checkProperties(copy,text);
    if (!checked) continue;
    if (checked!==copy) {
      unread.push(...checked.filter(w=>w.type==='w.request.unread').map(w=>first(w,'text')));
    }
    const sop=serialize(checked);
    if (typed && results.some(result=>result.sop===sop)) continue;
    results.push({ sop, similarity: anchors / Math.max(1, anchors + changed), unread: unread.join(' ') });
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

function* excerpts(example, observeHeading) {
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
    segments.push({ text, request, start });
  }

  for (const {text, request, start} of segments) {
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
    if (!complete) continue;
    const fragment = wires.filter(wire => selected.has(wire.id));
    observeHeading(text,request,fragment,example.text,start);
    if (!first(request, 'predicate')) continue;
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

function composedHeadingIndex(determiners, fillerPhrases) {
  const shells=new Map(), maxFragments=4;
  const embedded=new Map();
  const attributes=new Set(['request','on','attribute','value','words','key_words','operator','phase','want','open_value']);
  const ornament=new Set(fillerPhrases.flatMap(declaration=>typeof declaration!=='string' &&
    ['filler','politeness','interjection'].includes(declaration.class) && tokens(declaration.text).length===1
    ? [tokens(declaration.text)[0].key] : []));
  const normal=ts=>ts.map(({key})=>Object.hasOwn(determiners,key) ? '<'+determiners[key]+'>' : key).join(' ');
  const unsafe=text=>unsafeOpen.test(text) || /\b(?:if|unless|provided|whether|until|when)\b/iu.test(text);
  const role=attrs=>JSON.stringify(Object.entries(attrs).filter(([key])=>!['value','key_words','open_value'].includes(key)).sort());
  function remember(table,key,entry,source) {
    const record=table.get(key) ?? {...entry,sources:new Set()};
    if (!table.has(key)) table.set(key,record);
    if (record.sources.size<2) record.sources.add(source);
  }
  function piecesIn(ts,constraints) {
    return constraints.map(w=>{
      if (w.attrs.value?.length!==1 || Object.keys(w.attrs).some(key=>!attributes.has(key))) return;
      const literal=first(w,'words') ?? first(w,'value');
      const locations=spans(ts,literal);
      if (locations.length!==1) return;
      const [[start,end]]=locations;
      const key=first(w,'attribute'), slice=ts.slice(start,end);
      if (!key || !slice.some(({key})=>word.test(key)) ||
          w.attrs.key_words?.some(value=>!spans(slice,decode(value)).length)) return;
      return {start,end,w,key};
    });
  }
  function rememberPiece(table,ts,start,stop,w,key,source) {
    const phrase=normal(ts.slice(start,stop));
    const attrs=Object.fromEntries(Object.entries(w.attrs).filter(([k])=>!['request','words'].includes(k)));
    const signature=JSON.stringify([phrase,attrs]);
    remember(table,signature,{phrase,length:stop-start,key,attrs},source);
  }
  function observeEmbedded(text,request,target,constraints,input,start) {
    if (first(request,'act')!=='make' || first(target,'mode')!=='new' ||
        ![undefined,'do'].includes(first(request,'mood')) || unsafe(text)) return;
    const noun=first(target,'sort_words') ?? first(target,'family_words') ?? first(target,'sort');
    if (!noun) return;
    const ts=tokens(text), positions=spans(ts,noun);
    if (positions.length!==1) return;
    const cut=ts.slice(0,positions[0][0]).findLastIndex(({key})=>key==='with' || key===':');
    if (cut<1) return;
    const source=normal(tokens(input.slice(start+ts[cut].start)));
    for (const part of piecesIn(ts.slice(0,cut),constraints)) {
      if (!part || !part.w.attrs.words || ![undefined,'eq'].includes(first(part.w,'operator')) ||
          ![undefined,'result'].includes(first(part.w,'phase')) || ![undefined,'yes'].includes(first(part.w,'want'))) continue;
      rememberPiece(embedded,ts,part.start,part.end,part.w,part.key,source);
    }
  }
  function observe(text,request,wires,constraints,source) {
    if (constraints.length>maxFragments || unsafe(text)) return;
    const bare=wires.filter(w=>!constraints.includes(w));
    if (bare.some(w=>Object.keys(w.attrs).some(key=>
      !(w===request && ['words','predicate'].includes(key)) &&
      (evidence(w.type,key) || literalFields.has(key) || ['sort','count','ordinal','quantifier','quantity'].includes(key))))) return;
    const ts=tokens(text), predicate=first(request,'predicate');
    const fragments=piecesIn(ts,constraints);
    if (fragments.some(part=>!part) || new Set(fragments.map(part=>part.key)).size!==fragments.length) return;
    fragments.sort((a,b)=>a.start-b.start);
    if (fragments.some((part,i)=>i && fragments[i-1].end>part.start)) return;
    const before=ts.slice(0,fragments[0].start);
    const predicateSpan=predicate ? spans(before,predicate) : [];
    if (predicate && predicateSpan.length!==1) return;
    const meaning=JSON.stringify(signatures(bare,true));
    const record=shells.get(meaning) ?? {leads:new Map(),pieces:new Map(),bare};
    if (!shells.has(meaning)) shells.set(meaning,record);
    const trailing=ts.slice(fragments.at(-1).end);
    if (trailing.some(({key})=>word.test(key))) return;
    const lead=normal(before);
    const leadKey=JSON.stringify([lead,predicateSpan[0]]);
    remember(record.leads,leadKey,{lead,length:before.length,predicate:predicateSpan[0]},source);
    for (const [i,{start,end,w,key}] of fragments.entries()) {
      const after=fragments[i+1]?.start ?? end;
      // A short annotated linker can extend an operand's surface, but a
      // later typed operand keeps its own evidence and position.
      const ends=[end];
      const gap=ts.slice(end,after);
      if (gap.length && gap.length<=2 && gap.every(({key})=>word.test(key))) ends.push(after);
      for (const stop of ends) rememberPiece(record.pieces,ts,start,stop,w,key,source);
    }
  }
  function find(text) {
    if (unsafe(text)) return [];
    const ts=tokens(text);
    if (!ts.length || ts.length>36) return [];
    const proposals=new Map();
    for (const {leads,pieces,bare} of shells.values()) {
      const byFirst=new Map();
      const contextualRoles=new Set([...pieces.values()].filter(piece=>piece.sources.size>=2).map(piece=>role(piece.attrs)));
      for (const piece of [...pieces.values(),...[...embedded.values()].filter(piece=>contextualRoles.has(role(piece.attrs)))]) {
        if (piece.sources.size<2) continue;
        const first=piece.phrase.split(' ')[0];
        if (!byFirst.has(first)) byFirst.set(first,[]);
        byFirst.get(first).push(piece);
      }
      const analyses=new Map();
      let steps=0;
      function cover(position,parts,predicate) {
        if (++steps>256 || analyses.size>1) return;
        if (position===ts.length && parts.length>=2) {
          const key=JSON.stringify([predicate,[...parts].sort((a,b)=>a.key.localeCompare(b.key)).map(part=>part.attrs)]);
          analyses.set(key,{parts,predicate});
          return;
        }
        if (parts.length>=maxFragments) return;
        if (parts.length && ts[position]?.key===',') position++;
        const next=ts[position];
        if (!next) return;
        for (const piece of byFirst.get(normal([next])) ?? []) {
          if (parts.some(part=>part.key===piece.key) || normal(ts.slice(position,position+piece.length))!==piece.phrase) continue;
          const words=rawSpan(text,ts,position,position+piece.length);
          cover(position+piece.length,[...parts,{...piece,words}],predicate);
        }
      }
      for (const lead of leads.values()) {
        if (lead.sources.size<2) continue;
        const afterOrnaments=ts.findIndex(({key})=>!ornament.has(key));
        for (const start of new Set([0,Math.max(0,afterOrnaments)])) {
          if (start && !lead.predicate || normal(ts.slice(start,start+lead.length))!==lead.lead) continue;
          const predicate=lead.predicate && rawSpan(text,ts,lead.predicate[0]+start,lead.predicate[1]+start);
          cover(start+lead.length,[],predicate);
        }
      }
      if (steps>256 || analyses.size!==1) continue;
      const [{parts,predicate}]=analyses.values();
      const request=bare.find(w=>w.type===requestsType);
      const ids=new Map(bare.map((w,i)=>[w.id,'setting.'+(i+1)]));
      const revised=bare.map(w=>{
        const attrs=Object.fromEntries(Object.entries(w.attrs).filter(([key])=>w!==request || key!=='predicate')
          .map(([key,values])=>[key,values.map(value=>value.startsWith('$') ? '$'+ids.get(value.slice(1)) : value)]));
        if (w===request) {
          attrs.words=[JSON.stringify(text)];
          if (predicate) attrs.predicate=[JSON.stringify(predicate)];
        }
        return {...w,id:ids.get(w.id),attrs};
      });
      const assembled=[...revised,...parts.map(({attrs,words},i)=>({
        id:'setting.value.'+(i+1),type:'w.request.constraint',
        attrs:{...attrs,request:['$'+ids.get(request.id)],words:[JSON.stringify(words)]},
      }))];
      const sop=serialize(assembled);
      proposals.set(JSON.stringify(signatures(assembled,true)),{sop,source:'scene-heading',support:2,status:'matched'});
    }
    return [...proposals.values()];
  }
  return {observe,observeEmbedded,find};
}

function headingIndex(envelope, determiners, fillerPhrases) {
  const proposals=new Map();
  const bareForms=new Set();
  const composed=composedHeadingIndex(determiners,fillerPhrases);
  const signature=text=>tokens(text).map(token=>token.key).join(' ');
  function formOf(bodyTokens,wires,constraints) {
    const slots=new Map();
    const occupied=new Set();
    for (const wire of constraints) {
      const attribute=first(wire,'attribute');
      if (!attribute) return;
      for (const [i,value] of wire.attrs.value.entries()) {
        const matches=spans(bodyTokens,decode(value));
        if (matches.length!==1) return;
        const [[start,end]]=matches;
        for (let j=start;j<end;j++) {
          if (occupied.has(j)) return;
          occupied.add(j);
        }
        slots.set(start,{end,role:attribute+':'+i});
      }
    }
    const pattern=[];
    for (let i=0;i<bodyTokens.length;i++) {
      const slot=slots.get(i);
      if (slot) {
        pattern.push(['slot',slot.role]);
        i=slot.end-1;
        continue;
      }
      const key=bodyTokens[i].key;
      pattern.push(Object.hasOwn(determiners,key) ? ['determiner',determiners[key]] : key);
    }
    const shape=wires.map(w=>w.type==='w.request.constraint'
      ? {...w,attrs:{...w.attrs,value:w.attrs.value.map((_,i)=>String(i))}}
      : w);
    return JSON.stringify([pattern,signatures(shape,true)]);
  }
  function observe(text,request,wires,input,start) {
    const targets=wires.filter(w=>w.type==='w.request.target');
    const constraints=wires.filter(w=>w.type==='w.request.constraint');
    if (targets.length===1) composed.observeEmbedded(text,request,targets[0],constraints,input,start);
    if (targets.length!==1 || !constraints.length || first(targets[0],'mode')!=='existing' ||
        first(targets[0],'fill')!=='context' || ['last','world'].includes(first(request,'refers')) ||
        ['ask','check','propose'].includes(first(request,'mood'))) return;
    const target=targets[0];
    if (wires.some(w=>w!==request && w!==target && w.type!=='w.request.constraint' &&
        !(w.type==='w.request.lookup' && first(w,'from')==='page' && first(w,'target')==='$'+target.id))) return;
    if (constraints.some(w=>!w.attrs.value?.length || ![undefined,'eq'].includes(first(w,'operator')) ||
        ![undefined,'result'].includes(first(w,'phase')) || ![undefined,'yes'].includes(first(w,'want')))) return;

    composed.observe(text,request,wires,constraints,signature(input.slice(start+text.length).replace(/[.!?]+$/u,'')));
    const ts=tokens(text), predicate=first(request,'predicate');
    const occurrences=predicate ? spans(ts,predicate) : [];
    if (predicate && (occurrences.length!==1 || ts[occurrences[0][0]].start!==envelope(text).core[0]?.start)) return;
    const index=predicate ? occurrences[0][1] : 0;
    if (!ts[index]) return;
    const offset=ts[index].start;
    const body=text.slice(offset);
    const bodyTokens=ts.slice(index);
    const says=value=>spans(bodyTokens,decode(value)).length>0;
    if (wires.some(w=>Object.entries(w.attrs).some(([key,values])=>
      !(w===request && ['words','predicate'].includes(key)) &&
      (evidence(w.type,key) || literalFields.has(key) || numericFields.has(key) ||
        ['sort','amount','quantity','ordinal','quantifier','unit','step'].includes(key)) &&
      values.some(value=>!says(value))))) return;
    const bodyKey=signature(body);
    if (!bodyKey) return;
    const form=formOf(bodyTokens,wires,constraints);
    if (!predicate && form) bareForms.add(form);
    const meaning=JSON.stringify(signatures(wires,true));
    const byMeaning=proposals.get(bodyKey) ?? new Map();
    if (!proposals.has(bodyKey)) proposals.set(bodyKey,byMeaning);
    const record=byMeaning.get(meaning) ?? {sources:new Set(),form};
    if (!byMeaning.has(meaning)) byMeaning.set(meaning,record);
    record.sources.add(signature(input.slice(start+offset).replace(/[.!?]+$/u,'')));
    if (!predicate) record.bare=true;
    if (!record.wires || !predicate) {
      const names=new Map(wires.map((w,i)=>[w.id,'heading.'+(i+1)]));
      record.wires=wires.map(w=>({...w,id:names.get(w.id),attrs:Object.fromEntries(Object.entries(w.attrs)
        .filter(([key])=>w!==request || key!=='predicate')
        .map(([key,values])=>[key,values.map(value=>value.startsWith('$') ? '$'+names.get(value.slice(1)) : value)]))}));
    }
  }
  function find(text) {
    const exact=[...(proposals.get(signature(text))?.values() ?? [])].flatMap(({sources,wires,bare,form})=>{
      if (sources.size<2 || !bare && !bareForms.has(form)) return [];
      const scoped=wires.map(w=>w.type===requestsType ? {...w,attrs:{...w.attrs,words:[JSON.stringify(text)]}} : w);
      return [{sop:serialize(scoped),source:'scene-heading',support:sources.size,status:'matched'}];
    });
    return [...exact,...composed.find(text)];
  }
  return {observe,find};
}

export function createTransfer(examples, { resolveValue, typedSlot, fillerPhrases = [], determiners = {},
  propertyLabels, requestKeys, joiners = {} } = {}) {
  const envelope = makeEnvelope(fillerPhrases);
  const headings=headingIndex(envelope,determiners,fillerPhrases);
  const checkProperties=checkNumericResultKeys(propertyLabels,requestKeys,joiners);
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
    for (const excerpt of excerpts(example,headings.observe)) index(excerpt);
  }
  function transfer(text) {
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
    const ranked = [...weights].sort((a, b) => b[1] - a[1] || distance(a[0]) - distance(b[0]));
    function readings(pool, exclude = new Map()) {
      const candidates = new Map();
      for (const [index,source] of pool) {
        const {example} = indexed[index];
        if (text === example.text && !example.excerpt) continue;
        try {
          for (const { sop, similarity, unread } of align(example, source, text, input, resolveValue, envelope, typedSlot, checkProperties)) {
            if (exclude.has(sop)) continue;
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
      return candidates;
    }
    const primary = readings(ranked.slice(0, primaryLimit).map(([id])=>[id,envelope(indexed[id].example.text).core]));
    const reserve = [];
    const query = input.core;
    if (query.length >= 4 && query.length <= 32 && [query[0],query[1],query.at(-1)].every(token=>word.test(token.key))) {
      for (const [id] of ranked.slice(primaryLimit,reserveLookahead)) {
        if (distance(id)) continue;
        const source = envelope(indexed[id].example.text).core;
        if (source[0].key!==query[0].key || source[1].key!==query[1].key ||
            source.at(-1).key!==query.at(-1).key) continue;
        // Endpoint and length agreement nominate the example. The same slot
        // alignment and evidence checks still decide whether it can transfer.
        reserve.push([id,source]);
        if (reserve.length===reserveLimit) break;
      }
    }
    const ordered = pool => [...pool.values()].sort((a,b)=>b.similarity-a.similarity || b.support-a.support);
    return [...ordered(primary),...ordered(readings(reserve,primary))];
  }
  return Object.assign(transfer,{sceneHeadings:headings.find});
}
