import { tokens } from './lexicon.mjs';
import { parse } from './schema.mjs';

const decode=value=>value?.startsWith('"') ? JSON.parse(value) : value;
const fields=(wire,slot)=>(wire.attrs[slot] ?? []).map(decode);
const field=(wire,slot)=>fields(wire,slot)[0];
const identity=(left,right)=>JSON.stringify([left,right]);
const norm=text=>tokens(text).map(([key])=>key.replaceAll('’',"'")).join(' ');
const words=text=>norm(text).split(' ').filter(Boolean);
const quote=JSON.stringify;
const letters=/^[\p{L}\p{M}\p{N}_]+$/u;
const named=/^\p{Lu}[\p{L}\p{M}\p{N}_-]*$/u;
const idPattern=/^(\p{L}+)[0-9]+$/u;
const decimal=/^[+-]?(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)$/u;
const atom=/^[\p{L}_][\p{L}\p{M}\p{N}_.-]*$/u;
const targetDeterminers=new Set(['definite','demonstrative','possessive']);
const hasWords=(input,start,terms)=>terms.every((word,i)=>input[start+i]===word);

export function compileNativePropertyFrames(facts) {
  const parts=new Map(), phrases=new Map(), verbs=new Map();
  const deontic=facts('w.lang.en.aux').filter(wire=>
    ['advice','obligation','necessity'].includes(field(wire,'modal')))
    .flatMap(wire=>fields(wire,'text').map(words));
  const fixed=new Set(facts('w.lang.en.fixed').map(wire=>field(wire,'frame')));
  for (const wire of facts('w.lang.en.part')) {
    const key=field(wire,'frame'), list=parts.get(key) ?? [];
    list.push(wire);
    parts.set(key,list);
  }
  for (const wire of facts('w.lang.en.phrase')) {
    phrases.set(field(wire,'name'),fields(wire,'item').map(words));
  }
  for (const wire of facts('k.actions.verb')) {
    if (field(wire,'complement')!=='value') continue;
    const act=field(wire,'act'), list=verbs.get(act) ?? [];
    list.push(...fields(wire,'text').map(words));
    verbs.set(act,list);
  }
  const frames=[];
  for (const wire of facts('w.lang.en.frame')) {
    const [name,act,mode,needs]=['name','act','mode','needs'].map(key=>field(wire,key));
    if (act!=='change' || mode!=='set' || !['attrs','number'].includes(needs) ||
        fixed.has(name) || wire.attrs.mood || wire.attrs.polarity) continue;
    const roles=fields(wire,'role');
    if (roles.length!==3 || !['thing','attribute','value'].every(role=>roles.includes(role))) continue;
    const ordered=(parts.get(name) ?? []).slice().sort((a,b)=>Number(field(a,'at'))-Number(field(b,'at')));
    const pattern=[];
    let consumed=0;
    for (const [i,part] of ordered.entries()) {
      const [kind,role,takes]=['is','role','takes'].map(key=>field(part,key));
      const optional=field(part,'optional')==='yes';
      if (kind==='role') {
        if (optional || !roles.includes(role) || (role==='attribute' ? takes!=='lexicon' ||
              field(part,'lexicon')!=='attribute' : role==='thing' ? takes!=='words' : !['words','number'].includes(takes))) break;
        pattern.push({role});
        consumed++;
        continue;
      }
      if (kind==='det' && optional && field(ordered[i+1] ?? part,'is')==='role') { consumed++; continue; }
      let forms, mark;
      if (kind==='lead') { forms=phrases.get(field(part,'phrase')); mark='lead'; }
      if (kind==='verb') { forms=verbs.get(field(part,'act')); mark='predicate'; }
      if (kind==='word') {
        forms=fields(part,'word').map(words);
        if (needs==='number' && !optional && roles[0]==='thing' && field(ordered[i-1] ?? part,'role')==='thing') {
          forms=forms.filter(form=>deontic.some(cue=>hasWords(form,0,cue)));
          mark='predicate';
        }
      }
      if (!forms?.some(form=>form.length)) break;
      pattern.push({forms,optional,...(mark ? {mark}: {})});
      consumed++;
    }
    const compiledRoles=pattern.filter(part=>part.role);
    if (consumed!==ordered.length || compiledRoles.length!==3 || pattern.filter(part=>part.mark==='predicate').length!==1) continue;
    frames.push({name,act,numberOnly:needs==='number',pattern});
  }
  return frames;
}

