import { catalogIssues } from './catalog.mjs';
import { frameSupport } from './language-frames.mjs';
import { contextScores } from './context.mjs';
import { prologWorker } from './prolog-worker.mjs';
import { createRelationKeyResolver } from './relation-keys.mjs';
import { signatures } from './signatures.mjs';
import { tokens } from './lexicon.mjs';
import { literalRoleCandidates, maskQuoted, quotedSpans } from './literal-roles.mjs';
import { clausePrefixes, composeParts, coordinationActs, createPreservation, sequenceParts } from './composition.mjs';
import { constraintGrounder, evidenceInText, valueResolver } from './grounding.mjs';
import { createTransfer } from './transfer.mjs';
import { loadWorlds } from './worlds.mjs';
import { parse, validate } from './schema.mjs';

function add(map, key, item) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(item);
}

// The index eliminates impossible candidates. Prolog unifies the full pattern,
// binds the raw input spans and orders the resulting circuits.
export function createFormaliser(model = {version:1,examples:[],templates:[]}, worlds = loadWorlds(), {languageFrames=true} = {}) {
  if (model.version !== 1) throw Error('Unsupported model version');
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
    let blocksResult = false;
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
        if (worlds.negatives.has(words) || ['contrast','sequence','clause'].includes(worlds.joiners[words])) blocksResult = true;
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
    // A positive result learned on a single request has no scope across
    // negation or a clause boundary. Keep unmatched expressions as unread.
    const allowConstraints = !blocksResult && !/\b(?:not|never|no|without|except|avoid|neither|nor|then|instead|but)\b|n['’]t\b|[;!?]|\.\s/iu.test(scopeText);
    const exact = examples.get(text) ?? [];
    const transfers = exact.length ? [] : transfer(text);
    const language = languageFrames ? worlds.languageFrames.prepare(ts,quotes,worlds) : {length:ts.length,events:[],frames:[]};
    const request = {text,language,targetRoles,ambiguousTargets,allowConstraints,tokens:ts,templates,hits,examples:exact,transfers,determiners,properties};
    const candidates = [], seen = new Set();
    function retain(answer) {
      const key = admissibleKey(text,answer.sop);
      if (key && !seen.has(key)) { seen.add(key); candidates.push(answer); }
    }
    for (const candidate of literalRoleCandidates(text,ts,quotes,worlds)) retain(candidate);
    const contextualTargets = [];
    const response = await worker.request(request);
    for (const answer of response.candidates) {
      if (answer.source !== 'lexicon') { retain(answer); continue; }
      retain({...answer,sop:resolveRelationKeys(answer.sop)});
      for (const sop of resolveRelationKeys.targetlessAlternatives(answer.sop)) {
        contextualTargets.push({...answer,sop});
      }
    }
    // Family hypotheses for pronouns follow the text's own readings. The
    // independent estimator can promote one when there is supporting context.
    for (const candidate of contextualTargets) retain(candidate);
    if (!candidates.some(candidate => candidate.source !== 'lexicon' && !candidate.unread)) {
      const offset = candidates.length;
      for (const candidate of preservation.readings(text,candidates)) retain(candidate);
      candidates.unshift(...candidates.splice(offset));
    }
    if (!candidates.length) return {status:'unresolved',sop:'',unread:text,alternatives:[]};
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
    return {...best,status:best.status ?? (best.source === 'lexicon' || best.unread ? 'partial' : 'matched'),alternatives};
  }
  async function formalise(text) {
    const base = await read(text);
    const parts = sequenceParts(text,tokens(text),worlds.joiners,sequenceOptions);
    if (!parts.length) return base;
    // A learned single-request template can silently swallow a second
    // imperative. Keep a complete existing multi-request graph intact.
    if (base.status==='matched' && parse(base.sop).filter(w=>w.type==='w.request.request').length>=parts.length) return base;
    const results = [];
    for (const part of parts) {
      const result = await read(part);
      if (!result.sop) return base;
      results.push(result);
    }
    // Keep alternative clause interpretations without enumerating the full
    // Cartesian product. Original clause order breaks equal-cost ties.
    let beam = [{cost:0,clauses:[]}];
    for (const {alternatives,...first} of results) {
      const next = beam.flatMap(prefix => [first,...alternatives].map((clause,rank) =>
        ({cost:prefix.cost+rank,clauses:[...prefix.clauses,clause]})));
      beam = next.sort((a,b)=>a.cost-b.cost).slice(0,12);
    }
    const readings = [];
    const seen = new Set();
    function retain(candidate) {
      const key = admissibleKey(text,candidate.sop);
      if (key && !seen.has(key)) { seen.add(key); readings.push(candidate); }
    }
    for (const {clauses} of beam) {
      const sop = composeParts(parts,clauses);
      if (sop) retain({sop,source:'sequence',
        status:clauses.some(c=>c.status==='partial' || c.source==='lexicon' || c.unread) ? 'partial' : 'matched',
        parts:parts.map((text,i)=>({text,source:clauses[i].source}))});
    }
    if (!readings.length) return base;
    const {alternatives,...single} = base;
    for (const candidate of [single,...alternatives]) retain(candidate);
    if (base.status==='matched' && results.some(r=>r.status!=='matched')) {
      // Partial clause evidence licenses an alternative but is weaker than
      // the original complete construction.
      const pos=readings.findIndex(r=>r.sop===base.sop);
      if (pos>0) readings.unshift(...readings.splice(pos,1));
    }
    const [first,...rest] = readings;
    return {...first,alternatives:rest};
  }
  return {
    async formalise(text) {
      const result = await formalise(text);
      const {alternatives,...first} = result;
      const candidates = result.sop ? [first,...alternatives] : [];
      return {candidates,candidateCount:candidates.length,multipleInterpretations:candidates.length>1,
        ...(!candidates.length ? {unread:text} : {})};
    },
    close:worker.close
  };
}
