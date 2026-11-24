import { supportedMeaning } from './training-evidence.mjs';
import { literalField, literalRanges } from './evidence.mjs';
import { tokens } from './lexicon.mjs';
import { quotedSpans } from './literal-roles.mjs';
import { consumeUnread } from './nominal-evidence.mjs';
import { parse, serialize } from '../.cache/knowledge/tools/sopworld/sopworld.mjs';

const requestType = 'w.request.request', targetType = 'w.request.target';
const constraintType = 'w.request.constraint', unreadType = 'w.request.unread';
const lookupType = 'w.request.lookup';
const decode = value => value?.startsWith('"') ? JSON.parse(value) : value;
const field = (wire, key) => decode(wire.attrs[key]?.[0]);
const noun = target => field(target, 'sort_words') ?? field(target, 'family_words') ?? field(target, 'sort');
const word = /^[\p{L}\p{M}\p{N}_]+$/u;
const normalize = text => tokens(text).map(token => token[0]).join(' ');
const modeKey = (target, request) => [field(target, 'family'), field(request, 'act'), field(target, 'mode')];
const encode = value => /^[\p{L}_][\p{L}\p{M}\p{N}_.-]*$/u.test(value) ? value : JSON.stringify(value);
const allowedFields = new Set(['id', 'request', 'attribute', 'on', 'value', 'words', 'key_words', 'open_value', 'operator', 'phase']);
const allowedOperators = new Set(['eq', 'region', 'degree']);
const boundary = /^[,.;:!?—–，。！？；：]$/u;

function nounPosition(ts, head) {
  const words = normalize(head).split(' ');
  if (!words.every(token => word.test(token))) return;
  const matches = ts.flatMap((_, i) => words.every((token, j) => ts[i + j]?.[0] === token) ? [i] : []);
  if (matches.length === 1) return [matches[0], matches[0] + words.length];
}

function matchesAt(ts, from, words) {
  return words.every((token, i) => ts[from+i]?.[0]===token);
}

function lexicalWords(text) {
  const words=text && normalize(text).split(' ');
  return words?.length && words.length<=8 && words.every(token=>word.test(token)) ? words : undefined;
}

function catalogAllows(worlds,family,key,value) {
  return !worlds || worlds.requestKeys.some(prop=>prop.family===family && prop.name===key &&
    prop.head.split('+').some(h=>h==='class' || h==='candidate') &&
    (!prop.values.length || prop.values.includes(value)));
}

function anchoredPart(wire,ts,at,worlds) {
  const value=lexicalWords(field(wire,'value'));
  const marker=lexicalWords(field(wire,'key_words'));
  if (wire.attrs.words) {
    const words=lexicalWords(field(wire,'words'));
    if (!words || !matchesAt(ts,at,words)) return;
    return words;
  }
  if (!value || wire.attrs.key_words && !marker) return;
  if (!marker) return matchesAt(ts,at,value) ? value : undefined;
  const limit=Math.min(ts.length,at+8);
  const addresses=words=>Array.from({length:Math.max(0,limit-at-words.length+1)},(_,i)=>at+i)
    .filter(i=>matchesAt(ts,i,words));
  const candidates=new Map();
  for (const a of addresses(value)) {
    for (const b of addresses(marker)) {
      if (a<b+marker.length && b<a+value.length) continue;
      const stop=Math.max(a+value.length,b+marker.length);
      const words=ts.slice(at,stop).map(t=>t[0]);
      if (!words.every((form,i)=> {
        const p=at+i;
        return p>=a&&p<a+value.length || p>=b&&p<b+marker.length ||
          word.test(form) && !worlds?.joiners[form] && !worlds?.negatives.has(form) &&
          !worlds?.scopeGrammar.conditionals.has(form) && worlds?.evidenceVocabulary.grammar.has(form);
      })) continue;
      candidates.set(words.join(' '),words);
    }
  }
  return candidates.size===1 ? [...candidates.values()][0] : undefined;
}

