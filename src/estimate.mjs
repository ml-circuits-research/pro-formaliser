import { parse, validate } from './schema.mjs';
import { loadWorlds } from './worlds.mjs';
import { tokens } from './lexicon.mjs';
import { prologWorker } from './prolog-worker.mjs';
import { evidenceReport, literalRanges } from './evidence.mjs';
import { maskQuoted, quotedSpans } from './literal-roles.mjs';
import { requestScope } from './request-scope.mjs';
import { resolveWrittenMeasurement } from './owner-property.mjs';

const norm = value => (value ?? '').normalize('NFKC').toLowerCase().trim().replace(/\s+/gu,' ');
const decode = v => v.startsWith('"') ? JSON.parse(v) : v;
const values = (w,key) => (w.attrs[key] ?? []).map(decode);
const unique = xs => [...new Set(xs)];
const first=(wire,key)=>values(wire,key)[0];
const form=text=>tokens(text).map(([key])=>key).join(' ');
const reciprocalType='w.relational.reciprocal';
const scaledType='w.relational.scaled';
const relationTypes=new Set([reciprocalType,scaledType]);
const relationFrame=(w,key)=>first(w,key)?.slice(1);

function typedMeasurement(wire,worlds,family,key) {
  const value=first(wire,'value');
  const measure=values(wire,'measure'), unit=values(wire,'unit');
  if (value===undefined || measure.length!==1 || unit.length!==1) return false;
  const written=resolveWrittenMeasurement(value,worlds,family,key)?.measurement;
  const words=values(wire,'measure_words');
  return Boolean(written && Number(written.measure)===Number(measure[0]) && written.unit===unit[0] &&
    (!words.length || words.length===1 && written.words===words[0]));
}

function relationProof(text,wires,worlds) {
  const extensions=wires.filter(w=>relationTypes.has(w.type));
  if (extensions.length!==1) return;
  const [extension]=extensions;
  const owned=key=>wires.find(w=>w.id===relationFrame(extension,key));
  const request=owned('request'), target=owned(extension.type===scaledType ? 'result' : 'members');
  if (request?.type!=='w.request.request' || target?.type!=='w.request.target' ||
      first(target,'request')!==first(extension,'request')) return;
  const scoped=first(request,'words') ?? text;
  const requestIndex=wires.filter(w=>w.type==='w.request.request').indexOf(request);
  const words=first(extension,'words'), report=evidenceReport(text,wires,worlds.evidenceVocabulary);
  const evidence=report.spans.find(span=>span.wire===extension.id && span.slot==='words' && span.ranges.length===1);
  if (!evidence) return;
  const [[start,end]]=evidence.ranges;
  const chars=Array.from(text);
  if (quotedSpans(text).some(q=>chars.slice(0,q.start).join('').length<end &&
      chars.slice(0,q.end).join('').length>start)) return;
  if (requestScope(scoped,maskQuoted(scoped,quotedSpans(scoped)),worlds,[]).restricted) return;
  if (extension.type===reciprocalType) {
    const predicates=worlds.reciprocal?.forms.get(form(words));
    const counts=[...values(target,'count_words'),...values(target,'quantity'),
      ...wires.filter(w=>w.type==='w.request.constraint' && first(w,'request')===first(target,'request') &&
        first(w,'on')==='count').flatMap(w=>values(w,'words'))];
    const head=report.spans.find(span=>span.wire===target.id &&
      ['sort_words','family_words','sort'].includes(span.slot) && span.ranges.length===1);
    const count=head && counts.some(term=>{
      const where=literalRanges(text,term);
      return numberForm(term,worlds)===2 && where.length===1 && where[0][1]<=head.ranges[0][0] &&
        !text.slice(where[0][1],head.ranges[0][0]).trim() && head.ranges[0][1]<=start;
    });
    if (first(target,'count')==='2' && count && predicates?.size===1 &&
        predicates.has(relationFrame(extension,'predicate'))) return {extension,formula:words,requestIndex};
    return;
  }
  if (owned('source')!==target || first(extension,'source_phase')!=='result') return;
  const catalogKey=key=>worlds.requestKeys.find(k=>k.id===relationFrame(extension,key) &&
    k.family===first(target,'family') && k.head.split('+').includes('number'));
  const source=catalogKey('source_key'), result=catalogKey('result_key');
  if (!source || !result || source.name===result.name) return;
  const unit=key=>worlds.ownerPropertyUnits?.get(JSON.stringify([key.family,key.name]));
  const sourceUnits=unit(source), resultUnits=unit(result);
  if (sourceUnits?.size!==1 || resultUnits?.size!==1 || !resultUnits.has([...sourceUnits][0])) return;
  const measurement=wires.find(w=>w.type==='w.request.constraint' && first(w,'request')===first(extension,'request') &&
    first(w,'attribute')===source.name && first(w,'phase')==='result' && first(w,'operator')==='eq' &&
    values(w,'measure').length===1 && values(w,'unit').length===1);
  if (!measurement || !typedMeasurement(measurement,worlds,source.family,source.name) ||
      !report.spans.some(span=>span.wire===measurement.id && ['value','words'].includes(span.slot) &&
        span.text===first(measurement,'value') && span.ranges.length===1 && span.ranges[0][1]<=start)) return;
  const ts=tokens(words);
  const phrase=(a,b)=>ts.slice(a,b).map(([key])=>key).join(' ');
  const mentions=(a,b,key)=>{
    const attributes=new Set();
    for (let start=a;start<b;start++) for (let stop=start+1;stop<=b;stop++) {
      for (const {attribute} of worlds.ownerPropertyLabels?.get(JSON.stringify([phrase(start,stop),key.family])) ?? []) {
        if (attribute===source.name || attribute===result.name) attributes.add(attribute);
      }
    }
    return attributes.size===1 && attributes.has(key.name);
  };
  for (let a=1;a<ts.length-1;a++) for (let b=a+1;b<ts.length;b++) {
    const factors=worlds.ownerPropertyMultipliers?.get(phrase(a,b));
    if (factors?.size===1 && Number([...factors][0])===Number(first(extension,'factor')) &&
        mentions(0,a,result) && mentions(b,ts.length,source)) {
      return {extension,formula:Array.from(words).slice(ts[a][2]).join(''),resultKey:result.name,sourceKey:source.name,family:source.family,requestIndex};
    }
  }
}

