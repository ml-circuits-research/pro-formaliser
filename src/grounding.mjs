import { parse } from './schema.mjs';

const normalize = text => text.normalize('NFKC').toLowerCase().trim().replace(/\s+/gu,' ');
const decode = value => value?.startsWith('"') ? JSON.parse(value) : value;

// Resolve a changed categorical payload only through the same target family or
// property in the current world. Similar spelling alone supplies no semantics.
export function valueResolver(worlds, learned = {}, forms = {}) {
  const keys = new Map(), open = new Set();
  for (const row of worlds.requestKeys) {
    const id = JSON.stringify([row.family,row.name]);
    if (row.head === 'span' && !row.values.length) open.add(id);
    if (!keys.has(id)) keys.set(id,new Map());
    for (const value of row.values) keys.get(id).set(normalize(value),value);
  }
  return ({key,attribute,family,surface,oldValue,oldSurface,act,mode,mood}) => {
    if (!surface) return undefined;
    const term = normalize(surface);
    if (key === 'predicate') {
      if (!act || mode) return undefined;
      const records = [...worlds.lookup(term),...(Object.hasOwn(learned,term) ? learned[term] : [])];
      const senses = records.filter(([role,,m]) => role === 'act' && (!mood || !m || m === mood));
      return senses.length && senses.every(entry => entry[1] === act) ? act : undefined;
    }
    if (!family) return undefined;
    if (key === 'value' && oldValue === oldSurface && open.has(JSON.stringify([family,attribute]))) return surface;
    const values = new Set();
    if (key === 'value') {
      const closed = keys.get(JSON.stringify([family,attribute]))?.get(term);
      if (closed !== undefined) values.add(closed);
    }
    for (const [role,,target,payload,sort] of worlds.lookup(term)) {
      if (target !== family) continue;
      if (key === 'sort' && role === 'target' && sort) values.add(sort);
      if (key !== 'value' || role !== 'constraint') continue;
      const [wire] = parse('@c w.request.constraint ' + payload);
      if (decode(wire.attrs.attribute?.[0]) === attribute && wire.attrs.value?.length === 1) {
        values.add(decode(wire.attrs.value[0]));
      }
    }
    if (values.size) return values.size === 1 ? [...values][0] : undefined;
    if (key !== 'value' && key !== 'sort') return undefined;
    const slot = key === 'sort' ? 'sort' : attribute;
    const observed = word => forms[JSON.stringify([family,slot,normalize(word)])];
    if (!oldSurface || observed(oldSurface) !== oldValue) return undefined;
    const result = observed(surface);
    const bank = keys.get(JSON.stringify([family,attribute]));
    if (result && (!bank?.size || bank.has(normalize(result)))) return result;
  };
}

const atom = /^[\p{L}_][\p{L}\p{M}\p{N}_.-]*$/u;
function literal(value) {
  return atom.test(value) ? value : JSON.stringify(value);
}

// Resolve case and aliases against this utterance. An enum stays canonical,
// while words= records the actual evidence that selected it.
export function constraintGrounder() {
  const parsed = new Map();
  return (entry, surface) => {
    const body = entry[3];
    if (!parsed.has(body)) parsed.set(body,parse('@c w.request.constraint ' + body)[0].attrs);
    const attrs = {...parsed.get(body)};
    const lower = surface.toLowerCase();
    for (const key of ['words','key_words','measure_words']) {
      if (!attrs[key]) continue;
      const bounds = attrs[key].map(v => {
        const word = decode(v);
        if (surface.includes(word)) return v;
        const i = lower.indexOf(word.toLowerCase());
        return i < 0 ? null : literal(surface.slice(i,i+word.length));
      });
      if (bounds.includes(null)) return null;
      attrs[key] = bounds;
    }
    if (attrs.value && !attrs.words && attrs.value.some(v => !surface.includes(decode(v)))) attrs.words = [literal(surface)];
    if (attrs.words) {
      attrs.value = (attrs.value ?? []).map(v => {
        const val = decode(v);
        return atom.test(val) && !surface.includes(val) ? val : v;
      });
    }
    const grounded = Object.entries(attrs).flatMap(([k,vs])=>vs.map(v=>k+'='+v)).join(' ');
    return [...entry.slice(0,3),grounded,entry[4]];
  };
}

// An example or template may inherit a label error or stale contextual state.
// Check copied evidence inside the owning request before returning that reading.
export function evidenceInText(text, sop, worlds) {
  const wires = parse(sop);
  const scopes = new Map(wires.filter(w => w.type === 'w.request.request')
    .map(w => ['$'+w.id,w.attrs.words?.length ? decode(w.attrs.words[0]) : text]));
  for (const {type,attrs} of wires) {
    if (['w.request.clock','w.request.previous','w.request.context'].includes(type)) return false;
    const scope = scopes.get(attrs.request?.[0]) ?? text;
    if (type === 'w.request.target' && attrs.sort && worlds?.isReference?.(decode(attrs.sort_words?.[0] ?? attrs.sort[0]))) {
      return false;
    }
    for (const [key,vs] of Object.entries(attrs)) {
      const literal = key === 'predicate' || key === 'words' || key.endsWith('_words') ||
        (['text','name','description','ids'].includes(key) && type !== 'w.request.clock');
      if (literal && vs.some(v => !scope.includes(decode(v)))) return false;
    }
    if (type === 'w.request.constraint' && !attrs.words && attrs.value?.some(v => !scope.includes(decode(v)))) return false;
  }
  return true;
}