function partsAt(wires,ts,at,worlds,family,mode) {
  const options=[];
  for (const wire of wires) {
    const key=field(wire,'attribute'), value=field(wire,'value'), on=field(wire,'on');
    const operator=field(wire,'operator') ?? 'eq', phase=field(wire,'phase') ?? 'result';
    if (!key || !value || !on || wire.attrs.value?.length!==1 || (wire.attrs.words?.length ?? 0)>1 ||
        (wire.attrs.key_words?.length ?? 0)>1 || on==='place') continue;
    const words=anchoredPart(wire,ts,at,worlds);
    if (!words) continue;
    const marker=lexicalWords(field(wire,'key_words'));
    if (wire.attrs.key_words && (!marker || !words.some((_,i)=>marker.every((token,j)=>words[i+j]===token)))) continue;
    if (!catalogAllows(worlds,family,key,value)) continue;
    if (words.length===1 && !wire.attrs.words && !marker && worlds?.requestKeys.some(prop=>
      prop.family===family && prop.name!==key && prop.values.includes(value))) continue;
    const usable=(mode!=='new' || phase==='result') && allowedOperators.has(operator) &&
      Object.keys(wire.attrs).every(name=>allowedFields.has(name));
    options.push({words,meaning:usable && JSON.stringify([key,value,on,operator,phase])});
  }
  return options;
}

function uniqueParts(parts) {
  return [...new Map(parts.map(part=>[JSON.stringify([part.words,part.meaning]),part])).values()];
}

function groundedPlacementEnd(wires,ts,at,worlds,family) {
  if (!worlds?.spatialBindings) return;
  const lead=ts[at]?.[0];
  const bridge=worlds.evidenceVocabulary.grammar.has(lead) && !worlds.negatives.has(lead) &&
    !worlds.joiners[lead] && !worlds.scopeGrammar.conditionals.has(lead);
  const bounds=new Map();
  const relations=wires.filter(w=>field(w,'on')==='place' && field(w,'operator')==='relation' &&
    w.attrs.value?.length===1 && !w.attrs.want);
  for (const {relationKey,anchorKey} of worlds.spatialBindings.filter(binding=>binding.family===family)) {
    const markers=relations.filter(w=>field(w,'attribute')===relationKey);
    const anchors=relations.filter(w=>field(w,'attribute')===anchorKey && field(w,'phase')==='selector');
    for (const marker of markers) {
      const prefix=lexicalWords(field(marker,'words') ?? field(marker,'value'));
      if (!prefix) continue;
      for (const anchor of anchors) {
        const name=lexicalWords(field(anchor,'value'));
        if (!name) continue;
        const coversName=prefix.length>name.length && name.every((word,i)=>prefix[prefix.length-name.length+i]===word);
        const words=coversName ? prefix : [...prefix,...name];
        const positions=ts.flatMap((_,i)=>matchesAt(ts,i,words) ? [i] : []);
        const [start]=positions;
        if (positions.length===1 && (start===at || bridge && start===at+1)) {
          const end=start+words.length;
          const meaning=JSON.stringify([start,end,relationKey,anchorKey,field(marker,'value'),field(marker,'phase'),name]);
          bounds.set(meaning,end);
        }
      }
    }
  }
  return bounds.size===1 ? [...bounds.values()][0] : undefined;
}

export function createNominalPhraseLearner(worlds) {
  const observations = new Map();
  return {
    observe(text, target, constraints, request) {
      const active = modeKey(target, request);
      const head = noun(target);
      if (!active[0] || !active[1] || !['new', 'existing'].includes(active[2]) || !head) return;
      const ts=tokens(text), position=nounPosition(ts,head);
      if (!position) return;
      const [start,after]=position, quotes=quotedSpans(text);
      const owned=(Array.isArray(constraints) ? constraints : [constraints])
        .filter(w=>!w.attrs.request || field(w,'request')==='$'+request.id);
      const witness=ts.map(t=>t[0]).join(' '), sort=normalize(field(target,'sort') ?? head);
      for (let at=after;at<ts.length;) {
        const parts=uniqueParts(partsAt(owned,ts,at,worlds,active[0],active[2]));
        if (!parts.length) {
          const end=groundedPlacementEnd(owned,ts,at,worlds,active[0]);
          if (!end || quotes.some(q=>q.start<ts[end-1][3] && q.end>ts[start][2])) break;
          at=end;
          continue;
        }
        if (parts.some(({words})=>quotes.some(q=>q.start<ts[at+words.length-1][3] && q.end>ts[start][2]))) break;
        for (const {words,meaning} of parts) {
          const identity=JSON.stringify([...active,words[0]]);
          const group=observations.get(identity) ?? new Map();
          observations.set(identity,group);
          const phrase=words.join(' '), witnesses=group.get(phrase) ?? new Map();
          group.set(phrase,witnesses);
          const entry=witnesses.get(witness);
          if (!entry) witnesses.set(witness,{semantics:meaning,sort});
          else if (entry.semantics!==meaning) entry.semantics=false;
          else if (entry.sort!==sort) entry.sort=undefined;
        }
        if (parts.length!==1 || !parts[0].meaning) break;
        at+=parts[0].words.length;
      }
    },
    finish() {
      return Object.fromEntries([...observations].flatMap(([id, group]) => {
        const forms = [...group].flatMap(([surface, witnesses]) => {
          const meaning = supportedMeaning(witnesses,2);
          return meaning ? [[surface.split(' '), ...JSON.parse(meaning)]] : [];
        });
        return forms.length ? [[id, forms]] : [];
      }));
    },
  };
}

