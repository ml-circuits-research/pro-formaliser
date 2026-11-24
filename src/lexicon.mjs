import { parse } from './schema.mjs';

const wordPattern = /[\p{L}\p{N}\p{M}_]+|[^\s]/gu;
export function tokens(text) {
  const out = [];
  let pos = 0, previous = 0;
  for (const match of text.matchAll(wordPattern)) {
    pos += Array.from(text.slice(previous, match.index)).length;
    const end = pos + Array.from(match[0]).length;
    out.push([match[0].toLowerCase(), match[0], pos, end]);
    previous = match.index + match[0].length;
    pos = end;
  }
  return out;
}
const surface = phrase => tokens(phrase).map(x => x[0]).join(' ');
function one(wire, key) {
  const value = wire?.attrs[key]?.[0];
  return value?.startsWith('"') ? JSON.parse(value) : value;
}

// Only learn meanings paired with an explicit surface in the same training request.
export function learnLexicon(rows, context) {
  const counts = new Map();
  function add(phrase, data) {
    if (!phrase || data.some(x => x === undefined)) return;
    const key = surface(phrase);
    if (!key || key.split(' ').length > 8) return;
    const variants = counts.get(key) ?? new Map();
    const variant = JSON.stringify(data);
    variants.set(variant, (variants.get(variant) ?? 0) + 1);
    counts.set(key, variants);
  }
  for (const {text,sop} of rows) {
    let wires;
    try { wires = parse(sop); } catch { continue; }
    for (const req of wires.filter(w => w.type === 'w.request.request')) {
      const act = one(req, 'act'), mood = one(req, 'mood');
      add(one(req, 'predicate'), ['act', act, mood ?? '']);
      const targets = wires.filter(w => w.type === 'w.request.target' && one(w,'request') === '$' + req.id);
      const labels = new Set(['act:' + act + '/' + (mood ?? ''), ...targets.map(w => 'family:' + one(w,'family'))]);
      context?.observe(one(req,'words') ?? text, labels);
      for (const w of targets) {
        const sort = one(w,'sort'), family = one(w,'family'), mode = one(w,'mode');
        const phrase = one(w,'sort_words') ?? sort ?? one(w,'family_words');
        add(phrase, ['target', act, family, mode, sort ?? '']);
      }
    }
  }
  return Object.fromEntries([...counts].map(([key, variants]) => [key,
    [...variants].sort((a,b) => b[1]-a[1] || (a[0]<b[0]?-1:1))
      .map(([data,count]) => [...JSON.parse(data),count])
  ]));
}
