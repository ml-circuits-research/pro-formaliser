import { parse, serialize, str } from '../.cache/knowledge/tools/sopworld/sopworld.mjs';
import { literalRanges, sortRanges } from './evidence.mjs';
import { tokens } from './lexicon.mjs';
import { quotedSpans } from './literal-roles.mjs';
import { nativeInventory } from './native-inventory.mjs';
import { requestScope } from './request-scope.mjs';

const ns='w.request.';
const form=text=>tokens(text ?? '').map(([term])=>term).join(' ');
const value=(wire,key)=>str(wire?.attrs[key]?.[0]);
const values=(wire,key)=>(wire.attrs[key] ?? []).map(str);
const word=/^[\p{L}\p{M}\p{N}_]+$/u;
const definite=new Set(['definite','demonstrative']);
const tokenText=ts=>ts.map(([term])=>term).join(' ');
const identity=(...parts)=>JSON.stringify(parts);

export function compileAppositiveSelectors(facts,requestKeys,words=facts('core.word')) {
  const proforms=new Set(facts('w.lang.en.phrase').filter(wire=>value(wire,'name')==='elide.noun')
    .flatMap(wire=>values(wire,'item').map(form)).filter(Boolean));
  const bindings=facts('pro.reader.appositive_selector').flatMap(wire=>{
    const [tab,family,attribute,itemType,itemField]=
      ['tab','family','attribute','item_type','item_field'].map(key=>value(wire,key));
    const markers=values(wire,'text').map(form).filter(Boolean);
    const classes=new Set(values(wire,'item_value'));
    if (!markers.length || !itemType || Boolean(itemField)!==Boolean(classes.size) ||
        !requestKeys.some(row=>row.tab===tab && row.family===family && row.name===attribute &&
          !row.values.length && row.head.split('+').some(head=>['span','candidate'].includes(head)))) return [];
    const items=nativeInventory(type=>type===itemType && itemField
      ? facts(type).filter(item=>values(item,itemField).some(label=>classes.has(label))) : facts(type),itemType,words);
    return items.size ? [{family,attribute,markers,items}] : [];
  });
  return {bindings,proforms};
}

function positive(text,ts,worlds,permit) {
  if (!permit(text,[]) || ts.some(([key])=>worlds.scopeGrammar.endings.has(key))) return false;
  return !ts.some((_,i)=>Array.from({length:Math.min(5,ts.length-i)},(_unused,j)=>tokenText(ts.slice(i,i+j+1)))
    .some(key=>worlds.negatives.has(key) || worlds.scopeGrammar.negatives.has(key) ||
      worlds.scopeGrammar.conditionals.has(key) || worlds.scopeGrammar.predicateNegators.has(key)));
}

function exact(text,literal,start=0,end=text.length) {
  const matches=literalRanges(text,literal,start,end);
  return matches.length===1 ? matches[0] : undefined;
}

function targetHead(text,target) {
  const explicit=value(target,'sort_words') ?? value(target,'family_words');
  if (explicit) return exact(text,explicit);
  const ranges=sortRanges(text,value(target,'sort'));
  return ranges.length===1 ? ranges[0] : undefined;
}

function observeRole(text,sop,predicate,family,worlds,bank) {
  if (!text || text.length>240 || !/\s/u.test(text) || text.includes('?') || quotedSpans(text).length) return;
  const wires=parse(sop), requests=wires.filter(wire=>wire.type===ns+'request');
  if (requests.length!==1 || wires.some(wire=>[ns+'context',ns+'previous',ns+'clock'].includes(wire.type))) return;
  const [request]=requests,owner='$'+request.id, act=value(request,'act'),written=value(request,'predicate');
  if (form(written)!==predicate || value(request,'mood')!=='do' || !worlds.literalGrammar.licenses(family,act)) return;
  const target=wires.filter(wire=>wire.type===ns+'target' && value(wire,'request')===owner);
  if (target.length!==1 || value(target[0],'mode')!=='existing' || value(target[0],'family')!==family) return;
  const head=targetHead(text,target[0]), pivot=exact(text,written);
  if (!head || !pivot || head[1]>pivot[0] || !tokens(text.slice(0,head[0])).some(([term])=>
    definite.has(worlds.determiners[term])) || requestScope(text,text,worlds,[]).restricted) return;
  const witnessed=[];
  for (const wire of wires) {
    if (wire.type!==ns+'constraint' || value(wire,'request')!==owner || value(wire,'on')!=='attribute' ||
        value(wire,'phase')!=='result' || value(wire,'operator')!=='eq' || wire.attrs.want ||
        wire.attrs.open_value || wire.attrs.value?.length!==1) continue;
    const attribute=value(wire,'attribute'), effect=value(wire,'value'), operand=exact(text,value(wire,'words') ?? effect);
    if (!bank.get(identity(family,attribute))?.has(effect) || !operand || operand[0]<pivot[1] ||
        text.slice(pivot[1],operand[0]).trim() || /^[\p{L}\p{N}]/u.test(text.slice(operand[1]).trim())) continue;
    witnessed.push({role:identity(act,attribute),effect,sort:form(text.slice(...head))});
  }
  if (witnessed.length===1) return witnessed[0];
}

