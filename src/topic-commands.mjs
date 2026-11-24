import { parse, str } from '../.cache/knowledge/tools/sopworld/sopworld.mjs';
import { tokens } from './lexicon.mjs';

const ns='w.request.';
const value=(wire,key)=>str(wire?.attrs[key]?.[0]);
const form=text=>tokens(text ?? '').map(([key])=>key).join(' ');
const quote=JSON.stringify;
const word=/^[\p{L}\p{M}\p{N}_]+$/u;
const terminal=new Set(['.','!']);
const modes=new Set(['definite','demonstrative']);
const atom=/^[\p{L}_][\p{L}\p{M}\p{N}_.-]*$/u;

function shape(ts) {
  const colon=ts.findIndex(([key])=>key===':');
  let end=ts.length;
  if (terminal.has(ts.at(-1)?.[0])) end--;
  if (colon<2 || colon>12 || end-colon<3 || end-colon>13) return;
  if (ts.slice(0,end).some(([key],i)=>i!==colon && !word.test(key) &&
    !(key==='-' && ts[i-1]?.[3]===ts[i][2] && ts[i+1]?.[2]===ts[i][3]))) return;
  return {colon,end};
}

function locallyPositive(ts,worlds) {
  const grammar=worlds.scopeGrammar;
  for (let i=0;i<ts.length;i++) {
    for (let j=i+1;j<=Math.min(i+4,ts.length);j++) {
      const marker=ts.slice(i,j).map(([key])=>key).join(' ');
      if (worlds.negatives.has(marker) || grammar.negatives.has(marker) ||
          grammar.conditionals.has(marker) || grammar.predicateNegators.has(marker)) return false;
    }
  }
  return true;
}

function catalog(worlds) {
  const keys=new Map();
  for (const row of worlds.requestKeys) {
    if (!row.values.length) continue;
    const id=JSON.stringify([row.family,row.name]), values=keys.get(id) ?? new Set();
    for (const choice of row.values) values.add(choice);
    keys.set(id,values);
  }
  return keys;
}

function finiteReadings(worlds,bank,family,key,surface) {
  const allowed=bank.get(JSON.stringify([family,key]));
  if (!allowed) return [];
  const values=new Set([...allowed].filter(v=>form(v.replaceAll('_',' '))===surface || form(v)===surface));
  for (const [body] of worlds.ownerPropertyValues?.get(JSON.stringify([family,surface])) ?? []) {
    const [wire]=parse('@value w.request.constraint '+body);
    const choice=value(wire,'value');
    if (value(wire,'attribute')===key && allowed.has(choice) && !wire.attrs.want && !wire.attrs.open_value) values.add(choice);
  }
  return [...values];
}