function keyFor(worlds,family,surface) {
  const labels=worlds.ownerPropertyLabels.get(identity(surface,family)) ?? [];
  const names=new Set(labels.map(({attribute})=>attribute));
  if (names.size!==1) return;
  const [name]=names;
  const keys=worlds.requestKeys.filter(key=>key.family===family && key.name===name);
  const [first]=keys;
  if (!first || keys.some(key=>key.head!==first.head || key.values.length!==first.values.length ||
      key.values.some(value=>!first.values.includes(value)))) return;
  return first;
}

function ownerBindings(worlds,words,span,plain,det,start,end) {
  const owners=new Map(), {next,mode}=det(start,end);
  if (next>=end || mode && !targetDeterminers.has(mode) || !plain(next,end)) return owners;
  const description=span(start,end), raw=span(next,end);
  const bind=(family,fields)=>{
    if (worlds.literalGrammar.licenses(family,'change')) owners.set(JSON.stringify([family,fields]),{family,...fields});
  };
  const prefix=idPattern.exec(words(next,end))?.[1];
  if (prefix) {
    for (const {family,prefix:declared} of worlds.instanceBindings ?? []) {
      if (prefix===declared) bind(family,{fill:'written',ids:raw,...(mode ? {determiner:mode} : {})});
    }
  }
  for (let from=next;from<end;from++) {
    const surface=words(from,end);
    const native=worlds.ownerInventory?.get(identity('change',surface)) ?? [];
    const lexical=worlds.lookup(surface).flatMap(([role,act,family,mode,sort])=>
      role==='target' && act==='change' && mode==='existing' && !native.some(item=>item.family===family) ? [{family,sort}] : []);
    const descriptors=words(next,from);
    if (from>next && descriptors.split(' ').some(word=>worlds.lookup(word).some(([role])=>role==='marker'))) continue;
    for (const {family,sort} of [...native,...lexical]) {
      const props={fill:'description',description,head:span(from,end),...(sort ? {sort} : {}),...(mode ? {determiner:mode} : {})};
      bind(family,props);
      if (from===next && !mode && named.test(raw)) bind(family,{fill:'written',name:raw});
    }
    if (owners.size) break;
  }
  // A noun followed by a declared code supplies both descriptions.
  if (end-next>1) {
    const code=span(end-1,end), suffix=idPattern.exec(words(end-1,end))?.[1];
    for (const {family,prefix} of worlds.instanceBindings ?? []) {
      if (suffix!==prefix) continue;
      const description=words(next,end-1);
      if (worlds.lookup(description).some(([role,act,owner,mode])=>
        role==='target' && act==='change' && owner===family && mode==='existing'))
        bind(family,{fill:'written',ids:code,head:span(next,end-1),...(mode ? {determiner:mode} : {})});
    }
  }
  return owners;
}

function closedValue(key, surface, worlds) {
  const values=new Set(key.values.filter(value=>norm(value.replaceAll('_',' '))===surface || norm(value)===surface));
  for (const [body] of worlds.ownerPropertyValues?.get(identity(key.family,surface)) ?? []) {
    const [wire]=parse('@v w.request.constraint '+body);
    if (field(wire,'attribute')!==key.name || !['eq',undefined].includes(field(wire,'operator')) ||
        !['result',undefined].includes(field(wire,'phase')) || wire.attrs.want) continue;
    const raw=field(wire,'value');
    if (raw && (!key.values.length || key.values.includes(raw))) values.add(raw);
  }
  if (values.size===1) return [...values][0];
}