function predicateRoles(model,worlds) {
  const bank=new Map(worlds.requestKeys.filter(key=>key.values.length).map(key=>
    [identity(key.family,key.name),new Set(key.values)]));
  const cache=new Map();
  return (predicate,family)=>{
    const id=identity(predicate,family);
    if (cache.has(id)) return cache.get(id);
    const declared=(worlds.topicCommands ?? []).filter(row=>row.family===family && form(row.predicate)===predicate);
    const roles=new Set(declared.map(row=>identity(row.act,row.attribute)));
    if (!roles.size) {
      const found=new Map();
      const escaped=predicate.replace(/[.*+?^${}()|[\]\\]/gu,'\\$&');
      const gate=new RegExp('\\bpredicate=(?:"'+escaped+'"|'+escaped+'(?=\\s|$))','iu');
      for (const {text,sop} of model.examples ?? []) {
        // The cheap token gate avoids reparsing unrelated annotations.
        if (!gate.test(sop ?? '')) continue;
        try {
          const vote=observeRole(text,sop,predicate,family,worlds,bank);
          if (!vote) continue;
          const utterance=form(text), votes=found.get(utterance) ?? new Map();
          votes.set(vote.role,vote);
          found.set(utterance,votes);
        } catch (error) {
          if (error.name!=='SopError') throw error;
        }
      }
      const totals=new Map();
      for (const votes of found.values()) {
        if (votes.size!==1) continue;
        const [{role,effect,sort}]=votes.values();
        const seen=totals.get(role) ?? {count:0,values:new Set(),sorts:new Set()};
        seen.count++;
        seen.values.add(effect);
        seen.sorts.add(sort);
        totals.set(role,seen);
      }
      for (const [role,seen] of totals) if (seen.count>=6 && seen.count/found.size>=.95 &&
          seen.values.size>=2 && seen.sorts.size>=2) roles.add(role);
    }
    const resolved=roles.size===1 ? roles.values().next().value : undefined;
    cache.set(id,resolved);
    return resolved;
  };
}

function typedItem(binding,input,worlds) {
  const valid=input.every(([term])=>word.test(term) && !worlds.joiners[term]);
  if (!valid || input.length<2 || !definite.has(worlds.determiners[input[0][0]])) return false;
  for (let i=1;i<input.length;i++) {
    if (binding.items.get(tokenText(input.slice(i)))?.size!==1) continue;
    const modifiers=input.slice(1,i);
    if (modifiers.every(([term])=>!worlds.evidenceVocabulary.grammar.has(term) &&
      !worlds.lookup(term).some(([role])=>['act','marker','reference'].includes(role)))) return true;
  }
  return false;
}

function finiteResult(wire,family,operand,worlds) {
  if (value(wire,'on')!=='attribute' || value(wire,'operator')!=='eq' || wire.attrs.open_value || wire.attrs.want ||
      wire.attrs.value?.length!==1 || form(value(wire,'words') ?? value(wire,'value'))!==form(operand)) return false;
  const attribute=value(wire,'attribute'), canonical=value(wire,'value'), surface=form(operand);
  const key=worlds.requestKeys.find(key=>key.family===family && key.name===attribute && key.values.includes(canonical));
  if (!key) return false;
  const readings=new Set(key.values.filter(item=>form(item.replaceAll('_',' '))===surface));
  for (const [body] of worlds.ownerPropertyValues?.get(identity(family,surface)) ?? []) {
    const [fact]=parse('@value '+ns+'constraint '+body);
    const choice=value(fact,'value');
    if (value(fact,'attribute')===attribute && !fact.attrs.open_value && key.values.includes(choice)) readings.add(choice);
  }
  return readings.size===1 && readings.has(canonical);
}

