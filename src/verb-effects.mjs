import {parse,serialize} from '../.cache/knowledge/tools/sopworld/sopworld.mjs';
import {literalRanges} from './evidence.mjs';
import {tokens} from './lexicon.mjs';
import {observeMeaning,supportedMeaning} from './training-evidence.mjs';

const decode=v=>v?.startsWith('"') ? JSON.parse(v) : v;
const field=(w,k)=>decode(w?.attrs[k]?.[0]);
const all=(w,k)=>(w.attrs[k] ?? []).map(decode);
const lower=text=>tokens(text).map(t=>t[0]).join(' ');
const atom=v=>/^[\p{L}_][\p{L}\p{M}\p{N}_.-]*$/u.test(v) ? v : JSON.stringify(v);

function catalog(keys,family,key) {
  return keys.filter(k=>k.family===family && k.name===key);
}

// A predicate itself can entail a property value ("dash the arrow").
// Count different object phrases; changes of politeness alone give one vote.
export function verbEffectLearner(worlds) {
  const evidence=new Map();
  return {
    observe(scope,req,target,owned) {
      const predicate=field(req,'predicate'),family=field(target,'family'),act=field(req,'act');
      if (!predicate || !family || act!=='change' || field(target,'mode')!=='existing' ||
          ![undefined,'do'].includes(field(req,'mood')) || req.attrs.mode || req.attrs.polarity) return;
      const pos=literalRanges(scope,predicate);
      if (pos.length!==1) return;
      const after=scope.slice(pos[0][1]).trim().replace(/[.!?]+$/u,'').trimEnd();
      if (!after || !/[\p{L}\p{N}]/u.test(after)) return;
      const key=JSON.stringify([lower(predicate),act,family]);
      const readings=owned.flatMap(c=>{
        const attribute=field(c,'attribute'),v=field(c,'value'),words=field(c,'words') ?? v;
        if (!words || lower(words)!==lower(predicate) || !v || c.attrs.value?.length!==1 ||
           field(c,'operator')!=='eq' || field(c,'phase')!=='result' || field(c,'on')!=='attribute' ||
           c.attrs.want || c.attrs.open_value || !catalog(worlds.requestKeys,family,attribute).some(k=>k.values.includes(v))) return [];
        return [JSON.stringify([attribute,v])];
      });
      // Track absences too; a general command such as "set" cannot acquire a
      // specific value through one batch of otherwise identical instructions.
      const seen=evidence.get(key) ?? new Map();
      observeMeaning(seen,after,readings.length===1 ? readings[0] : false);
      evidence.set(key,seen);
    },
    finish() {
      const entries=[];
      for (const [key,seen] of evidence) {
        const meaning=supportedMeaning(seen);
        if (meaning) entries.push([...JSON.parse(key),...JSON.parse(meaning)]);
      }
      return entries;
    }
  };
}

export function nativeVerbEffects(facts,keys,labels) {
  const entries=[];
  const comparisons=new Map(facts('k.values.comparative').filter(w=>field(w,'degree')==='comparative')
    .map(w=>[JSON.stringify([field(w,'scale'),field(w,'text')]),field(w,'way')]));
  const families=new Set(keys.map(k=>k.family));
  for (const verb of facts('k.actions.verb')) {
    const concept=field(verb,'attribute'),v=field(verb,'value'),act=field(verb,'act');
    if (!concept || !v || field(verb,'object')!=='thing' || verb.attrs.complement) continue;
    for (const family of families) {
      const names=new Set((labels.get(JSON.stringify([lower(concept),family])) ?? []).map(r=>r.attribute));
      if (names.size!==1) continue;
      const [key]=names,props=catalog(keys,family,key),way=comparisons.get(JSON.stringify([concept,v]));
      for (const form of all(verb,'text')) {
        if (props.every(p=>p.values.includes(v))) entries.push([lower(form),act,family,key,'eq',v]);
        else if (['up','down'].includes(way) && props.every(p=>p.head.split('+').some(h=>h==='number' || h==='step'))) {
          entries.push([lower(form),act,family,key,'delta',way==='up' ? 'more' : 'less']);
        }
      }
    }
  }
  return entries;
}

export function verbEffectIndex(worlds,learned) {
  const index=new Map();
  for (const row of [...(worlds.nativeVerbEffects ?? []),...(learned ?? []).flatMap(([p,a,f,k,v])=>
    catalog(worlds.requestKeys,f,k).some(key=>key.values.includes(v)) ? [[p,a,f,k,'eq',v]] : [])]) {
    const [p]=row,head=p.split(' ')[0],entries=index.get(head) ?? [];
    entries.push(row);index.set(head,entries);
  }
  return index;
}

export function verbEffectReading(text,candidate,proof) {
  const wires=parse(candidate.sop),rs=wires.filter(w=>w.type==='w.request.request'),ts=wires.filter(w=>w.type==='w.request.target');
  if (rs.length!==1 || ts.length!==1) return;
  const [req]=rs,[t]=ts,ref='$'+req.id;
  const predicate=field(req,'predicate');
  if (predicate!==proof.words || field(req,'act')!==proof.act || ![undefined,'do'].includes(field(req,'mood')) ||
      field(t,'request')!==ref || field(t,'family')!==proof.family || field(t,'mode')!=='existing') return;
  const hits=literalRanges(text,predicate);if (hits.length!==1) return;
  // A concrete target must follow this predicate. The request may still have
  // other unresolved words, which stay in its original unread wires.
  const after=hits[0][1];
  if (!['ids','name','sort_words','family_words','sort','description'].some(k=>
      all(t,k).some(s=>literalRanges(text,s,after,text.length).length===1))) return;
  if (wires.some(w=>w.type==='w.request.constraint' && (w.attrs.want ||
      field(w,'phase')!=='selector' && field(w,'attribute')===proof.key))) return;
  let id=t.id+'.effect';
  while (wires.some(w=>w.id===id)) id+='_';
  const attrs={request:[ref],on:['attribute'],attribute:[atom(proof.key)],operator:[proof.op],phase:['result'],words:[JSON.stringify(predicate)]};
  attrs[proof.op==='delta' ? 'step' : 'value']=[atom(proof.value)];
  return {...candidate,sop:serialize([...wires,{id,type:'w.request.constraint',attrs}]),source:'verb-effect'};
}
