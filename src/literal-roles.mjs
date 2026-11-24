import { tokens } from './lexicon.mjs';

const definite = new Set(['definite', 'demonstrative', 'possessive']);
const normalized = text => tokens(text).map(token => token[0]).join(' ');
const quote = JSON.stringify;
const encode = value => /^[\p{L}\p{N}_][\p{L}\p{N}_.-]*$/u.test(value) ? value : quote(value);
const unquotedRemainder = /[\p{L}\p{N}]/u;

export function quotedSpans(text) {
  const quotes = [];
  let offset = 0, previous = 0;
  for (const match of text.matchAll(/"(?:\\.|[^"\\])*"|“[^”]*”|(?<![\p{L}\p{N}])‘[^’\n]*’(?![\p{L}\p{N}])|(?<![\p{L}\p{N}])'(?:\\.|[^'\\\n])*'(?![\p{L}\p{N}])/gu)) {
    offset += Array.from(text.slice(previous, match.index)).length;
    const raw = match[0], end = offset + Array.from(raw).length;
    const value = raw.slice(1, -1);
    quotes.push({start:offset, end, value});
    offset = end;
    previous = match.index + raw.length;
  }
  return quotes;
}

export function maskQuoted(text, quotes) {
  if (!quotes.length) return text;
  const chars = Array.from(text);
  for (const {start,end} of quotes) chars.fill(' ', start, end);
  return chars.join('');
}

function phrases(ts, start, end = ts.length) {
  let surface = '';
  const choices = [];
  for (let i = start; i < Math.min(end, start + 8); i++) {
    surface += (i === start ? '' : ' ') + ts[i][0];
    choices.unshift({surface, start:ts[start][2], end:ts[i][3], next:i+1});
  }
  return choices;
}

function requestHeads(ts, worlds) {
  const heads = [];
  const grammar = worlds.literalGrammar;
  for (let i = 0; i < Math.min(12,ts.length); i++) {
    const head = ts.slice(0,i).map(token => token[0]).filter(token => token !== ',').join(' ');
    if (head && !grammar.leads.has(head) && !worlds.fillerPhrases.has(head)) continue;
    for (const choice of phrases(ts,i)) {
      for (const verb of grammar.verbs(choice.surface)) heads.push({...choice,...verb});
    }
    // An accepted lead may itself span several tokens.
    if (heads.length) break;
  }
  return heads;
}

function openKeys(worlds, surface, family) {
  return worlds.properties(surface).filter(key => key.family === family && key.kind === 'quoted')
    .map(key => key.attribute);
}

function roleKeys(worlds, family, role, surface) {
  return worlds.literalGrammar.bindings.filter(binding => binding.family === family &&
    (!role || binding.role === role) && (!surface || binding.surfaces.includes(surface)))
    .map(binding => binding.attribute);
}

function clauseEnds(ts, next, end) {
  return ts.slice(next).findIndex(token => token[2] >= end);
}

function knownTargets(ts, start, stop, act, worlds) {
  const determiner = phrases(ts,start,stop).find(choice => Object.hasOwn(worlds.determiners,choice.surface));
  const startNominal = determiner?.next ?? start;
  for (const phrase of phrases(ts,startNominal,stop)) {
    const targets = worlds.lookup(phrase.surface).filter(([role, licence]) => role === 'target' && licence === act);
    if (targets.length) return {phrase, targets, det:worlds.determiners[determiner?.surface]};
  }
  return {det:worlds.determiners[determiner?.surface]};
}

function constraint(key, value, evidence, phase = 'result') {
  return {key,value,phase,keyWords:evidence};
}

function circuit({span, head, end, target, constraints}) {
  const tail = span(end).replace(/^\s*[.,!?]+\s*/u,'').trim();
  const hasUnread = unquotedRemainder.test(tail);
  const statement = span(head.start,hasUnread ? undefined : end);
  const request = '@r1 w.request.request act=' + encode(head.act) + ' mood=do predicate=' +
    encode(span(head.start,head.end)) + (statement === span(0) ? '' : ' words=' + quote(statement));
  const fields = [
    'family=' + encode(target.family), 'mode=' + target.mode,
    target.det && 'determiner=' + target.det,
    target.name !== undefined && 'fill=written name=' + quote(target.name),
    target.description && 'fill=description description=' + quote(target.description),
    target.context && 'fill=context',
    target.sort && 'sort=' + encode(target.sort),
    target.sort && target.surface !== target.sort && 'sort_words=' + quote(target.surface),
    !target.sort && target.surface && 'family_words=' + quote(target.surface),
  ];
  const wires = [request,'@r1.t w.request.target request=$r1 ' + fields.filter(Boolean).join(' ')];
  if (target.context) wires.push('@r1.l1 w.request.lookup request=$r1 target=$r1.t key=thing from=page');
  constraints.forEach(({key,value,phase,keyWords},i) => {
    wires.push('@r1.c' + (i+1) + ' w.request.constraint request=$r1 on=attribute attribute=' +
      encode(key) + ' value=' + encode(value) + ' operator=eq phase=' + phase +
      (keyWords ? ' key_words=' + quote(keyWords) : ''));
  });
  if (hasUnread) wires.push('@r1.u1 w.request.unread request=$r1 text=' + quote(tail));
  return {sop:wires.join('\n'),source:'lexicon',support:0};
}

