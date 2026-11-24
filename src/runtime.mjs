import { contextScores } from './context.mjs';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { tokens } from './lexicon.mjs';
import { composeParts, sequenceParts } from './composition.mjs';
import { constraintGrounder, evidenceInText, valueResolver } from './grounding.mjs';
import { createTransfer } from './transfer.mjs';
import { loadWorlds } from './worlds.mjs';
import { parse, validate } from './schema.mjs';

const path = rel => fileURLToPath(new URL(rel, import.meta.url));
function add(map, key, item) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(item);
}

// The index eliminates impossible candidates. Prolog unifies the full pattern,
// binds the raw input spans and orders the resulting circuits.
export function createReader(model = {version:1,examples:[],templates:[]}, worlds = loadWorlds()) {
  if (model.version !== 1) throw Error('Unsupported model version');
  const transfer = createTransfer(model.examples, {
    resolveValue:valueResolver(worlds,model.lexicon,model.forms), fillerPhrases:worlds.discourse
  });
  const ground = constraintGrounder();
  const attrTabs = new Map();
  for (const row of worlds.requestKeys) add(attrTabs,row.name,row.tab);
  function tabScore(candidate, tab) {
    let matches = 0, conflicts = 0;
    for (const wire of parse(candidate.sop)) {
      const raw = wire.attrs.family?.[0] ?? wire.attrs.attribute?.[0];
      if (!raw) continue;
      const key = raw.startsWith('"') ? JSON.parse(raw) : raw;
      const tabs = wire.attrs.family ? worlds.familyTabs[key] : attrTabs.get(key);
      if (!tabs?.length) continue;
      if (tabs.includes(tab)) matches++;
      else conflicts++;
    }
    return (matches ? 1 : 0) - Math.min(2,conflicts);
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
  const proc = spawn(path('../tools/swipl'), ['-q','-f','none','-s',path('../prolog/formalise.pl')], {stdio:['pipe','pipe','inherit']});
  const exited = new Promise(resolve => {
    proc.once('error', e => resolve(e.message));
    proc.once('close', (code, signal) => resolve(signal ?? code));
  });
  proc.stdin.on('error', () => {}); // The read below reports the process exit.
  const replies = createInterface({input:proc.stdout})[Symbol.asyncIterator]();
  async function read(text, tab) {
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
          const affinity = role === 'target' && tab && worlds.familyTabs[b]?.includes(tab) ? 4 : 0;
          hits.push([ts[i][2],ts[j][3],entry,(scores[key] ?? 0) + affinity]);
        }
      }
    }
    // A positive result learned on a single request has no scope across
    // negation or a clause boundary. Keep unmatched expressions as unread.
    const allowConstraints = !blocksResult && !/\b(?:not|never|no|without|except|avoid|neither|nor|then|instead|but)\b|n['’]t\b|[;!?]|\.\s/iu.test(scopeText);
    const exact = examples.get(text) ?? [];
    const transfers = exact.length ? [] : transfer(text);
    const request = {text,allowConstraints,tokens:ts,templates,hits,examples:exact,transfers,determiners,properties};
    proc.stdin.write(JSON.stringify(request) + '\n');
    const line = await replies.next();
    if (line.done) throw Error('Prolog stopped before replying (exit ' + await exited + ')');
    const candidates = [];
    for (const answer of JSON.parse(line.value)) {
      if (validate(answer.sop,worlds) && evidenceInText(text,answer.sop)) candidates.push(answer);
      if (!tab && candidates.length === 3) break;
    }
    if (tab) {
      const scores = new Map(candidates.map((c,i) => [c,tabScore(c,tab) - i/6]));
      candidates.sort((a,b) => scores.get(b) - scores.get(a));
      candidates.splice(3);
    }
    if (!candidates.length) return {status:'unresolved',sop:'',unread:text,alternatives:[]};
    const [best,...alternatives] = candidates;
    return {...best,status:best.source === 'lexicon' || best.unread ? 'partial' : 'matched',alternatives};
  }
  async function formalise(text, {tab} = {}) {
    const base = await read(text,tab);
    if (base.status === 'matched') return base;
    const parts = sequenceParts(text,tokens(text),worlds.joiners);
    if (!parts.length) return base;
    const results = [];
    for (const part of parts) {
      const result = await read(part,tab);
      if (!result.sop) return base;
      results.push(result);
    }
    const sop = composeParts(parts,results);
    if (!sop || !validate(sop,worlds)) return base;
    const {alternatives,...single} = base;
    return {sop,status:results.some(r => r.status === 'partial') ? 'partial' : 'matched',
      source:'sequence',parts:parts.map((text,i) => ({text,source:results[i].source})),alternatives:[single,...alternatives].slice(0,2)};
  }
  // One serialized JSONL dialogue per Prolog worker, even for concurrent API callers.
  let pending = Promise.resolve();
  return {
    formalise(...args) {
      const result = pending.then(() => formalise(...args));
      pending = result.catch(() => {});
      return result;
    },
    async close() {
      await pending;
      proc.stdin.end();
      const code = await exited;
      if (code !== 0) throw Error('Prolog failed (exit ' + code + ')');
    }
  };
}