export function createAppositiveSelectorReader(model,worlds) {
  const bindings=worlds.appositiveSelectors?.bindings ?? [];
  const resolveRole=predicateRoles(model,worlds);
  return (text,candidate,permit)=>{
    if (!bindings.length || text.length>240 || !text.includes(',') || !candidate.sop?.includes(' phase=result')) return;
    const ts=tokens(text), parts=ts.flatMap(([term],i)=>term===',' ? [i] : []);
    if (parts.length!==2) return;
    const [a,b]=parts, chars=Array.from(text);
    const span=(start,end)=>chars.slice(ts[start][2],ts[end-1][3]).join('');
    const subject=ts.slice(0,a), appositive=ts.slice(a+1,b), suffix=ts.slice(b+1);
    if (['.','!'].includes(suffix.at(-1)?.[0])) suffix.pop();
    if (!subject.length || !suffix.length || appositive.length<5 ||
        !definite.has(worlds.determiners[subject[0][0]]) ||
        worlds.determiners[appositive[0][0]]!=='definite' ||
        !worlds.appositiveSelectors.proforms.has(appositive[1][0]) ||
        [...subject,...appositive,...suffix].some(([term])=>!word.test(term)) ||
        quotedSpans(text).length || !positive(text,ts,worlds,permit)) return;
    const wires=parse(candidate.sop), requests=wires.filter(wire=>wire.type===ns+'request');
    if (requests.length!==1) return;
    const [request]=requests, owner='$'+request.id;
    const act=value(request,'act'),predicate=value(request,'predicate');
    if (value(request,'mood')!=='do' || !predicate) return;
    const local=wires.filter(wire=>value(wire,'request')===owner);
    const targets=local.filter(wire=>wire.type===ns+'target');
    if (targets.length!==1 || value(targets[0],'mode')!=='existing' || targets[0].attrs.name) return;
    const [target]=targets, family=value(target,'family');
    const writtenSubject=span(0,a), description=span(0,b);
    if (!targetHead(writtenSubject,target) || !worlds.literalGrammar.licenses(family,act)) return;
    if (target.attrs.description && ![writtenSubject,description].includes(value(target,'description'))) return;
    const later=span(b+1,b+1+suffix.length), pred=exact(later,predicate);
    if (!pred || pred[0]!==0 || !/^\s/u.test(later.slice(pred[1]))) return;
    const operand=later.slice(pred[1]).trim();
    const scoped=value(request,'words');
    if (scoped) {
      const range=exact(text,scoped);
      if (!range || range[0]>0 || range[1]<text.indexOf(later)+later.length) return;
    }
    const effects=local.filter(wire=>wire.type===ns+'constraint' && value(wire,'phase')==='result');
    if (effects.length!==2) return;
    const outcome=effects.find(wire=>finiteResult(wire,family,operand,worlds));
    if (!outcome) return;
    const selector=effects.find(wire=>wire!==outcome);
    const possible=bindings.filter(binding=>binding.family===family && binding.attribute===value(selector,'attribute'));
    if (!possible.length || value(selector,'on')!=='attribute' || value(selector,'operator')!=='eq' ||
        selector.attrs.want || selector.attrs.value?.length!==1 || selector.attrs.thing) return;
    const matches=possible.flatMap(binding=>binding.markers.flatMap(marker=>{
      const count=marker.split(' ').length+2;
      const item=appositive.slice(count);
      if (tokenText(appositive.slice(2,count))!==marker || !typedItem(binding,item,worlds)) return [];
      const written=span(a+1+count,b);
      return written===value(selector,'value') && (!selector.attrs.words || written===value(selector,'words')) ? [written] : [];
    }));
    if (new Set(matches).size!==1 || resolveRole(form(predicate),family)!==identity(act,value(outcome,'attribute'))) return;
    target.attrs.description=[JSON.stringify(description)];
    selector.attrs.phase=['selector'];
    return {...candidate,sop:serialize(wires),source:'appositive-selector'};
  };
}