function spatialPair(wires, constraints, family, surface, worlds) {
  const pairs = [];
  for (const {relationKey, anchorKey} of worlds.spatialBindings.filter(binding => binding.family === family)) {
    for (const relation of constraints.filter(w => field(w, 'attribute') === relationKey &&
      field(w, 'on') === 'place' && field(w, 'operator') === 'relation' && w.attrs.value?.length === 1)) {
      const marker = normalize(field(relation, 'words') ?? field(relation, 'value'));
      for (const anchor of constraints.filter(w => field(w, 'attribute') === anchorKey &&
        field(w, 'on') === 'place' && field(w, 'operator') === 'relation' && field(w, 'phase') === 'selector' &&
        w.attrs.value?.length === 1 && !w.attrs.words)) {
        if (marker + ' ' + normalize(field(anchor, 'value')) !== surface) continue;
        const lookups = wires.filter(w => w.type === lookupType && field(w, 'constraint') === '$' + anchor.id);
        pairs.push([relation, anchor, ...lookups]);
      }
    }
  }
  if (pairs.length !== 1) return [];
  const drop = new Set(pairs[0]);
  const refs = new Set([...drop].map(w => '$' + w.id));
  return wires.some(w => !drop.has(w) && Object.values(w.attrs).flat().some(value => refs.has(value)))
    ? [] : pairs[0];
}

function normalSpans(text, value) {
  return literalRanges(text.toLowerCase(), value.toLowerCase());
}

function separatesPhrase(ts, next, worlds) {
  if (!ts[next] || boundary.test(ts[next][0])) return true;
  for (let end = next + 1; end <= Math.min(ts.length, next + 4); end++) {
    const continuation = ts.slice(next, end).map(token => token[0]).join(' ');
    if (worlds.joiners[continuation] ||
      worlds.lookup(continuation).some(([role, , kind, relation]) =>
        role === 'marker' && kind === 'spatial' && relation)) return true;
  }
  return false;
}

export function nominalPositionForms(facts, requestKeys) {
  const cues = [];
  for (const wire of facts('w.lang.en.cue')) {
    const on=field(wire,'on'), value=field(wire,'value'), relation=field(wire,'relation');
    if (field(wire,'takes')!=='none' || !value) continue;
    const kind=on==='layout' ? 'arrangement' : on==='place' && ['in','at'].includes(relation) &&
      !wire.attrs.attribute ? 'region' : undefined;
    if (kind) for (const surface of wire.attrs.lead ?? []) cues.push([kind,decode(surface),[value]]);
  }
  for (const wire of facts('w.lang.en.arrangement')) {
    const values=[field(wire,'layout'),field(wire,'diagram_layout')].filter(Boolean);
    for (const surface of wire.attrs.text ?? []) cues.push(['arrangement',decode(surface),values]);
  }
  const indexes=new Map();
  for (const wire of facts('pro.reader.spatial')) {
    const family=field(wire,'family'), tab=field(wire,'tab');
    const roles={region:field(wire,'region_key'),arrangement:field(wire,'arrangement_key')};
    for (const [kind,surface,values] of cues) {
      const key=roles[kind];
      if (!key) continue;
      const property=requestKeys.find(prop=>prop.family===family && prop.tab===tab && prop.name===key &&
        prop.head.split('+').some(h=>h==='class' || h==='candidate'));
      const value=values.find(value=>property?.values.includes(value));
      const words=normalize(surface).split(' ');
      if (!value || words.length<2 || !words.every((token,i)=>word.test(token) ||
        token==='-' && word.test(words[i-1] ?? '') && word.test(words[i+1] ?? ''))) continue;
      const operator=kind==='region' ? 'region' : 'eq';
      const byLead=indexes.get(family) ?? new Map();
      if (!indexes.has(family)) indexes.set(family,byLead);
      const options=byLead.get(words[0]) ?? new Map();
      if (!byLead.has(words[0])) byLead.set(words[0],options);
      const entry=[words,key,value,'attribute',operator];
      options.set(JSON.stringify(entry),entry);
    }
  }
  return new Map([...indexes].map(([family,byLead])=>[family,new Map([...byLead].map(([lead,options])=>
    [lead,[...options.values()]]))]));
}

