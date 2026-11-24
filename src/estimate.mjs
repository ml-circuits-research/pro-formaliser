import { parse, validate } from './schema.mjs';
import { loadWorlds } from './worlds.mjs';
import { tokens } from './lexicon.mjs';
import { prologWorker } from './prolog-worker.mjs';

const norm = value => (value ?? '').normalize('NFKC').toLowerCase().trim().replace(/\s+/gu,' ');
const decode = v => v.startsWith('"') ? JSON.parse(v) : v;
const values = (w,key) => (w.attrs[key] ?? []).map(decode);
const unique = xs => [...new Set(xs)];

function selectors(wires, target) {
  return wires.filter(w => w.type === 'w.request.constraint' &&
    values(w,'request')[0] === values(target,'request')[0] &&
    values(w,'phase')[0] === 'selector' && values(w,'operator')[0] === 'eq' &&
    values(w,'on')[0] === 'attribute' && values(w,'attribute').length && values(w,'value').length === 1 &&
    (!values(w,'want').length || values(w,'want')[0] === 'yes') && !values(w,'of').length)
    .map(w=>({key:values(w,'attribute')[0],value:norm(values(w,'value')[0])}));
}

function targets(wires) {
  return wires.filter(w => w.type === 'w.request.target').map(w => ({
    family: norm(values(w,'family')[0]), mode: norm(values(w,'mode')[0]), sort: norm(values(w,'sort')[0]),
    names: unique([...values(w,'name'),...values(w,'ids')].map(norm)),
    selectors:selectors(wires,w), labels:values(w,'name').map(name=>tokens(norm(name)).map(t=>t[0]))
  }));
}

export function createEstimator(worlds = loadWorlds()) {
  const attrTabs = new Map();
  for (const {name,tab} of worlds.requestKeys) {
    if (!attrTabs.has(name)) attrTabs.set(name,new Set());
    attrTabs.get(name).add(tab);
  }
  function describe(c,index) {
    if (!c || typeof c.sop !== 'string' || !validate(c.sop,worlds)) return null;
    const wires = parse(c.sop);
    if (!wires.some(w=>w.type === 'w.request.request')) return null;
    const mentions = targets(wires);
    const families = unique(mentions.map(t => t.family));
    const attributes = unique(wires.flatMap(w=>values(w,'attribute')));
    const tabSets = [...families.map(f=>worlds.familyTabs[f]),...attributes.map(a=>[...(attrTabs.get(a) ?? [])])]
      .filter(tabs=>Array.isArray(tabs) && tabs.length);
    return {index,targets:mentions,families,tabSets};
  }
  function cues(text) {
    const ts = tokens(text).map(t=>t[0]), found = new Set();
    for (let i=0;i<ts.length;i++) {
      for (let j=i+1;j<=Math.min(i+8,ts.length);j++) {
        const word = ts.slice(i,j).join(' ');
        for (const [kind,,family] of worlds.lookup(word)) {
          if (kind==='target') found.add(family);
        }
      }
    }
    return [...found];
  }
  function discussion({tab='',entities=[],turns=[]}) {
    if (typeof tab!=='string' || !Array.isArray(entities) || !Array.isArray(turns)) throw Error('Invalid discussion context');
    return {tab:norm(tab),entities:entities.map(e => {
      if (!e || typeof e.family!=='string' || !e.family.trim()) throw Error('Context entity requires a family');
      const properties = Object.entries(e.properties ?? {}).flatMap(([key,value]) =>
        (Array.isArray(value) ? value : [value]).filter(v=>['string','number','boolean'].includes(typeof v))
          .map(v=>({key,value:norm(String(v))})));
      return {properties,id:norm(e.id ?? e.name),name:norm(e.name),family:norm(e.family),sort:norm(e.sort),selected:e.selected===true};
    }),turns:turns.map((h,index)=>{
      if (!h || typeof h !== 'object' || (!h.sop && typeof h.text !== 'string')) throw Error('Turn requires text or an accepted SOP circuit');
      if (h.sop && (typeof h.sop !== 'string' || !validate(h.sop,worlds))) throw Error('Invalid accepted circuit in context turn '+index);
      return {index,age:turns.length-1-index,mentions:h.sop ? targets(parse(h.sop)) : [],cues:!h.sop && h.text ? cues(h.text) : [],
        words:!h.sop && h.text ? tokens(norm(h.text)).map(t=>t[0]) : []};
    })};
  }
  let worker;
  return {
    async estimate(candidates, context = {}) {
      if (!Array.isArray(candidates)) throw Error('Expected an array of candidates');
      const descriptions = [], invalidIndices = [];
      candidates.forEach((c,i)=>{
        const description = describe(c,i);
        if (description) descriptions.push(description);
        else invalidIndices.push(i);
      });
      worker ??= prologWorker(new URL('../prolog/estimate.pl',import.meta.url));
      const result = await worker.request({candidates:descriptions,context:discussion(context)});
      return {...result,invalidIndices};
    },
    async close() { if (worker) await worker.close(); }
  };
}
