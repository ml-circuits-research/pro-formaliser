import { literalField, literalRanges, sortRanges } from './evidence.mjs';
import { tokens } from './lexicon.mjs';
import { maskQuoted, quotedSpans } from './literal-roles.mjs';
import { parse } from './schema.mjs';
import { serialize } from '../.cache/knowledge/tools/sopworld/sopworld.mjs';

const request = 'w.request.request', target = 'w.request.target', constraint = 'w.request.constraint';
const filler = 'w.request.filler', lookup = 'w.request.lookup';
const allowed = new Set([request,target,constraint,filler,lookup]);
const verbFields = ['act','object','complement','attribute','value','after_particle'];
const decode = v => v?.startsWith('"') ? JSON.parse(v) : v;
const all = (w,k) => (w.attrs[k] ?? []).map(decode);
const one = (w,k) => decode(w.attrs[k]?.[0]);
const key = text => tokens(text).map(t=>t[0]).join(' ');
const punctuation = new Set(['.', '!', '?', '。', '！', '？']);
const separator = new Set([',', ':', '.', '!', '—', '–']);
const question = new Set(['?', '？']);

function index(map, k, value) {
  const items = map.get(k) ?? [];
  items.push(value);
  map.set(k,items);
}

function senseIndex({verbs,frames,parts,fixed}) {
  const verbForms = new Map(), aliases = new Map(), byFrame = new Map();
  for (const verb of verbs) {
    if (one(verb,'separable')==='true') continue;
    const fields = Object.fromEntries(verbFields.map(field=>[field,one(verb,field)]));
    for (const text of all(verb,'text')) index(verbForms,key(text),{...fields,gloss:one(verb,'gloss')});
  }
  for (const part of parts) index(byFrame,one(part,'frame'),part);
  const defaults = new Set(fixed.map(wire=>one(wire,'frame')));
  for (const frame of frames) {
    const name=one(frame,'name'), act=one(frame,'act'), mode=one(frame,'mode');
    if (!act || defaults.has(name) || frame.attrs.needs || frame.attrs.polarity ||
        ![undefined,'do'].includes(one(frame,'mood'))) continue;
    const ordered=(byFrame.get(name) ?? []).slice().sort((a,b)=>Number(one(a,'at'))-Number(one(b,'at')));
    while (one(ordered[0] ?? {attrs:{}},'is')==='lead' && one(ordered[0],'optional')==='yes') ordered.shift();
    const head=ordered.shift();
    if (!head || one(head,'is')!=='word' || one(head,'optional')==='yes') continue;
    const forms=all(head,'word').map(key);
    const tail=[];
    for (const part of ordered) {
      const kind=one(part,'is'), optional=one(part,'optional')==='yes';
      if (kind==='det') tail.push({kind,optional});
      else if (kind==='word' && part.attrs.word?.length) tail.push({kind,optional,phrases:all(part,'word').map(key)});
      else if (kind==='role' && one(part,'role')==='thing' && ['words','rest'].includes(one(part,'takes')) && !optional) tail.push({kind});
      else break;
    }
    if (tail.length!==ordered.length || forms.length<2 || tail.filter(part=>part.kind==='role').length!==1) continue;
    const sense={act,mode,forms:new Set(forms),tail};
    for (const form of forms) index(aliases,form,sense);
  }
  return {verbForms,aliases,forms:new Set([...verbForms.keys(),...aliases.keys()])};
}

function sameFrameTail(parts, words, determiners, targets) {
  function match(part, at) {
    if (part===parts.length) return at===words.length;
    const {kind,optional,phrases}=parts[part];
    if (optional && match(part+1,at)) return true;
    if (kind==='det') {
      for (let end=at+1;end<=Math.min(at+5,words.length);end++) {
        if (Object.hasOwn(determiners,words.slice(at,end).join(' ')) && match(part+1,end)) return true;
      }
    } else if (kind==='word') {
      for (const phrase of phrases) {
        const forms=phrase.split(' ');
        if (forms.every((form,i)=>words[at+i]===form) && match(part+1,at+forms.length)) return true;
      }
    } else {
      for (let end=at+1;end<=words.length;end++) {
        const span=words.slice(at,end).join(' ');
        if (targets.some(value=>literalRanges(span,value).length) && match(part+1,end)) return true;
      }
    }
    return false;
  }
  return match(0,0);
}

