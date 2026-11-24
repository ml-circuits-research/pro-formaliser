import { parse, validate } from './schema.mjs';
import { loadWorlds } from './worlds.mjs';
import { tokens } from './lexicon.mjs';
import { prologWorker } from './prolog-worker.mjs';
import { evidenceReport } from './evidence.mjs';
import { maskQuoted, quotedSpans } from './literal-roles.mjs';

const norm = value => (value ?? '').normalize('NFKC').toLowerCase().trim().replace(/\s+/gu,' ');
const decode = v => v.startsWith('"') ? JSON.parse(v) : v;
const values = (w,key) => (w.attrs[key] ?? []).map(decode);
const unique = xs => [...new Set(xs)];
const first=(wire,key)=>values(wire,key)[0];
const form=text=>tokens(text).map(([key])=>key).join(' ');

function textEvidence(text,wires,worlds) {
  const requestType='w.request.request', targetType='w.request.target', constraintType='w.request.constraint';
  const requests=wires.filter(w=>w.type===requestType);
  const report=evidenceReport(text,wires,worlds.evidenceVocabulary);
  const word=/[\p{L}\p{N}]/u;
  const content=text=>tokens(text).some(([term])=>word.test(term) &&
    !worlds.evidenceVocabulary.grammar.has(term) && !worlds.evidenceVocabulary.filler.has(term));
  const proof=(wire,slot)=>report.spans.filter(s=>s.wire===wire.id && s.slot===slot &&
    s.ranges.length===1 && content(s.text));
  const keys=(family,surface)=>worlds.ownerPropertyLabels?.get(JSON.stringify([form(surface),family])) ?? [];
  const explicitKey=(wire,slot,family,key)=>proof(wire,slot)
    .filter(span=>keys(family,span.text).some(record=>record.attribute===key));
  const negative=surface=>{
    const terms=tokens(maskQuoted(surface,quotedSpans(surface))).map(([term])=>term);
    return terms.some((_,index)=>terms.slice(index,index+4).some((_,length)=>{
      const phrase=terms.slice(index,index+length+1).join(' ');
      return worlds.negatives.has(phrase) || worlds.scopeGrammar.predicateNegators.has(phrase);
    })) || [...worlds.scopeGrammar.endings].some(ending=>
      terms.join('').replaceAll('’',"'").includes(ending));
  };
  const claimed=new Set();
  const support=span=>{
    if (!span) return false;
    const signature=span.ranges[0].join(':');
    if (claimed.has(signature)) return false;
    claimed.add(signature);
    return true;
  };
  const coverage=[],lane=[];
  let asked=0, keyedEffects=0, groundedEffects=0, unsupportedEffects=0;
  for (const req of requests) {
    const own=w=>first(w,'request')==='$'+req.id;
    const owners=wires.filter(w=>w.type===targetType && own(w));
    const family=owners.length===1 ? first(owners[0],'family') : '';
    const act=first(req,'act'), mood=first(req,'mood') ?? (act==='ask' ? 'ask' : 'do');
    lane.push([act,mood,first(req,'question') ?? '',owners.map(owner=>[
      first(owner,'family'),first(owner,'mode'),norm(first(owner,'sort')),
      unique([...values(owner,'name'),...values(owner,'ids')].map(norm)).sort(),
      selectors(wires,owner).map(({key,value})=>[key,value]).sort(),
    ]),wires.filter(w=>w.type===constraintType && own(w) &&
      (first(w,'on')==='place' || first(w,'operator')==='relation'))
      .map(w=>[first(w,'attribute'),first(w,'phase'),first(w,'operator'),values(w,'value')]).sort()]);
    let total=0;
    const askedKey=first(req,'asked');
    if (askedKey && support(explicitKey(req,'asked_words',family,askedKey)[0])) {total++;asked++;}
    let effects=0;
    for (const wire of wires) {
      if (wire.type!==constraintType || !own(wire) || first(wire,'phase')==='selector') continue;
      effects++;
      const key=first(wire,'attribute'), value=first(wire,'value');
      const labels=explicitKey(wire,'key_words',family,key);
      const surfaces=[...proof(wire,'words'),...proof(wire,'value')];
      const grounded=surfaces.find(span=>norm(span.text)===norm(value) ||
        (worlds.ownerPropertyValues?.get(JSON.stringify([family,form(span.text)])) ?? []).some(([body])=>{
          const [lexical]=parse('@effect w.request.constraint '+body);
          return first(lexical,'attribute')===key && first(lexical,'value')===value;
        }));
      const hasPolarity=!['no','not_all'].includes(first(wire,'want')) ||
        negative(first(req,'words') ?? (requests.length===1 ? text : ''));
      const evidence=hasPolarity ? grounded ?? (value===undefined && labels.length ? surfaces[0] : undefined) : undefined;
      if (!support(evidence)) {unsupportedEffects++;total--;continue;}
      groundedEffects++;
      const label=labels.find(span=>span.ranges[0][1]<=evidence.ranges[0][0] ||
        evidence.ranges[0][1]<=span.ranges[0][0]);
      if (support(label)) {total++;keyedEffects++;}
    }
    coverage.push(total/Math.max(1,effects+Number(act==='ask')));
  }
  const contentCount=report.tokens.filter(token=>content(token.text)).length;
  const unread=report.tokens.filter(token=>token.status==='unread' && content(token.text)).length;
  const quality=coverage.reduce((sum,n)=>sum+n,0)/requests.length - unread/Math.max(1,contentCount);
  return {lane:JSON.stringify(lane),quality,asked,keyedEffects,groundedEffects,unsupportedEffects,unread};
}

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
  function describe(c,index,utterance) {
    if (!c || typeof c.sop !== 'string' || !validate(c.sop,worlds)) return null;
    const wires = parse(c.sop);
    if (!wires.some(w=>w.type === 'w.request.request')) return null;
    const mentions = targets(wires);
    const families = unique(mentions.map(t => t.family));
    const attributes = unique(wires.flatMap(w=>values(w,'attribute')));
    const tabSets = [...families.map(f=>worlds.familyTabs[f]),...attributes.map(a=>[...(attrTabs.get(a) ?? [])])]
      .filter(tabs=>Array.isArray(tabs) && tabs.length);
    return {index,targets:mentions,families,tabSets,
      ...(utterance ? {textEvidence:textEvidence(utterance,wires,worlds)} : {})};
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
    async estimate(candidates, context = {}, {utterance} = {}) {
      if (!Array.isArray(candidates)) throw Error('Expected an array of candidates');
      const descriptions = [], invalidIndices = [];
      candidates.forEach((c,i)=>{
        const description = describe(c,i,utterance);
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