export function nominalPhraseReadings(text, ts, quotes, candidate, forms, worlds) {
  if (!forms || !candidate.sop) return [];
  let wires = parse(candidate.sop);
  const targets = wires.filter(w => w.type === targetType), requests = wires.filter(w => w.type === requestType);
  if (targets.length !== 1 || requests.length !== 1) return [];
  const [target] = targets, [request] = requests;
  const [family, act, mode] = modeKey(target, request);
  const head = noun(target);
  const ref = '$' + request.id;
  if (!head || !family || !act || field(target, 'request') !== ref || !['new', 'existing'].includes(mode)) return [];
  const position = nounPosition(ts, head);
  if (!position) return [];
  const [start,after] = position;
  const learned=at=>(forms[JSON.stringify([family,act,mode,ts[at]?.[0]])] ?? [])
    .filter(([words])=>matchesAt(ts,at,words));
  const owned=()=>wires.filter(w=>w.type===constraintType && field(w,'request')===ref);
  const grounded=at=>uniqueParts(partsAt(owned(),ts,at,worlds,family,mode));
  const placement=at=>groundedPlacementEnd(owned(),ts,at,worlds,family);
  let revised;
  for (let at=after;at<ts.length;) {
    const options=learned(at), existing=grounded(at);
    if (options.length>1 || existing.length>1) break;
    const [entry]=options, [covered]=existing;
    if (covered) {
      if (!covered.meaning || entry && (covered.words.join(' ')!==entry[0].join(' ') ||
          covered.meaning!==JSON.stringify(entry.slice(1)))) break;
      at+=covered.words.length;
      continue;
    }
    if (!entry) {
      const end=placement(at);
      if (!end) break;
      at=end;
      continue;
    }
    const next=at+entry[0].length;
    const following=learned(next).length===1 || grounded(next).some(part=>part.meaning) || Boolean(placement(next));
    const attached=attachPhrase(text,ts,quotes,wires,request,target,start,at,entry,worlds,following);
    if (!attached?.sop) break;
    revised=attached;
    wires=parse(attached.sop);
    at=next;
  }
  return revised ? [revised] : [];
}

