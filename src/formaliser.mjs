import { contextScores } from './context.mjs';
import { prologWorker } from './prolog-worker.mjs';
import { createRelationKeyResolver } from './relation-keys.mjs';
import { signatures } from './signatures.mjs';
import { tokens } from './lexicon.mjs';
import { composeParts, sequenceParts } from './composition.mjs';
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
export function createFormaliser(model = {version:1,examples:[],templates:[]}, worlds = loadWorlds()) {
  if (model.version !== 1) throw Error('Unsupported model version');
  const transfer = createTransfer(model.examples, {
    resolveValue:valueResolver(worlds,model.lexicon,model.forms), fillerPhrases:worlds.discourse
  });
  const ground = constraintGrounder();
  const resolveRelationKeys = createRelationKeyResolver(worlds);
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
    const templates = [], hits = [], determiners = [], properties = [];
    // A quoted label may itself contain punctuation, negation or a sequence word.
    // Its span remains available to property binding in Prolog.
    const scopeText = text.replace(/"(?:\\.|[^"\\])*"|“[^”]*”|(?<![\p{L}\p{N}])'[^'\n]*'(?![\p{L}\p{N}])/gu,
      literal => ' '.repeat(Array.from(literal).length));
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
        if (Object.hasOwn(worlds.determiners,words)) determiners.push([ts[i][2],ts[j][3],worlds.determiners[words]]);
        if (worlds.negatives.has(words) || ['contrast','sequence','clause'].includes(worlds.joiners[words])) blocksResult = true;
        const learned = Object.hasOwn(model.lexicon ?? {},words) ? model.lexicon[words] : [];
        const local = new Set(learned.map(e => JSON.stringify(e.slice(0,-1))));
        const bindings = worlds.lookup(words).filter(e => !local.has(JSON.stringify(e.slice(0,-1))));
        for (let entry of [...learned,...bindings]) {
          const [role,a,b] = entry;
          if (role === 'act' && Object.hasOwn(worlds.determiners,words) && !Object.hasOwn(worlds.lexicon,words)) continue;
          if (role === 'constraint') {
            if (Object.hasOwn(worlds.determiners,words)) continue;
            entry = ground(entry,chars.slice(ts[i][2],ts[j][3]).join(''));
            if (!entry) continue;
          }
          const key = role === 'act' ? 'act:' + a + '/' + b : 'family:' + b;
          hits.push([ts[i][2],ts[j][3],entry,scores[key] ?? 0]);
        }
      }
    }
    // A positive result learned on a single request has no scope across
    // negation or a clause boundary. Keep unmatched expressions as unread.
    const allowConstraints = !blocksResult && !/\b(?:not|never|no|without|except|avoid|neither|nor|then|instead|but)\b|n['’]t\b|[;!?]|\.\s/iu.test(scopeText);
    const exact = examples.get(text) ?? [];
    const transfers = exact.length ? [] : transfer(text);
    const request = {text,allowConstraints,tokens:ts,templates,hits,examples:exact,transfers,determiners,properties};
    const candidates = [], seen = new Set();
    function retain(answer) {
      if (!validate(answer.sop,worlds) || !evidenceInText(text,answer.sop,worlds)) return;
      const key = JSON.stringify(signatures(parse(answer.sop),true));
      if (!seen.has(key)) { seen.add(key); candidates.push(answer); }
    }
    const contextualTargets = [];
    for (const answer of await worker.request(request)) {
      if (answer.source !== 'lexicon') { retain(answer); continue; }
      retain({...answer,sop:resolveRelationKeys(answer.sop)});
      for (const sop of resolveRelationKeys.targetlessAlternatives(answer.sop)) {
        contextualTargets.push({...answer,sop});
      }
    }
    // Family hypotheses for pronouns follow the text's own readings. The
    // independent estimator can promote one when there is supporting context.
    for (const candidate of contextualTargets) retain(candidate);
    if (!candidates.length) return {status:'unresolved',sop:'',unread:text,alternatives:[]};
    const [best,...alternatives] = candidates;
    return {...best,status:best.source === 'lexicon' || best.unread ? 'partial' : 'matched',alternatives};
  }
  async function formalise(text) {
    const base = await read(text);
    if (base.status === 'matched') return base;
    const parts = sequenceParts(text,tokens(text),worlds.joiners);
    if (!parts.length) return base;
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
      if (!candidate.sop) return;
      const key = JSON.stringify(signatures(parse(candidate.sop),true));
      if (!seen.has(key)) { seen.add(key); readings.push(candidate); }
    }
    for (const {clauses} of beam) {
      const sop = composeParts(parts,clauses);
      if (sop && validate(sop,worlds)) retain({sop,source:'sequence',
        status:clauses.some(c=>c.status==='partial' || c.source==='lexicon' || c.unread) ? 'partial' : 'matched',
        parts:parts.map((text,i)=>({text,source:clauses[i].source}))});
    }
    if (!readings.length) return base;
    const {alternatives,...single} = base;
    for (const candidate of [single,...alternatives]) retain(candidate);
    const [first,...rest] = readings;
    return {...first,alternatives:rest};
  }
  return {
    async formalise(text) {
      const result = await formalise(text);
      const candidateCount = (result.sop ? 1 : 0) + result.alternatives.length;
      return {...result,candidateCount,multipleInterpretations:candidateCount>1};
    },
    close:worker.close
  };
}