function replacement(span, ts, quotes, head, worlds) {
  const readings = [];
  for (let i = head.next + 1; i < ts.length; i++) {
    for (const marker of phrases(ts,i)) {
      if (!worlds.lookup(marker.surface).some(([role,act,slot]) =>
        role === 'marker' && act === head.act && slot === 'replacement')) continue;
      const left = span(ts[head.next][2], marker.start).trim();
      if (!left) continue;
      const after = ts[marker.next]?.[2];
      const rightQuote = quotes.find(item => item.start === after);
      const firstQuote = quotes.find(item => item.start === ts[head.next][2] && item.end <= marker.start);
      const backwards = head.object === 'replacement';
      const value = backwards ? firstQuote?.value : rightQuote?.value;
      const end = rightQuote?.end ?? ts.at(-1)[3];
      if (value === undefined) continue;
      if (backwards && span(firstQuote.end,marker.start).trim()) continue;
      const last = backwards ? ts.length : i;
      const start = backwards ? marker.next : head.next;
      const selected = knownTargets(ts,start,last,head.act,worlds);
      const surface = selected.phrase && span(selected.phrase.start,selected.phrase.end);
      const selectedText = backwards ? span(after,rightQuote?.end).replace(/[.?!]+$/u,'').trim() : left;
      if (!selectedText || worlds.isReference(selectedText)) continue;
      const named = backwards ? rightQuote?.value : firstQuote?.value;
      const explicit = selected.targets?.filter(([, ,family]) => worlds.literalGrammar.licenses(family,head.act));
      const families = explicit?.map(([, ,family]) => family) ??
        worlds.literalGrammar.bindings.filter(({role,family}) => role === 'payload' &&
          worlds.literalGrammar.licenses(family,head.act)).map(({family}) => family);
      for (const family of new Set(families)) {
        const kindHit = explicit?.find(target => target[2] === family);
        const extra = kindHit && span(selected.phrase.end,backwards ? rightQuote?.end : marker.start).trim();
        const selectedQuote = extra && quotes.find(item => item.start === selected.phrase.end +
          Array.from(span(selected.phrase.end).match(/^\s*/u)[0]).length);
        const attribute = extra && openKeys(worlds,normalized(extra),family);
        const keys = attribute?.length ? attribute : roleKeys(worlds,family,'payload');
        for (const key of new Set(keys)) {
          const target = {family,mode:'existing',det:selected.det,sort:kindHit?.[4],surface};
          const constraints = [constraint(key,value,span(marker.start,marker.end))];
          if (named !== undefined && !kindHit) {
            target.description = selectedText;
            constraints.unshift(constraint(key,named,undefined,'selector'));
          } else if (selectedQuote) target.name = selectedQuote.value;
          else if (!kindHit) target.name = selectedText;
          else if (extra && !attribute?.length) target.name = extra;
          else target.context = true;
          readings.push(circuit({span,head,end,target,constraints}));
        }
      }
      if (readings.length) return readings;
    }
  }
  return readings;
}

function keysForCue(worlds, surface, family) {
  const direct = [...openKeys(worlds,surface,family), ...roleKeys(worlds,family,undefined,surface)];
  if (direct.length) return [...new Set(direct)];
  if (worlds.literalGrammar.namingLeads.has(surface)) return roleKeys(worlds,family,'name');
  if (worlds.literalGrammar.contentLeads.has(surface)) return roleKeys(worlds,family,'payload');
  return [];
}

function creation(span, ts, quotes, head, worlds) {
  const stop = ts.findIndex(token => token[2] === quotes[0].start);
  const known = knownTargets(ts,head.next,stop,head.act,worlds);
  if (!known.targets || definite.has(known.det)) return [];
  const readings = [];
  for (const [, ,family,mode,sort] of known.targets) {
    if (mode !== 'new') continue;
    const cueList = (start,limit) => phrases(ts,start,limit)
      .map(cue => ({...cue,keys:keysForCue(worlds,cue.surface,family)})).filter(cue => cue.keys.length);
    const constraints = [];
    let pos = known.phrase.next, end = known.phrase.end, quoted = false;
    while (pos < ts.length) {
      const cue = cueList(pos,ts.length)[0];
      if (!cue) break;
      const literal = quotes.find(item => item.start === ts[cue.next]?.[2]);
      const cueWords = span(cue.start,cue.end);
      if (literal) {
        constraints.push(cue.keys.map(key => constraint(key,literal.value,cueWords)));
        end = literal.end;
        const distance = clauseEnds(ts,cue.next,end);
        quoted = true;
        if (distance < 0) break;
        pos = cue.next + distance;
      } else {
        let following = stop;
        for (let i = cue.next + 1; i < stop; i++) {
          if (cueList(i,stop).some(candidate => candidate.next === stop)) { following = i; break; }
        }
        if (following === stop) break;
        const value = span(ts[cue.next][2],ts[following][2]).trim();
        constraints.push(cue.keys.map(key => constraint(key,value,cueWords)));
        pos = following;
      }
    }
    if (!quoted) continue;
    const target = {family,mode,sort,det:known.det,surface:span(known.phrase.start,known.phrase.end)};
    const preferred = constraints.map(([first]) => first);
    readings.push(circuit({span,head,end,target,constraints:preferred}));
    // Retain each genuine alternative without combining unrelated ambiguities.
    constraints.forEach(([, ...rest], i) => {
      for (const choice of rest) {
        const fields = preferred.with(i,choice);
        readings.push(circuit({span,head,end,target,constraints:fields}));
      }
    });
  }
  return readings;
}

export function literalRoleCandidates(text, ts, quotes, worlds) {
  if (!quotes.length || !worlds.literalGrammar) return [];
  const chars = Array.from(text);
  const span = (start,end) => chars.slice(start,end).join('');
  const scope = maskQuoted(text,quotes);
  if (/\b(?:not|never|without|except|instead|but)\b|n['’]t\b/iu.test(scope)) return [];
  return requestHeads(ts,worlds).flatMap(head => head.act === 'make'
    ? creation(span,ts,quotes,head,worlds)
    : replacement(span,ts,quotes,head,worlds));
}
