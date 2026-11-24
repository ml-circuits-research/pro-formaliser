import { nominalPhraseReadings } from './nominal-phrases.mjs';
import { sequenceNameReadings } from './sequence-names.mjs';
import { postfixSetQuestions, universalTargetReading } from './set-query.mjs';
import { modifierReading } from './nominal-modifiers.mjs';
import { literalAttachments } from './literal-attachment.mjs';
import { createNearExample } from './near-example.mjs';
import { nominalNumberReading } from './nominal-number.mjs';
import { namedTargetReading } from './target-names.mjs';
import { catalogIssues } from './catalog.mjs';
import { frameSupport } from './language-frames.mjs';
import { contextScores } from './context.mjs';
import { prologWorker } from './prolog-worker.mjs';
import { requestScope } from './request-scope.mjs';
import { guardedPropertyReadings } from './guarded-properties.mjs';
import { createRelationKeyResolver } from './relation-keys.mjs';
import { signatures } from './signatures.mjs';
import { tokens } from './lexicon.mjs';
import { literalRoleCandidates, maskQuoted, quotedSpans } from './literal-roles.mjs';
import { namedArgumentCandidates } from './named-arguments.mjs';
import { clausePrefixes, composableWires, composeParts, coordinationActs, createPreservation, enumeratedParts, sequenceParts } from './composition.mjs';
import { constraintGrounder, evidenceInText, valueResolver } from './grounding.mjs';
import { createTransfer } from './transfer.mjs';
import { loadWorlds } from './worlds.mjs';
import { parse, validate } from './schema.mjs';

const conditionalScope = Symbol('conditional scope');

function add(map, key, item) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(item);
}