function attachPhrase(text, ts, quotes, wires, request, target, start, at, entry, worlds, followed = false) {
  const [keys, key, value, on, operator, requestedPhase]=entry;
  const family=field(target,'family'), ref='$'+request.id;
  if (!followed && !separatesPhrase(ts, at + keys.length, worlds)) return;
  const fromChar = ts[at][2], toChar = ts[at + keys.length - 1][3];
  const headChar = ts[start][2];
  if (quotes.some(q => q.start < toChar && q.end > headChar)) return;

  const chars = Array.from(text);
  const from = chars.slice(0, fromChar).join('').length;
  const to = chars.slice(0, toChar).join('').length;
  const namedScope = field(request, 'words');
  const scopes = namedScope ? literalRanges(text, namedScope) : [[0, text.length]];
  if (scopes.length !== 1 || chars.slice(0, headChar).join('').length < scopes[0][0] || to > scopes[0][1]) return;
  const scopeTokens = tokens(text.slice(...scopes[0])).map(token => token[0]);
  if (scopeTokens.some((token, i) => {
    for (let end = i + 1; end <= Math.min(i + 4, scopeTokens.length); end++) {
      const phrase = scopeTokens.slice(i, end).join(' ');
      if (worlds.negatives.has(phrase) || worlds.scopeGrammar.negatives.has(phrase) ||
          worlds.scopeGrammar.conditionals.has(phrase) ||
          [...worlds.scopeGrammar.endings].some(ending => scopeTokens.slice(i, end).join('').endsWith(ending))) return true;
    }
    return false;
  })) return;
  if (!catalogAllows(worlds,family,key,value)) return;

  const constraints = wires.filter(w => w.type === constraintType);
  if (constraints.some(w => field(w, 'attribute') === key) ||
      constraints.some(w => ['no', 'not_all'].includes(field(w, 'want')))) return;
  const owned = constraints.filter(w => field(w, 'request') === ref);
  const spatial=spatialPair(wires, owned, family, keys.join(' '), worlds);
  const phase=requestedPhase ?? (spatial.length ? field(spatial[0],'phase') ?? 'result'
    : field(target,'mode')==='new' || field(request,'act')==='place' ? 'result' : undefined);
  if (!phase) return;
  const drop = new Set(spatial);
  const overlap = (wire, fields) => fields.some(name => wire.attrs[name].some(item =>
    normalSpans(text, decode(item)).some(([a,b]) => a < to && b > from)));
  const observed = wires.filter(w => w.type === unreadType && field(w, 'request') === ref);
  if (!drop.size && !observed.some(w => overlap(w, ['text']))) return;
  for (const w of wires) {
    if (drop.has(w) || w.type === unreadType || w.id === request.id) continue;
    const evidence = Object.keys(w.attrs).filter(literalField);
    if (w.type === constraintType && w.attrs.value && !w.attrs.words) evidence.push('value');
    if (overlap(w, evidence)) return;
  }
  const ids = new Set(wires.map(w => w.id));
  const stem = target.id + '.phrase';
  let id = stem;
  for (let suffix = 2; ids.has(id); suffix++) id = stem + suffix;
  const kept = consumeUnread(wires.filter(w => !drop.has(w)), text, from, to);
  const support = {
    id, type:constraintType,
    attrs:{request:[ref], on:[on], attribute:[encode(key)], value:[encode(value)],
      words:[JSON.stringify(text.slice(from,to))], operator:[operator], phase:[phase]},
  };
  return {sop:serialize([...kept, support]), source:requestedPhase ? 'nominal-phrase' : 'nominal-position',
    status:kept.some(w => w.type === unreadType) ? 'partial' : 'matched'};
}

export function nativeNominalPhraseReadings(text, ts, quotes, candidate, index, worlds) {
  if (!index?.size || !candidate.sop) return [];
  let wires=parse(candidate.sop);
  const targets=wires.filter(w=>w.type===targetType), requests=wires.filter(w=>w.type===requestType);
  if (targets.length!==1 || requests.length!==1) return [];
  const [target]=targets, [request]=requests;
  const family=field(target,'family'), head=noun(target);
  const byLead=index.get(family), position=head && nounPosition(ts,head);
  if (!byLead || !position || field(target,'request')!=='$'+request.id) return [];
  const [start,after]=position;
  const mode=field(target,'mode'), ref='$'+request.id;
  const owned=()=>wires.filter(w=>w.type===constraintType && field(w,'request')===ref);
  const grounded=at=>uniqueParts(partsAt(owned(),ts,at,worlds,family,mode));
  const placement=at=>groundedPlacementEnd(owned(),ts,at,worlds,family);
  const options=at=>(byLead.get(ts[at]?.[0]) ?? []).filter(([words])=>matchesAt(ts,at,words));
  let revised;
  for (let at=after;at<ts.length;) {
    const entries=options(at), existing=grounded(at);
    const length=Math.max(0,...entries.map(([words])=>words.length));
    const best=entries.filter(([words])=>words.length===length);
    if (existing.length>1 || best.length>1) break;
    const [entry]=best, [covered]=existing;
    if (covered) {
      if (!covered.meaning || entry && (covered.words.join(' ')!==entry[0].join(' ') ||
        JSON.stringify(JSON.parse(covered.meaning).slice(0,4))!==JSON.stringify(entry.slice(1)))) break;
      at+=covered.words.length;
      continue;
    }
    if (!entry) break;
    const next=at+length;
    const following=options(next).length===1 || grounded(next).some(part=>part.meaning) || Boolean(placement(next));
    const attached=attachPhrase(text,ts,quotes,wires,request,target,start,at,entry,worlds,following);
    if (!attached?.sop) break;
    revised=attached;
    wires=parse(attached.sop);
    at=next;
  }
  return revised ? [revised] : [];
}