export function topicCommandLearner(worlds) {
  const groups=new Map(), bank=catalog(worlds);
  return {
    observe(text,input) {
      if (text.length>240 || !text.includes(':') || text.includes('?')) return;
      const ts=tokens(text), delimited=shape(ts);
      if (!delimited || !locallyPositive(ts,worlds)) return;
      const {colon,end}=delimited;
      const term=(a,b)=>ts.slice(a,b).map(([key])=>key).join(' ');
      let wires=input;
      if (typeof input==='string') {
        try { wires=parse(input); }
        catch (error) {
          if (error.name!=='SopError') throw error;
          return;
        }
      }
      const requests=wires.filter(w=>w.type===ns+'request');
      if (requests.length!==1 || wires.some(w=>[ns+'previous',ns+'context',ns+'clock',ns+'unread'].includes(w.type))) return;
      const [request]=requests,ref='$'+request.id,act=value(request,'act'),predicate=form(value(request,'predicate'));
      const after=colon+1+predicate.split(' ').length;
      if (!predicate || value(request,'mood')!=='do' || after>=end ||
          term(colon+1,after)!==predicate || !modes.has(worlds.determiners[ts[0][0]])) return;
      const local=wires.filter(w=>value(w,'request')===ref);
      const targets=local.filter(w=>w.type===ns+'target');
      const effects=local.filter(w=>w.type===ns+'constraint' && (value(w,'phase') ?? 'result')==='result');
      if (targets.length!==1 || effects.length!==1) return;
      const [target]=targets,[effect]=effects,family=value(target,'family');
      const attribute=value(effect,'attribute'), canonical=value(effect,'value');
      if (value(target,'mode')!=='existing' || !worlds.literalGrammar.licenses(family,act) ||
          value(effect,'on')!=='attribute' || (value(effect,'operator') ?? 'eq')!=='eq' ||
          effect.attrs.want || effect.attrs.open_value || effect.attrs.value?.length!==1) return;
      const spoken=term(after,end);
      const candidates=finiteReadings(worlds,bank,family,attribute,spoken);
      if (candidates.length!==1 || candidates[0]!==canonical) return;
      const owner=value(target,'sort_words') ?? value(target,'family_words') ??
        value(target,'sort') ?? value(target,'description');
      if (!owner || !(' '+term(0,colon)+' ').includes(' '+form(owner)+' ')) return;
      const id=JSON.stringify([predicate,family]), meaning=JSON.stringify([act,attribute]);
      const votes=groups.get(id) ?? new Map(), utterance=term(0,end);
      const observations=votes.get(utterance) ?? new Map();
      observations.set(meaning,{canonical,owner:form(owner)});
      votes.set(utterance,observations);
      groups.set(id,votes);
    },
    finish() {
      const results=[];
      for (const [id,votes] of groups) {
        const counts=new Map();
        for (const observations of votes.values()) {
          if (observations.size!==1) continue;
          const [[meaning,{canonical,owner}]]=observations;
          const tally=counts.get(meaning) ?? {count:0,values:new Set(),owners:new Set()};
          tally.count++;
          tally.values.add(canonical);
          tally.owners.add(owner);
          counts.set(meaning,tally);
        }
        for (const [meaning,{count,values,owners}] of counts) {
          if (count<8 || count/votes.size<0.95 || values.size<2 || owners.size<2) continue;
          const [predicate,family]=JSON.parse(id),[act,attribute]=JSON.parse(meaning);
          results.push({predicate,family,act,attribute,support:count});
        }
      }
      return results;
    }
  };
}

export function compileTopicCommandDeclarations(facts,requestKeys) {
  return facts('pro.reader.topic_command').flatMap(wire=>{
    const [tab,family,act,attribute]=['tab','family','act','attribute'].map(k=>value(wire,k));
    if (!act || !requestKeys.some(key=>key.tab===tab && key.family===family && key.name===attribute &&
        key.values.length)) return [];
    return (wire.attrs.predicate ?? []).map(str).map(form).filter(Boolean)
      .map(predicate=>({family,act,attribute,predicate}));
  });
}

const compiledModels=new WeakMap();
export function createTopicCommands(model,worlds) {
  if (!compiledModels.has(model)) compiledModels.set(model,new WeakMap());
  const configured=compiledModels.get(model);
  if (configured.has(worlds)) return configured.get(worlds);
  let learned=model.topicCommands;
  if (!Array.isArray(learned)) {
    const learner=topicCommandLearner(worlds);
    for (const example of model.examples ?? []) learner.observe(example.text,example.sop);
    learned=learner.finish();
  }
  const roles=new Map(), bank=catalog(worlds);
  for (const role of [...learned,...(worlds.topicCommands ?? [])]) {
    if (!role?.predicate || !worlds.literalGrammar.licenses(role.family,role.act) ||
        !bank.has(JSON.stringify([role.family,role.attribute]))) continue;
    const id=JSON.stringify([role.family,role.act,role.attribute]), reading=roles.get(role.predicate) ?? new Map();
    if (!reading.has(id) || (role.support ?? 0)>(reading.get(id).support ?? 0)) reading.set(id,role);
    roles.set(role.predicate,reading);
  }
  const result={roles,bank};
  configured.set(worlds,result);
  return result;
}