// The index eliminates impossible candidates. Prolog unifies the full pattern,
// binds the raw input spans and orders the resulting circuits.
export function createFormaliser(model = {version:1,examples:[],templates:[]}, worlds = loadWorlds(), {languageFrames=true} = {}) {
  if (model.version !== 1) throw Error('Unsupported model version');
  const phraseHeads=new Set(Object.keys(model.nominalPhrases ?? {}).map(k=>JSON.parse(k)[3]));
  const knownModifiers=new Set(Object.keys(model.modifiers ?? {}).map(k=>JSON.parse(k)[1]));
  const nearExample = createNearExample(model.examples,{discourse:worlds.discourse});
  const transfer = createTransfer(model.examples, {
    resolveValue:valueResolver(worlds,model.lexicon,model.forms), fillerPhrases:worlds.discourse
  });
  const targetRoles=[...new Set(worlds.languageFrames.bindings.filter(b=>b.type==='w.request.target').map(b=>b.role))];
  const ground = constraintGrounder();
  const resolveRelationKeys = createRelationKeyResolver(worlds);
  const preservation = createPreservation(model.examples,worlds,model.lexicon);
  const sequenceOptions = {
    isAct:coordinationActs(worlds,model.lexicon),
    isPreservation:preservation.recognises,
    prefixes:clausePrefixes([...(worlds.literalGrammar?.leads ?? []),
      ...(worlds.discourse ?? []).filter(({class:kind})=>kind==='politeness' || kind==='interjection').map(({text})=>text)]),
  };
  function admissibleKey(text, sop) {
    if (!sop || !validate(sop,worlds) || !evidenceInText(text,sop,worlds)) return;
    const wires = parse(sop);
    if (catalogIssues(wires,worlds).length) return;
    return JSON.stringify(signatures(wires,true));
  }
  const examples = new Map(), buckets = new Map(), frequencies = new Map();
  for (const example of model.examples) add(examples, example.text, example);
  for (const t of model.templates) {
    for (const literal of new Set(t.pattern.filter(x => typeof x === 'string'))) {
      frequencies.set(literal, (frequencies.get(literal) ?? 0) + 1);
    }
  }
  for (const template of model.templates) {
    const literals = template.pattern.filter(x => typeof x === 'string');
    const anchor = literals.reduce((a,b) => frequencies.get(a) < frequencies.get(b) ? a : b, literals[0]);
    const min = template.pattern.reduce((n,x) => n + (x.min ?? 1), 0);
    const max = template.pattern.reduce((n,x) => n + (x.max ?? 1), 0);
    add(buckets, anchor, {min,max,template});
  }
  const worker = prologWorker(new URL('../prolog/formalise.pl',import.meta.url));
  async function read(text) {
    if (typeof text !== 'string') throw Error('Expected a text string');
    const ts = tokens(text), chars = Array.from(text);
    const ambiguousTargets = [], templates = [], hits = [], determiners = [], properties = [];
    // A quoted label may itself contain punctuation, negation or a sequence word.
    // Its span remains available to property binding in Prolog.
    const quotes = quotedSpans(text);
    const scopeText = maskQuoted(text,quotes);
    const outside = scopeText === text ? null : new Set(tokens(scopeText).map(t => t[2]));
    const scores = contextScores(text, model.context ?? {});
    for (const anchor of new Set([undefined,...ts.map(t => t[0])])) {
      for (const {min,max,template} of buckets.get(anchor) ?? []) {
        if (min <= ts.length && ts.length <= max) templates.push(template);
      }
    }
    for (let i=0; i<ts.length; i++) {
      let words = '';
      for (let j=i; j<ts.length && j<i+8; j++) {
        if (outside && !outside.has(ts[j][2])) break;
        words += (j===i?'':' ') + ts[j][0];
        for (const property of worlds.properties(words)) properties.push([ts[i][2],ts[j][3],property]);
        if (/^(?:[0-9]+|[(:=+-])$/u.test(ts[j+1]?.[0] ?? '')) {
          for (const tuple of worlds.tuples(words)) properties.push([ts[i][2],ts[j][3],tuple]);
        }
        if (Object.hasOwn(worlds.determiners,words)) determiners.push([ts[i][2],ts[j][3],worlds.determiners[words]]);
        const learned = Object.hasOwn(model.lexicon ?? {},words) ? model.lexicon[words] : [];
        const local = new Set(learned.map(e => JSON.stringify(e.slice(0,-1))));
        const declared = worlds.lookup(words);
        const families = new Set(declared.filter(e=>e[0]==='target').map(e=>e[2]));
        if (families.size>1) ambiguousTargets.push([ts[i][2],ts[j][3], [...families]]);
        const bindings = declared.filter(e => !local.has(JSON.stringify(e.slice(0,-1))));
        for (let entry of [...learned,...bindings]) {
          const [role,a,b] = entry;
          if (role === 'act' && Object.hasOwn(worlds.determiners,words) && !Object.hasOwn(worlds.lexicon,words)) continue;
          if (role === 'constraint') {
            if (Object.hasOwn(worlds.determiners,words)) continue;
            entry = ground(entry,chars.slice(ts[i][2],ts[j][3]).join(''));
            if (!entry) continue;
          }
          const prior = role === 'act' ? scores['act:' + a + '/' + b] ?? 0 : 0;
          hits.push([ts[i][2],ts[j][3],entry,prior]);
        }
      }
    }
    const scope = requestScope(text,scopeText,worlds,hits);
    hits.push(...scope.intentHits);
    const allowConstraints = scope.windows.length > 0;
    const exact = examples.get(text) ?? [];
    const transfers = exact.length ? [] : transfer(text);
    const language = languageFrames ? worlds.languageFrames.prepare(ts,quotes,worlds) : {length:ts.length,events:[],frames:[]};
    const request = {text,scopes:scope.windows,language,targetRoles,ambiguousTargets,allowConstraints,tokens:ts,templates,hits,examples:exact,transfers,determiners,properties};
    const candidates = [], seen = new Set();
    function retain(answer) {
      const key = admissibleKey(text,answer.sop);
      if (key && scope.restricted && !scope.permits(parse(answer.sop))) return;
      if (key && !seen.has(key)) { seen.add(key); candidates.push(answer); }
    }
    for (const candidate of namedArgumentCandidates(text,ts,quotes,worlds,sequenceOptions)) retain(candidate);
    for (const candidate of literalRoleCandidates(text,ts,quotes,worlds)) retain(candidate);
    const contextualTargets = [];
    const response = await worker.request(request);
    for (const answer of response.candidates) {
      if (answer.source !== 'lexicon') { retain(answer); continue; }
      const lexical = {...answer,sop:resolveRelationKeys(answer.sop)};
      retain(lexical);
      for (const attachment of literalAttachments(text,lexical,worlds)) retain(attachment);
      const named = namedTargetReading(text,lexical,worlds);
      if (named) retain(named);
      for (const sop of resolveRelationKeys.targetlessAlternatives(answer.sop)) {
        contextualTargets.push({...answer,sop});
      }
    }
    // Family hypotheses for pronouns follow the text's own readings. The
    // independent estimator can promote one when there is supporting context.
    for (const candidate of contextualTargets) retain(candidate);
    // Add independent constructions after the ranked Prolog proposals so that
    // a new surface form cannot evict an older reading from its bounded search.
    if (!exact.length) for (const candidate of nearExample(text)) retain({...candidate,source:'near-example'});
    for (const candidate of postfixSetQuestions(text,ts,worlds,hits,quotes)) retain(candidate);
    if (!scope.restricted && ts.some(t=>worlds.scopeGrammar.universalHeads.has(t[0]))) {
      for (const candidate of [...candidates]) {
        const universal=universalTargetReading(text,ts,worlds,candidate,quotes);
        if (universal) retain(universal);
      }
    }
    if (!scope.restricted && ts.some(t=>knownModifiers.has(t[0]))) {
      for (const candidate of [...candidates]) {
        const modified=modifierReading(text,ts,quotes,candidate,model.modifiers);
        if (modified) retain(modified);
      }
    }
    if (ts.some(t=>worlds.nominalNumbers.has(t[0]) || /^\d+$/u.test(t[0]))) {
      for (const candidate of [...candidates]) {
        const qualified=nominalNumberReading(text,candidate,worlds.nominalNumbers,quotes,model.modifiers);
        if (qualified) retain(qualified);
      }
    }
    if (!scope.restricted && ts.some(t=>phraseHeads.has(t[0]))) {
      for (const candidate of [...candidates]) {
        for (const reading of nominalPhraseReadings(text,ts,quotes,candidate,model.nominalPhrases,worlds)) retain(reading);
      }
    }
    if (!candidates.some(candidate => candidate.source !== 'lexicon' && !candidate.unread)) {
      const offset = candidates.length;
      for (const candidate of preservation.readings(text,candidates)) retain(candidate);
      candidates.unshift(...candidates.splice(offset));
    }
    if (!candidates.length) return {status:'unresolved',sop:'',unread:text,alternatives:[],[conditionalScope]:scope.preventsSplitting};
    if (response.proofs.length) {
      for (const c of candidates) {
        const proof=frameSupport(parse(c.sop),response.proofs,ts,text,worlds);
        if (proof) c.language=proof;
      }
      // Exact examples, complete templates and special constructions retain
      // their source priority. Break ties between lexical fallback readings.
      const lexical=candidates.filter(c=>c.source==='lexicon');
      const fit=c=>c.language?.conflicts.length ? -1 : c.language?.discriminating ? 1 : 0;
      lexical.sort((a,b)=>fit(b)-fit(a));
      let i=0;
      for (let j=0;j<candidates.length;j++) if (candidates[j].source==='lexicon') candidates[j]=lexical[i++];
    }
    const [best,...alternatives] = candidates;
    return {...best,status:best.status ?? (best.source === 'lexicon' || best.unread ? 'partial' : 'matched'),alternatives,[conditionalScope]:scope.preventsSplitting};
  }
  function combine(text, parts, results, enumeration) {
    let beam = [{cost:0,clauses:[]}];
    const coverageChoice = [];
    for (const [index,result] of results.entries()) {
      const {alternatives,[conditionalScope]:_conditional,...first} = result;
      const item = enumeration && {
        act:enumeration.act,predicate:enumeration.predicate,targets:enumeration.items[index],
      };
      // Discard non-composable readings before they can occupy the beam.
      // Original rank and clause order still break ties between usable readings.
      const options = [first,...alternatives].flatMap((clause,rank)=>{
        const wires = composableWires(clause,item);
        if (!wires) return [];
        const unread = wires.filter(w=>w.type==='w.request.unread')
          .flatMap(w=>w.attrs.text ?? [])
          .reduce((sum,raw)=>sum+tokens(raw.startsWith('"') ? JSON.parse(raw) : raw).length,0);
        return [{clause,rank,unread}];
      });
      if (!options.length) return [];
      coverageChoice.push(options.reduce((a,b)=>b.unread<a.unread ? b : a).clause);
      const next = beam.flatMap(prefix => options.map(({clause,rank}) =>
        ({cost:prefix.cost+rank,clauses:[...prefix.clauses,clause]})));
      beam = next.sort((a,b)=>a.cost-b.cost).slice(0,12);
    }
    const readings = [];
    const seen = new Set();
    // An independently complete reading of each clause can fall outside the
    // rank-sum beam. Keep that combination too; validation and deduplication follow.
    for (const {clauses} of [...beam,{clauses:coverageChoice}]) {
      const sop = composeParts(parts,clauses,enumeration);
      const key = admissibleKey(text,sop);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      readings.push({sop,source:enumeration?'enumeration':'sequence',
        status:clauses.some(c=>c.status==='partial' || c.source==='lexicon' || c.unread) ? 'partial' : 'matched',
        parts:parts.map((text,i)=>({text,source:clauses[i].source}))});
    }
    return readings;
  }
  function mergeReadings(base, readings, preferBase) {
    if (!readings.length) return base;
    const {alternatives,...single} = base;
    const ordered = preferBase ? [single,...readings,...alternatives] : [...readings,single,...alternatives];
    const seen = new Set();
    const [best,...rest] = ordered.filter(candidate => {
      if (!candidate.sop) return false;
      const key = JSON.stringify(signatures(parse(candidate.sop),true));
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return {...best,alternatives:rest};
  }
  const enumerationPlan = (text,ts = tokens(text)) =>
    enumeratedParts(text,ts,worlds,{prefixes:sequenceOptions.prefixes,learned:model.lexicon});
  async function readEnumeration(text, base, plan) {
    if (!plan || base[conditionalScope]) return base;
    const results = [];
    for (const input of plan.inputs) results.push(await read(input));
    const readings = combine(text,plan.parts,results,plan);
    return mergeReadings(base,readings,base.status==='matched');
  }
  async function formalise(text) {
    const base = await read(text);
    if (base[conditionalScope]) {
      const guarded = await guardedPropertyReadings(text,worlds,read);
      return mergeReadings(base,guarded.filter(candidate=>admissibleKey(text,candidate.sop)),base.status==='matched');
    }
    const ts = tokens(text);
    const parts = sequenceParts(text,ts,worlds.joiners,sequenceOptions);
    if (!parts.length) return readEnumeration(text,base,enumerationPlan(text,ts));
    const plans = parts.map(part=>enumerationPlan(part));
    // A complete existing sequence can preserve dependencies that separate
    // lexical reads do not currently resolve.
    const complete = base.status==='matched' &&
      parse(base.sop).filter(w=>w.type==='w.request.request').length>=parts.length;
    // A matching request count does not establish that all arguments were bound.
    const plain = [], results = [];
    for (const [index,part] of parts.entries()) {
      const ordinary = await read(part);
      const result = await readEnumeration(part,ordinary,plans[index]);
      if (!result.sop) return base;
      plain.push(ordinary);
      results.push(result);
    }
    const readings = combine(text,parts,results);
    if (!results.some(r=>r[conditionalScope])) {
      for (const reading of sequenceNameReadings(parts,results,worlds,sequenceOptions)) {
        if (admissibleKey(text,reading.sop)) readings.push(reading);
      }
    }
    if (results.some((result,index)=>result!==plain[index])) readings.push(...combine(text,parts,plain));
    return mergeReadings(base,readings,
      complete || base.status==='matched' && results.some(r=>r.status!=='matched'));
  }
  return {
    async formalise(text) {
      const result = await formalise(text);
      const {alternatives,[conditionalScope]:_conditional,...first} = result;
      const candidates = result.sop ? [first,...alternatives] : [];
      return {candidates,candidateCount:candidates.length,multipleInterpretations:candidates.length>1,
        ...(!candidates.length ? {unread:text} : {})};
    },
    close:worker.close
  };
}
