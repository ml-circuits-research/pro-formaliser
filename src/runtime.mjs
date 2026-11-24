import { contextScores } from './context.mjs';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { tokens } from './lexicon.mjs';
import { validate } from './schema.mjs';

const path = rel => fileURLToPath(new URL(rel, import.meta.url));
function add(map, key, item) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(item);
}

// The index eliminates impossible candidates. Prolog unifies the full pattern,
// binds the raw input spans and orders the resulting circuits.
export function createReader(model) {
  if (model.version !== 1) throw Error('Unsupported model version');
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
  return {
    async formalise(text) {
      if (typeof text !== 'string') throw Error('Expected a text string');
      const ts = tokens(text);
      const templates = [], hits = [];
      const scores = contextScores(text, model.context ?? {});
      for (const anchor of new Set([undefined,...ts.map(t => t[0])])) {
        for (const {min,max,template} of buckets.get(anchor) ?? []) {
          if (min <= ts.length && ts.length <= max) templates.push(template);
        }
      }
      for (let i=0; i<ts.length; i++) {
        let words = '';
        for (let j=i; j<ts.length && j<i+8; j++) {
          words += (j===i?'':' ') + ts[j][0];
          if (!Object.hasOwn(model.lexicon ?? {}, words)) continue;
          for (const entry of model.lexicon[words]) {
            const [role,a,b] = entry;
            const key = role === 'act' ? 'act:' + a + '/' + b : 'family:' + b;
            hits.push([ts[i][2],ts[j][3],entry,scores[key] ?? 0]);
          }
        }
      }
      // A positive result learned on a single request has no scope across
      // negation or a clause boundary. Keep unmatched expressions as unread.
      const allowConstraints = !/\b(?:not|never|no|without|except|avoid|neither|nor|then|instead|but)\b|n['’]t\b|[;!?]|\.\s/iu.test(text);
      const request = {text,allowConstraints,tokens:ts,templates,hits,examples:examples.get(text) ?? []};
      proc.stdin.write(JSON.stringify(request) + '\n');
      const line = await replies.next();
      if (line.done) throw Error('Prolog stopped before replying (exit ' + await exited + ')');
      const candidates = [];
      for (const answer of JSON.parse(line.value)) {
        if (validate(answer.sop)) candidates.push(answer);
        if (candidates.length === 3) break;
      }
      if (!candidates.length) return {status:'unresolved',sop:'',unread:text,alternatives:[]};
      const [best,...alternatives] = candidates;
      return {...best,status:best.source === 'lexicon' ? 'partial' : 'matched',alternatives};
    },
    async close() {
      proc.stdin.end();
      const code = await exited;
      if (code !== 0) throw Error('Prolog failed (exit ' + code + ')');
    }
  };
}