function parseValue(key,source,surface,worlds) {
  const heads=key.head.split('+');
  if (key.values.length || heads.includes('candidate')) {
    const value=closedValue(key,surface,worlds);
    if (value && (atom.test(value) || value===source)) return {value,canonical:true,numeric:false};
    if (key.values.length) return;
  }
  if (heads.includes('number')) {
    const numeral=worlds.nominalNumbers.get(surface);
    if (decimal.test(source) && Number.isFinite(Number(source))) return {value:source,numeric:true};
    if (numeral?.kind==='cardinal' && /^\d+$/u.test(numeral.value)) return {value:numeral.value,numeric:true,canonical:true};
  }
  if (heads.includes('span') || worlds.ownerPropertyOpen?.has(identity(key.family,key.name))) return {value:source,numeric:false};
}

function admitsPrefix(frame,input) {
  const index=frame.pattern.findIndex(part=>part.mark==='predicate');
  const predicate=frame.pattern[index];
  if (frame.pattern.slice(0,index).some(part=>part.role)) {
    return input.some((_,start)=>predicate.forms.some(form=>hasWords(input,start,form)));
  }
  let starts=[0];
  for (const part of frame.pattern.slice(0,index+1)) {
    starts=[...new Set(starts.flatMap(start=>[
      ...(part.optional ? [start] : []),
      ...part.forms.filter(form=>hasWords(input,start,form)).map(form=>start+form.length),
    ]))];
    if (!starts.length) return false;
  }
  return true;
}

export function nativePropertyPacket(text,ts,quotes,worlds) {
  if (!worlds.nativePropertyFrames?.length || !ts.length || ts.length>44) return;
  const chars=Array.from(text), input=ts.map(([word])=>word.replaceAll('’',"'"));
  const span=(a,b)=>chars.slice(ts[a][2],ts[b-1][3]).join('');
  const words=(a,b)=>input.slice(a,b).join(' ');
  const hidden=(a,b)=>quotes.some(q=>q.start<ts[b-1][3] && ts[a][2]<q.end);
  let end=ts.length;
  const question=input[end-1]==='?';
  if (['.','!','?'].includes(input[end-1]) && !hidden(end-1,end)) end--;
  if (end<4) return;
  const frames=worlds.nativePropertyFrames.filter(frame=>admitsPrefix(frame,input)).map(frame=>({
    ...frame,pattern:frame.pattern.map(part=>part.forms ? {
      ...part,forms:part.forms.filter(form=>input.some((_,i)=>hasWords(input,i,form))),
    } : part),
  })).filter(frame=>frame.pattern.every(part=>part.role || part.optional || part.forms.length));
  if (!frames.length) return;
  const connectors=frames.flatMap(frame=>frame.pattern.filter(part=>!part.role && !part.mark)
    .flatMap(part=>part.forms));
  for (let i=0;i<end;i++) {
    if (hidden(i,i+1)) continue;
    for (let j=i+1;j<=Math.min(i+5,end);j++) {
      if (hidden(i,j)) break;
      const key=words(i,j);
      if (worlds.negatives.has(key) || worlds.scopeGrammar.negatives.has(key) ||
          worlds.scopeGrammar.conditionals.has(key) ||
          ['sequence','contrast','clause','coordination'].includes(worlds.joiners[key]) ||
          [...worlds.scopeGrammar.endings].some(suffix=>key.replaceAll(' ','').endsWith(suffix))) return;
    }
  }
  const plain=(a,b)=>a<b && !hidden(a,b) && input.slice(a,b).every((token,i)=>
    letters.test(token) || token==='-' && a+i>a && a+i+1<b && ts[a+i-1][3]===ts[a+i][2] && ts[a+i][3]===ts[a+i+1][2]);
  const det=(a,b)=>{
    for (let i=Math.min(a+4,b-1);i>a;i--) {
      const mode=worlds.determiners[words(a,i)];
      if (mode) return {mode,next:i};
    }
    return {next:a};
  };
  const owners=[], attrs=[], values=[], families=new Set(), properties=new Map();
  for (let a=0;a<end;a++) for (let b=a+1;b<=Math.min(a+10,end);b++) {
    for (const item of ownerBindings(worlds,words,span,plain,det,a,b).values()) {
      owners.push({a,b,...item});
      families.add(item.family);
    }
  }
  if (!owners.length) return;
  for (let a=1;a<end;a++) for (let b=a+1;b<=Math.min(a+8,end);b++) {
    const {next}=det(a,b);
    if (!plain(next,b)) continue;
    for (const family of families) {
      const key=keyFor(worlds,family,words(next,b));
      if (!key) continue;
      attrs.push({a,b,family,key:key.name,words:span(next,b)});
      properties.set(identity(family,key.name),key);
    }
  }
  if (!attrs.length) return;
  for (let a=1;a<end;a++) for (let b=a+1;b<=Math.min(a+15,end);b++) {
    const quoted=quotes.find(q=>q.start===ts[a][2] && q.end===ts[b-1][3]);
    const source=quoted?.value ?? span(a,b);
    if (!source.trim() || !quoted && ((!plain(a,b) && !decimal.test(source)) ||
        connectors.some(form=>a+form.length<=b && hasWords(input,a,form)))) continue;
    const {next}=det(a,b);
    for (const key of properties.values()) {
      const value=parseValue(key,source,norm(source),worlds) ??
        (!quoted && next>a ? parseValue(key,span(next,b),words(next,b),worlds) : undefined);
      if (!value) continue;
      values.push({a,b,family:key.family,key:key.name,words:source,...value});
    }
  }
  if (!values.length) return;
  return {frames,words:input.slice(0,end),owners,attrs,values,question};
}