function envelope(text,words,worlds,politeness) {
  const ts=tokens(text), chars=Array.from(text), quotes=quotedSpans(text);
  const visible=ts.map(([form,,start,end])=>quotes.some(q=>start<q.end&&end>q.start) ? '' : form);
  const span=(a,b)=>chars.slice(ts[a][2],ts[b-1][3]).join('');
  const normalized=(a,b)=>visible.slice(a,b).join(' ');
  const extras=[];
  let stop=ts.length;
  let interrogative=false;
  while (punctuation.has(visible[stop-1])) {
    interrogative ||= question.has(visible[stop-1]);
    stop--;
  }
  for (;;) {
    const cue=politeness.find(phrase=>phrase.length<stop && separator.has(visible[stop-phrase.length-1]) &&
      normalized(stop-phrase.length,stop)===phrase.join(' '));
    if (!cue) break;
    extras.unshift(span(stop-cue.length,stop));
    stop-=cue.length;
    while (separator.has(visible[stop-1])) stop--;
  }
  if (visible.slice(0,stop).some(form=>worlds.negatives.has(form) ||
      ['condition','contrast','sequence','clause'].includes(worlds.joiners[form]) || question.has(form)) ||
      /n['’]t\b/iu.test(maskQuoted(text,quotes))) return [];
  const options=[];
  for (let start=0;start<Math.min(stop-1,14);start++) {
    const lead=visible.slice(0,start).filter(form=>!separator.has(form)).join(' ');
    const imperative=worlds.literalGrammar.leads.has(lead);
    if (lead && !imperative && !politeness.some(phrase=>phrase.join(' ')===lead)) continue;
    if (interrogative && !imperative) continue;
    for (let end=start+1;end<Math.min(stop,start+9);end++) {
      const form=normalized(start,end);
      if (!words.has(form)) continue;
      // A recognized command before this span is part of the argument
      // structure and cannot be discarded as a courtesy lead.
      if (start && visible.slice(0,start).some((_,i)=>visible.slice(0,start-i).some((__,j)=>words.has(normalized(i,i+j+1))))) continue;
      const predicate=span(start,end), tail=span(end,stop);
      options.push({form,predicate,tail,words:span(start,stop),extras:start?[span(0,start).replace(/[,\s]+$/u,''),...extras]:extras});
    }
  }
  return options;
}

function sourcePacket(example, senses, worlds, politeness) {
  if (!example.sop.includes(' predicate=') || example.sop.includes(' w.request.unread ')) return;
  const variants=envelope(example.text,senses.forms,worlds,politeness);
  if (!variants.length) return;
  let wires;
  try { wires=parse(example.sop); } catch (error) {
    if (error.name!=='SopError') throw error;
    return;
  }
  const requests=wires.filter(w=>w.type===request), targets=wires.filter(w=>w.type===target);
  if (requests.length!==1 || targets.length!==1 || wires.some(w=>!allowed.has(w.type) ||
      w.type===lookup && one(w,'from')!=='page')) return;
  const [root]=requests, [thing]=targets;
  const act=one(root,'act'), mode=one(root,'mode'), predicate=one(root,'predicate');
  if (!predicate || ![undefined,'do'].includes(one(root,'mood')) ||
      ['last','world'].includes(one(root,'refers')) || root.attrs.revises ||
      (root.attrs.status && one(root,'status')!=='open') || one(thing,'mode')==='bound') return;
  const variant=variants.find(v=>v.predicate===predicate);
  if (!variant || root.attrs.words && !one(root,'words').includes(variant.words)) return;
  const {form,tail}=variant;
  const written=['name','description','ids','sort_words','family_words'].flatMap(k=>all(thing,k));
  const sort=one(thing,'sort');
  if (sort && sortRanges(tail,sort).length) written.push(sort);
  const literals=written.filter(value=>literalRanges(tail,value).length);
  if (!literals.length) return;
  const effects=wires.filter(w=>w.type===constraint && (one(w,'phase') ?? 'result')==='result');
  if (wires.some(w=>w.type===constraint && (w.attrs.honoured || ![undefined,'yes'].includes(one(w,'want'))))) return;
  const fieldGrounded=wires.every(w=>w.type===filler || Object.entries(w.attrs).every(([k,items])=>
      w===root && ['words','predicate'].includes(k) ||
      !(literalField(k) || w.type===constraint && k==='value' && (!w.attrs.words || items.some(v=>v.startsWith('"')))) ||
      items.every(v=>literalRanges(tail,decode(v)).length)));
  if (!fieldGrounded) return;
  return {example,form,tail,act,mode,literals,root:root.id,targetMode:one(thing,'mode'),
    role:effects.some(w=>one(w,'on')==='place' && one(w,'operator')==='relation')?'place':
      effects.length===0?'selection':undefined};
}

function senseMatches(source, form, senses, worlds) {
  if ((senses.aliases.get(source.form) ?? []).some(spec=>spec.act===source.act && spec.mode===source.mode &&
      spec.forms.has(form) && sameFrameTail(spec.tail,tokens(source.tail).map(t=>t[0]),worlds.determiners,source.literals.map(key)))) return true;
  if (source.mode) return false;
  const originals=(senses.verbForms.get(source.form) ?? []).filter(v=>v.act===source.act);
  const alternatives=(senses.verbForms.get(form) ?? []).filter(v=>v.act===source.act);
  return originals.some(old=>alternatives.some(incoming=>{
    if (!old.object || !verbFields.every(field=>old[field]===incoming[field])) return false;
    if (old.gloss && old.gloss===incoming.gloss || old.attribute && old.value) return true;
    if (old.object!=='thing' || old.complement || old.attribute || old.value || source.targetMode!=='existing') return false;
    return source.act==='place' && source.role==='place' || source.act==='remove' && source.role==='selection';
  }));
}

export function createPredicateTransfer(examples, worlds) {
  if (!worlds.predicateTransferFacts) return ()=>[];
  const senses=senseIndex(worlds.predicateTransferFacts);
  const politeness=worlds.discourse.filter(({class:kind})=>['politeness','interjection'].includes(kind))
    .map(({text})=>key(text).split(' ')).sort((a,b)=>b.length-a.length);
  const byTail=new Map();
  for (const example of examples) {
    const source=sourcePacket(example,senses,worlds,politeness);
    if (source) index(byTail,source.tail,source);
  }
  return text=>{
    const readings=[];
    for (const variant of envelope(text,senses.forms,worlds,politeness)) {
      for (const source of byTail.get(variant.tail) ?? []) {
        if (source.form===variant.form || !senseMatches(source,variant.form,senses,worlds)) continue;
        const wires=parse(source.example.sop).filter(w=>w.type!==filler ||
          all(w,'text').every(value=>literalRanges(variant.tail,value).length));
        const root=wires.find(w=>w.id===source.root);
        root.attrs.predicate=[JSON.stringify(variant.predicate)];
        if (root.attrs.words || variant.extras.length) root.attrs.words=[JSON.stringify(variant.words)];
        const ids=new Set(wires.map(w=>w.id));
        let n=0;
        for (const extra of variant.extras) {
          let id;
          do { id='predicate.f'+(++n); } while (ids.has(id));
          wires.push({id,type:filler,attrs:{text:[JSON.stringify(extra)]}});
        }
        readings.push({sop:serialize(wires).trimEnd(),source:'predicate-transfer',support:source.example.count ?? 1});
      }
    }
    return readings;
  };
}