function numberForm(text,worlds) {
  const term=form(text);
  return /^\d+$/u.test(term) ? Number(term) : Number(worlds.nominalNumbers.get(term)?.value);
}

function relationCore(wires,proof,worlds) {
  const requests=wires.filter(w=>w.type==='w.request.request');
  const targets=wires.filter(w=>w.type==='w.request.target');
  const relative=proof && '$'+requests[proof.requestIndex]?.id;
  const unread=wires.filter(w=>w.type==='w.request.unread');
  const requestPosition=w=>requests.findIndex(req=>'$'+req.id===first(w,'request'));
  const body=wires.filter(w=>!['w.request.unread','w.request.filler'].includes(w.type) &&
    !relationTypes.has(w.type)).filter(w=>!(proof?.resultKey && w.type==='w.request.constraint' &&
      first(w,'request')===relative && first(w,'attribute')===proof.resultKey &&
      first(w,'phase')==='result' && [first(w,'words'),first(w,'value')].some(value=>norm(value)===norm(proof.formula)) &&
      unread.some(u=>first(u,'request')===relative && norm(first(u,'text')).includes(norm(proof.formula)))));
  return JSON.stringify(body.map(w=>{
    const attrs={...w.attrs};
    for (const key of ['predicate','key_words','sort_words','measure_words']) delete attrs[key];
    if (w.type!=='w.request.constraint' || attrs.value) delete attrs.words;
    if (proof?.sourceKey && w.type==='w.request.constraint' && first(w,'request')===relative &&
        first(w,'attribute')===proof.sourceKey && first(w,'phase')==='result' && first(w,'operator')==='eq' &&
        typedMeasurement(w,worlds,proof.family,proof.sourceKey)) {
      delete attrs.measure;
      delete attrs.unit;
    }
    if (w.type==='w.request.target') {
      const counts=[...values(w,'count'),...values(w,'count_words'),...values(w,'quantity')];
      if (counts.length && counts.every(term=>numberForm(term,worlds)===2)) {
        delete attrs.count_words;
        delete attrs.quantity;
        attrs.count=['2'];
      }
    }
    if (w.type==='w.request.request') attrs.order=[String(requests.indexOf(w))];
    else if (attrs.request) attrs.request=[String(requestPosition(w))];
    if (w.type==='w.request.target') attrs.order=[String(targets.indexOf(w))];
    if (attrs.target) attrs.target=attrs.target.map(ref=>String(targets.findIndex(t=>'$'+t.id===ref)));
    return [w.type,Object.entries(attrs).map(([key,items])=>[key,items.map(decode)]).sort()];
  }).sort());
}

function relationPeers(descriptions,text,worlds) {
  for (const {packet,wires} of descriptions) {
    const proof=relationProof(text,wires,worlds);
    if (!proof) continue;
    const core=relationCore(wires,proof,worlds);
    const peers=[];
    for (const other of descriptions) {
      if (other.packet.textEvidence.lane!==packet.textEvidence.lane ||
          other.wires.some(w=>relationTypes.has(w.type))) continue;
      const req=other.wires.filter(w=>w.type==='w.request.request')[proof.requestIndex];
      if (!req || !other.wires.some(w=>w.type==='w.request.unread' && first(w,'request')==='$'+req.id &&
          literalRanges(first(w,'text') ?? '',proof.formula).length===1)) continue;
      if (relationCore(other.wires,proof,worlds)===core) peers.push(other.packet.index);
    }
    if (peers.length) packet.textEvidence.relationPeers=peers;
  }
}

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
    return {wires,packet:{index,targets:mentions,families,tabSets,
      ...(utterance ? {textEvidence:textEvidence(utterance,wires,worlds)} : {})}};
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
      if (utterance) relationPeers(descriptions,utterance,worlds);
      worker ??= prologWorker(new URL('../prolog/estimate.pl',import.meta.url));
      const result = await worker.request({candidates:descriptions.map(d=>d.packet),context:discussion(context)});
      return {...result,invalidIndices};
    },
    async close() { if (worker) await worker.close(); }
  };
}
