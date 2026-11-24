import { parse, serialize } from '../.cache/knowledge/tools/sopworld/sopworld.mjs';
import { literalRanges } from './evidence.mjs';
import { tokens } from './lexicon.mjs';
import { quotedSpans } from './literal-roles.mjs';
import { consumeUnread } from './nominal-evidence.mjs';

const type=name=>'w.request.'+name;
const field=(wire,key)=>{
  const raw=wire?.attrs[key]?.[0];
  return raw?.startsWith('"') ? JSON.parse(raw) : raw;
};
const quote=JSON.stringify;
const word=/^[\p{L}\p{M}\p{N}_]+$/u;
const boundary=/^[,;.!?—–，。！？；]$/u;
const forms=text=>tokens(text).map(t=>t[0]).join(' ');

const triggers=new WeakMap();
function hasAnchorTail(text,worlds) {
  if (!triggers.has(worlds)) {
    const terms=Object.entries(worlds.determiners).filter(([,mode])=>mode==='definite')
      .map(([term])=>term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
    triggers.set(worlds,terms.length ? new RegExp('\\s(?:'+terms.join('|')+')\\s+\\p{L}','iu') : null);
  }
  return triggers.get(worlds)?.test(text) || /\s\p{Lu}[\p{L}\p{M}\d_]*(?=\s|[.,;!?]|$)/u.test(text);
}

function owned(text,scope) {
  const hits=literalRanges(text,scope);
  return hits.length===1 ? hits[0] : undefined;
}

function shape(scope,target,request,binding,relation,worlds,permit) {
  const chars=Array.from(scope), ts=tokens(scope), quotes=quotedSpans(scope);
  const phrase=(a,b)=>ts.slice(a,b).map(([key])=>key).join(' ');
  const span=(a,b)=>chars.slice(ts[a][2],ts[b-1][3]).join('');
  const quoted=(a,b)=>quotes.some(q=>q.start<ts[b-1][3] && q.end>ts[a][2]);
  const noun=field(target,'sort_words') ?? field(target,'family_words') ?? field(target,'sort');
  if (!noun) return;
  const head=forms(noun).split(' ');
  const heads=ts.flatMap((_,i)=>head.every((key,j)=>ts[i+j]?.[0]===key) ? [i] : []);
  if (heads.length!==1) return;
  const [at]=heads;
  const verb=field(request,'predicate'), act=field(request,'act');
  if (verb) {
    const predicate=owned(scope,verb);
    const headStart=chars.slice(0,ts[at][2]).join('').length;
    if (!predicate || predicate[1]>headStart || !worlds.lookup(forms(verb)).some(([role,sense,mood])=>
      role==='act' && (!mood || mood==='do') &&
      (sense===act || ['make','place'].includes(sense) && ['make','place'].includes(act)))) return;
  }
  const start=at+head.length;
  let end=start;
  while (end<ts.length && !boundary.test(ts[end][0])) end++;
  if (start>=end || quoted(at,end) ||
      !permit(span(0,end),quotedSpans(span(0,end)))) return;
  const relationBank=worlds.requestKeys.find(key=>key.family===binding.family && key.tab===binding.tab &&
    key.name===binding.relationKey && key.values.length)?.values;
  if (!relationBank) return;
  const choices=[];
  const markerForms=(a,b)=>worlds.lookup(phrase(a,b)).filter(
    ([role,license,slot,value])=>role==='marker' && relationBank.includes(value) &&
       (license==='*' && slot==='spatial' || license===act && slot==='place'));
  for (let markerAt=start;markerAt<Math.min(start+6,end-1);markerAt++) {
    for (let markerEnd=markerAt+1;markerEnd<Math.min(markerAt+6,end);markerEnd++) {
      const marker=span(markerAt,markerEnd);
      const values=new Set(markerForms(markerAt,markerEnd).map(entry=>entry[3]));
      if (relation) {
        const written=field(relation,'words') ?? field(relation,'value');
        if (forms(written)===forms(marker)) {
          const priorValue=field(relation,'value');
          if (values.has(priorValue)) {values.clear();values.add(priorValue);}
          else values.clear();
        } else values.clear();
      }
      if (values.size!==1) continue;
      const value=[...values][0];
      const det=worlds.determiners[ts[markerEnd][0]];
      const tail=ts.slice(markerEnd,end);
      if (tail.length>9 || !tail.every(([key])=>word.test(key))) continue;
      if (det==='definite') {
        // A landmark is a complete noun phrase at the end of this local span.
        // Require a typed terminal noun and keep every written modifier.
        let headAt=markerEnd+1;
        for (;headAt<end;headAt++) {
          const surface=phrase(headAt,end);
          const local=worlds.lookup(surface).flatMap(([role,,family])=>role==='target' ? [family] : []);
          const inventory=(worlds.ownerInventory?.get(JSON.stringify(['change',surface])) ?? [])
            .map(({family})=>family);
          if ([...local,...inventory].some(family=>worlds.familyTabs[family]?.includes(binding.tab))) break;
        }
        if (headAt>=end) continue;
        if (ts.slice(markerEnd+1,headAt).some(([key])=>worlds.joiners[key] || worlds.determiners[key] ||
            worlds.evidenceVocabulary.grammar.has(key) || worlds.scopeGrammar.auxiliary.has(key) ||
            worlds.lookup(key).some(([role])=>['act','marker','reference'].includes(role)))) continue;
      } else {
        // A proper name can select an existing landmark. Keep its spelling
        // as the lookup operand; instance resolution belongs to the next layer.
        if (markerAt!==start || tail.length>4 || !tail.every(([key,raw])=>
            /^\p{Lu}[\p{L}\p{M}\d_]*$/u.test(raw) &&
            !worlds.evidenceVocabulary.grammar.has(key) && !worlds.negatives.has(key) &&
            !worlds.joiners[key] && !worlds.isReference(key))) continue;
      }
      const region=(worlds.nominalPositions.get(binding.family)?.get(ts[markerAt][0]) ?? []).some(
        ([keys,,,,operator])=>operator==='region' && keys.join(' ')===phrase(markerAt,end));
      if (region) continue;
      let interrupted=false;
      for (let i=start;i<markerAt;i++) {
        if (worlds.joiners[ts[i][0]] || worlds.lookup(ts[i][0]).some(([role])=>role==='act') ||
            [1,2,3].some(n=>i+n<=markerAt && markerForms(i,i+n).length)) interrupted=true;
      }
      if (interrupted) continue;
      const from=chars.slice(0,ts[markerAt][2]).join('').length;
      const labelFrom=chars.slice(0,ts[markerEnd][2]).join('').length;
      const to=chars.slice(0,ts[end-1][3]).join('').length;
      choices.push({anchor:span(markerEnd,end),marker,value,from,to,labelFrom});
    }
  }
  return choices.length===1 ? choices[0] : undefined;
}

export function spatialAnchorReadings(text,candidate,worlds,permit) {
  if (!candidate.sop?.includes(' '+type('unread')+' ') ||
      !candidate.sop.includes(' '+type('target')+' ') || !hasAnchorTail(text,worlds)) return [];
  const wires=parse(candidate.sop), requests=wires.filter(w=>w.type===type('request'));
  const targets=wires.filter(w=>w.type===type('target'));
  const ids=new Set(wires.map(w=>w.id)), outputs=[];
  for (const request of requests) {
    if (request.attrs.polarity || ['ask','check'].includes(field(request,'mood'))) continue;
    const ref='$'+request.id;
    const members=targets.filter(w=>field(w,'request')===ref);
    if (members.length!==1) continue;
    const [target]=members, family=field(target,'family');
    const local=wires.filter(w=>field(w,'request')===ref);
    const scope=field(request,'words') ?? (requests.length===1 ? text : undefined);
    const range=scope && owned(text,scope);
    if (!range) continue;
    const unread=local.filter(w=>w.type===type('unread'))
      .map(w=>owned(text,field(w,'text'))).filter(Boolean);
    for (const binding of worlds.spatialBindings.filter(b=>b.family===family)) {
      if (!worlds.requestKeys.some(key=>key.family===family && key.tab===binding.tab &&
          key.name===binding.anchorKey && key.head==='fill+span' && !key.values.length)) continue;
      const relations=local.filter(w=>field(w,'attribute')===binding.relationKey);
      const anchors=local.filter(w=>field(w,'attribute')===binding.anchorKey);
      if (relations.length>1 || anchors.length>1 || anchors.length && !relations.length) continue;
      const [relation]=relations,[anchor]=anchors;
      if (relation && (field(relation,'on')!=='place' || field(relation,'operator')!=='relation' ||
          field(relation,'phase')!=='result' || relation.attrs.want) ||
          anchor && (field(anchor,'phase')!=='selector' || field(anchor,'operator')!=='relation' || anchor.attrs.want)) continue;
      const mode=field(target,'mode'), act=field(request,'act');
      if (!(mode==='new' && act==='make' ||
          mode==='existing' && (act==='place' || act==='change' && relation))) continue;
      const placement=shape(scope,target,request,binding,relation,worlds,permit);
      if (!placement) continue;
      const {from,to,marker,value,anchor:words}=placement;
      const start=range[0]+from, end=range[0]+to;
      if (!unread.some(([a,b])=>a<end && b>start)) continue;
      if (local.some(w=>w.type===type('constraint') && w!==anchor && w!==relation &&
          ['words','key_words',...(w.attrs.words ? [] : ['value'])].some(key=>{
            const evidence=field(w,key), at=evidence && owned(scope,evidence);
            return at && at[0]<to && at[1]>placement.labelFrom;
          }))) continue;
      if (anchor && !forms(words).startsWith(forms(field(anchor,'value'))+' ')) continue;
      const used=new Set(ids);
      function id(suffix) {
        const base=request.id+suffix;
        let next=base;
        for (let i=2;used.has(next);i++) next=base+i;
        used.add(next);
        return next;
      }
      const anchorId=anchor?.id ?? id('.landmark');
      const existingLookups=wires.filter(w=>w.type===type('lookup') && field(w,'constraint')==='$'+anchorId);
      if (existingLookups.some(w=>field(w,'request')!==ref || field(w,'key')!=='thing')) continue;
      if (anchor && (Object.keys(anchor.attrs).some(key=>
          !['request','on','attribute','value','operator','phase'].includes(key)) ||
        wires.some(w=>!existingLookups.includes(w) && Object.values(w.attrs).flat().includes('$'+anchorId)))) continue;
      const nextAnchor={id:anchorId,type:type('constraint'),attrs:{request:[ref],on:['place'],
        attribute:[binding.anchorKey],value:[quote(words)],operator:['relation'],phase:['selector']}};
      const related=wires.map(w=>w===anchor ? nextAnchor : w);
      if (!relation) related.push({id:id('.relation'),type:type('constraint'),attrs:{request:[ref],on:['place'],
        attribute:[binding.relationKey],value:[value],words:[quote(marker)],operator:['relation'],phase:['result']}});
      if (!anchor) related.push(nextAnchor);
      if (!existingLookups.length) related.push({id:id('.landmarkLookup'),type:type('lookup'),attrs:{
        request:[ref],constraint:['$'+anchorId],key:['thing'],from:['page']}});
      const kept=consumeUnread(related,text,start,end);
      outputs.push({sop:serialize(kept),source:'spatial-anchor',
        status:kept.some(w=>w.type===type('unread')) ? 'partial' : 'matched'});
    }
  }
  return outputs;
}
