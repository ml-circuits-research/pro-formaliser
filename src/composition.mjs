import { parse } from './schema.mjs';

const quotes = new Map([['"', '"'], ["'", "'"], ['“', '”'], ['‘', '’']]);

// An explicit sequence separates requests only when the following segment
// actually reads as a request. Quoted names and inline literals stay intact.
export function sequenceParts(text, ts, joiners) {
  const chars = Array.from(text);
  const parts = [];
  let quote = '', start = 0;
  for (let i = 0; i < ts.length; i++) {
    const [word,,s,e] = ts[i];
    if (word === "'" && /[\p{L}\p{N}]/u.test(chars[s-1] ?? '') && /[\p{L}\p{N}]/u.test(chars[e] ?? '')) continue;
    if (quote) {
      if (word === quote) quote = '';
      continue;
    }
    if (quotes.has(word)) { quote = quotes.get(word); continue; }
    if (!['sequence','clause'].includes(joiners[word])) continue;
    let stop = s;
    while (i > 0 && ts[i-1][2] >= start && ['coordination','list-or-clause'].includes(joiners[ts[i-1][0]])) {
      stop = ts[--i][2];
    }
    const part = chars.slice(start,stop).join('').trim();
    if (!part) return [];
    parts.push(part);
    if (parts.length >= 8) return [];
    start = e;
    while (i + 1 < ts.length && ts[i+1][2] < e) i++;
  }
  const tail = chars.slice(start).join('').trim();
  return parts.length && tail && !quote ? [...parts,tail] : [];
}

export function composeParts(parts, results) {
  const lines = [];
  for (let i = 0; i < parts.length; i++) {
    const wires = parse(results[i].sop);
    const requests = wires.filter(w => w.type === 'w.request.request');
    if (requests.length !== 1 || !requests[0].attrs.predicate) return null;
    // Relabel only actual local references. A quoted name that resembles an ID
    // remains literal data.
    const ids = new Map(wires.map(w => [w.id,'s' + (i+1) + '.' + w.id]));
    for (const wire of wires) {
      const attrs = {...wire.attrs};
      if (wire === requests[0] && !attrs.words) attrs.words = [JSON.stringify(parts[i])];
      const fields = Object.entries(attrs).flatMap(([k,values]) => values.map(v => {
        const ref = v.startsWith('$') && ids.get(v.slice(1));
        return k + '=' + (ref ? '$' + ref : v);
      }));
      lines.push(['@' + ids.get(wire.id),wire.type,...fields].join(' '));
    }
  }
  return lines.join('\n');
}