export function topicCommandPacket(text,ts,quotes,worlds,compiled) {
  if (text.length>240 || quotes.length || !compiled.roles.size || !text.includes(':')) return;
  const delimited=shape(ts);
  if (!delimited || !locallyPositive(ts,worlds)) return;
  const {colon,end}=delimited, term=(a,b)=>ts.slice(a,b).map(([key])=>key).join(' ');
  const owners=[], roles=[], values=[];
  for (let at=colon+2;at<end;at++) {
    const predicate=term(colon+1,at), available=compiled.roles.get(predicate);
    if (!available) continue;
    for (const {family,act,attribute,support=0} of available.values()) {
      const canonical=finiteReadings(worlds,compiled.bank,family,attribute,term(at,end));
      if (canonical.length!==1) continue;
      roles.push({family,act,attribute,support,start:ts[colon+1][2],end:ts[at-1][3],operandStart:ts[at][2]});
      values.push({family,attribute,value:canonical[0],start:ts[at][2],end:ts[end-1][3]});
    }
  }
  if (!roles.length) return;
  const contexts=new Map(roles.map(({family,act})=>[JSON.stringify([family,act]),{family,act}]));
  for (let det=1;det<Math.min(colon,6);det++) {
    const determiner=worlds.determiners[term(0,det)];
    if (!modes.has(determiner)) continue;
    for (const {family,act} of contexts.values()) for (let at=det;at<colon;at++) {
      const topic=term(at,colon);
      const senses=new Set([
        ...(worlds.ownerInventory?.get(JSON.stringify([act,topic])) ?? [])
          .filter(item=>item.family===family).map(item=>item.sort ?? ''),
        ...worlds.lookup(topic).flatMap(([role,sense,f,mode,sort])=>
          role==='target' && sense===act && f===family && mode==='existing' ? [sort ?? ''] : [])
      ]);
      if (senses.size>1) senses.delete('');
      const modifiers=worlds.nominalScales?.byFamily.get(family)?.forms.get(term(det,at));
      if (at>det && modifiers?.size!==1) continue;
      let selector=null;
      if (at>det) {
        const [{attribute,on,value}]=modifiers.values();
        selector={attribute,on,value,start:ts[det][2],end:ts[at-1][3]};
      }
      for (const sort of senses) {
        owners.push({family,act,sort,determiner,nounStart:ts[at][2],nounEnd:ts[colon-1][3],
          start:ts[0][2],end:ts[colon-1][3],selectors:selector ? [selector] : []});
      }
    }
  }
  if (owners.length) return {roles,owners,values};
}

export function topicCommandReading(text,proof) {
  const {role,owner,value}=proof, chars=Array.from(text);
  const span=(start,end)=>quote(chars.slice(start,end).join(''));
  const head=span(owner.nounStart,owner.nounEnd);
  const sop=[
    '@r w.request.request act='+quote(role.act)+' mood=do predicate='+span(role.start,role.end),
    '@t w.request.target request=$r family='+quote(role.family)+' mode=existing determiner='+owner.determiner+
      ' fill=description description='+span(owner.start,owner.end)+
      (owner.sort ? ' sort='+quote(owner.sort)+' sort_words='+head : ' family_words='+head),
    '@c w.request.constraint request=$r on=attribute attribute='+quote(role.attribute)+' value='+quote(value.value)+
      ' words='+span(value.start,value.end)+' operator=eq phase=result',
    ...owner.selectors.map((s,i)=>'@s'+i+' w.request.constraint request=$r on='+(atom.test(s.on) ? s.on : quote(s.on))+
      ' attribute='+quote(s.attribute)+' value='+quote(s.value)+' words='+span(s.start,s.end)+' operator=degree phase=selector'),
  ].join('\n');
  return {sop,source:'topic-command',status:'matched',support:role.support};
}