export function nativePropertyReadings(text,proofs) {
  const ts=tokens(text), chars=Array.from(text), span=(a,b)=>chars.slice(ts[a][2],ts[b-1][3]).join('');
  const alternatives=new Map();
  for (const {act,frame,owner,attribute,value,predicate} of proofs) {
    const key=identity(owner.family,frame), meanings=alternatives.get(key) ?? new Map();
    const binding=JSON.stringify([owner.a,owner.b,attribute.a,attribute.b,attribute.key,value.a,value.b,value.value]);
    const entries=meanings.get(binding) ?? new Map();
    const props=value.canonical && (value.numeric || atom.test(value.value)) ? value.value : quote(value.value);
    const lines=[
      '@r1 w.request.request act='+quote(act)+' mood=do predicate='+quote(span(...predicate))+' words='+quote(text),
      '@r1.t w.request.target request=$r1 family='+quote(owner.family)+' mode=existing fill='+owner.fill+
        (owner.determiner ? ' determiner='+owner.determiner : '')+
        (owner.description ? ' description='+quote(owner.description) : '')+
        (owner.ids ? ' ids='+quote(owner.ids) : '')+(owner.name ? ' name='+quote(owner.name) : '')+
        (owner.sort ? ' sort='+quote(owner.sort)+' sort_words='+quote(owner.head) :
          owner.head ? ' family_words='+quote(owner.head) : ''),
      '@r1.c w.request.constraint request=$r1 on=attribute attribute='+quote(attribute.key)+
        ' key_words='+quote(attribute.words)+' value='+props+(value.words!==value.value ? ' words='+quote(value.words) : '')+
        ' operator=eq phase=result',
    ];
    if (owner.fill==='description') lines.push('@r1.l w.request.lookup request=$r1 target=$r1.t key=thing from=page');
    const sop=lines.join('\n');
    entries.set(sop,{sop,source:'native-property-frame'});
    meanings.set(binding,entries);
    alternatives.set(key,meanings);
  }
  return [...alternatives.values()].flatMap(meanings=>{
    if (meanings.size!==1) return [];
    const [readings]=meanings.values();
    return [...readings.values()];
  });
}
