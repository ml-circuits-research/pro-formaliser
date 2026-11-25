import {parse,serialize} from '../.cache/knowledge/tools/sopworld/sopworld.mjs';
import {tokens} from './lexicon.mjs';
import {consumeUnread} from './nominal-evidence.mjs';
import {literalRanges} from './evidence.mjs';
import {compileStructuredArguments,structuredBank} from './structured-arguments.mjs';

const decode=v=>v?.startsWith('"') ? JSON.parse(v) : v;
const many=(w,k)=>(w.attrs[k] ?? []).map(decode);
const one=(w,k)=>many(w,k)[0];
const keys=s=>tokens(s).map(t=>t[0]);
const encode=s=>JSON.stringify(s);
const ownerPart='$owner';
const predicatePart='$predicate';
const unreadPart='$unread';
const identityPart='$identity';
const matchesAt=(ts,start,words)=>words.every((word,i)=>ts[start+i]?.[0]===word);
const atom=/^[\p{L}_][\p{L}\p{M}\p{N}_.-]*$/u;

function admittedLead(ts,end,worlds) {
  if (!end) return true;
  const words=ts.slice(0,end).map(([word])=>word).filter(word=>word!==',');
  const known=text=>worlds.fillerPhrases.has(text) || worlds.literalGrammar.leads.has(text) ||
    worlds.scopeGrammar.courtesy.has(text);
  return known(words.join(' ')) ||
    worlds.joiners[words.at(-1)]==='addition' && (words.length===1 || known(words.slice(0,-1).join(' ')));
}

// A fronted location can qualify an instruction without naming its owner.
// Preserve that span until a world supplies the placement binding.
function addressedLead(ts,end,worlds) {
  const comma=ts.slice(0,end).findIndex(([word])=>word===',');
  const start=comma+1;
  const lead=ts.slice(start,end).map(([word])=>word);
  const grammar=worlds.scopeGrammar;
  if (!grammar.modals.has(lead[0]) || !grammar.addressees.has(lead[1]) ||
      !worlds.literalGrammar.leads.has(lead.join(' '))) return;
  if (comma<0) return {courtesyStart:ts[start][2]};
  const markerEnd=ts.slice(0,comma).findIndex(([word])=>worlds.determiners[word]==='definite');
  if (markerEnd<1 || markerEnd+1>=comma ||
      !worlds.lookup(ts.slice(0,markerEnd).map(([word])=>word).join(' ')).some(
        ([role,license,slot])=>role==='marker' && license==='*' && slot==='spatial')) return;
  const nominal=ts.slice(markerEnd+1,comma);
  if (!nominal.every(([word])=>/^[\p{L}\p{M}\p{N}_]+$/u.test(word) &&
      !grammar.auxiliary.has(word) && !grammar.conditionals.has(word) &&
      !worlds.negatives.has(word) && !worlds.joiners[word])) return;
  return {courtesyStart:ts[start][2],locationEnd:ts[comma-1][3]};
}

function coordinatedCommandStarts(ts,worlds) {
  const starts=new Set();
  const phrase=(from,to)=>ts.slice(from,to).map(([word])=>word).join(' ');
  for (let start=1;start+2<ts.length;start++) {
    if (!worlds.joiners[ts[start-1][0]]) continue;
    for (let boundary=start+1;boundary<Math.min(start+5,ts.length-1);boundary++) {
      if (worlds.determiners[ts[boundary][0]]!=='definite') continue;
      const acts=worlds.lookup(phrase(start,boundary)).filter(([role,act,mood])=>
        role==='act' && act!=='ask' && (!mood || mood==='do')).map(([,act])=>act);
      if (!acts.length) continue;
      for (let end=boundary+2;end<=Math.min(boundary+5,ts.length);end++) {
        if (worlds.lookup(phrase(boundary+1,end)).some(([role,act,,mode])=>
          role==='target' && mode==='existing' && acts.includes(act))) {
          starts.add(start);
          break;
        }
      }
    }
  }
  return starts;
}

export function argumentSequences(facts,catalog) {
  const forms=new Map();
  const formats=compileStructuredArguments(facts,catalog);
  const conjunctions=facts('w.lang.en.closed').filter(w=>one(w,'class')==='conjunction')
    .flatMap(w=>many(w,'text').map(keys));
  for (const w of facts('core.word')) {
    for (const owner of many(w,'of')) {
      if (!forms.has(owner)) forms.set(owner,[]);
      for (const text of many(w,'text')) for (const value of many(w,'means')) forms.get(owner).push([keys(text),value]);
    }
  }
  const index=new Map();
  for (const w of facts('pro.reader.argument_sequence')) {
    const family=one(w,'family'),act=one(w,'act'),mode=one(w,'mode'),tab=one(w,'tab');
    const props=new Map(catalog.filter(k=>k.family===family && k.tab===tab).map(k=>[k.name,k]));
    const owners=many(w,'owner').map(keys).filter(words=>words.length), ownerKey=one(w,'owner_key'),ownerValue=one(w,'owner_value');
    const inferred=one(w,'inferred_owner')==='true';
    if (inferred && (owners.length || mode!=='new' || ownerKey)) continue;
    const owned=owners.length>0 || inferred;
    const predicateBank=many(w,'predicate_surface').map(keys).filter(words=>words.length);
    const lexicalParts=new Set(many(w,'lexical_part'));
    const structuredParts=new Set(many(w,'structured_part'));
    if (Boolean(ownerKey)!==Boolean(ownerValue) || ownerKey && (mode!=='new' || !props.get(ownerKey)?.values.includes(ownerValue))) continue;
    const openFields=new Set();
    const parts=many(w,'part').map(p=>{
      if (p.startsWith('=')) {
        const field=p.slice(1);
        return owned && openFields.has(field) ? {repeat:field} : null;
      }
      if (p===ownerPart) return owners.length ? (mode==='existing' ? {key:p,nominal:owners} :
        {key:p,bank:owners.map(words=>[words,''])}) : null;
      if (p===predicatePart) return owned && predicateBank.length ? {key:p,bank:predicateBank.map(words=>[words,''])} : null;
      if (p===unreadPart) return owned ? {key:p} : null;
      if (p===identityPart) return owned && mode==='existing' ? {key:p} : null;
      const prop=props.get(p);
      if (!prop) {
        const literal=keys(p);
        return p.includes('.') || !literal.length ? null : {literal};
      }
      if (structuredParts.has(p)) {
        const format=formats.get(JSON.stringify([tab,family,p]));
        return format && !lexicalParts.has(p) ? {key:p,format} : null;
      }
      if (lexicalParts.has(p)) {
        if (prop.values.length || !prop.head.split('+').includes('span')) return null;
        const bank=[...forms.get(prop.name) ?? [],...forms.get(prop.means) ?? []]
          .filter(([words])=>words.length).map(([words])=>[words,'']);
        return bank.length ? {key:p,bank,lexical:true} : null;
      }
      if (prop.values.length && prop.head.split('+').some(h=>['class','candidate'].includes(h))) {
        const bank=prop.values.map(v=>[keys(v),v]);
        for (const [alias,v] of forms.get(prop.name) ?? []) if (prop.values.includes(v)) bank.push([alias,v]);
        return {key:p,bank};
      }
      if (!prop.head.split('+').includes('span') || prop.values.length) return null;
      openFields.add(p);
      return {key:p};
    });
    if (parts.some(p=>!p)) continue;
    const slots=parts.filter(p=>p.key && p.key!==unreadPart).map(p=>p.key);
    if (slots.length<2 || new Set(slots).size!==slots.length ||
        [...lexicalParts].some(key=>!slots.includes(key)) ||
        [...structuredParts].some(key=>!slots.includes(key)) ||
        inferred && !structuredParts.size || owned && (!inferred && !slots.includes(ownerPart) || slots.includes(ownerKey))) continue;
    const scopeLiteralSlot=one(w,'scope_literal_slot');
    const scopeLiterals=many(w,'scope_literal').map(keys);
    const closedSlot=parts.find(part=>part.key===scopeLiteralSlot)?.bank;
    if (scopeLiteralSlot && (!owned || !closedSlot || !scopeLiterals.length ||
        scopeLiterals.some(form=>!closedSlot.some(([words])=>words.join(' ')===form.join(' '))))) continue;
    const tails=owned ? many(w,'tail').map(keys).filter(words=>words.length) : [];
    const bindsPredicate=slots.includes(predicatePart);
    const boundaries=[...many(w,'open_boundary').map(keys),...bindsPredicate ? conjunctions : []].filter(words=>words.length);
    const numericModifiers=many(w,'numeric_modifier').map(keys).filter(words=>words.length);
    const declaredPrefixes=many(w,'prefix').map(keys).filter(prefix=>prefix.length);
    const ownerLed=!declaredPrefixes.length && mode==='existing' && parts.length===3 &&
      parts[0].nominal && parts[1].literal && parts[2].bank && !parts[2].lexical;
    for (const prefix of ownerLed ? [[]] : declaredPrefixes) {
      const head=prefix[0] ?? '';
      const entries=index.get(head) ?? [];
      entries.push({prefix,parts,family,act,mode,owned,inferred,ownerKey,ownerValue,tails,boundaries,numericModifiers,
        bindsPredicate,ownerLed,scopeLiteralSlot,scopeLiterals});index.set(head,entries);
    }
  }
  for (const frames of index.values()) {
    for (const frame of frames.filter(frame=>frame.owned)) {
      frame.boundPhrases=frames.filter(peer=>peer.owned && peer.family===frame.family && peer.act===frame.act)
        // A vocabulary for an open slot can appear in another open field.
        .flatMap(peer=>peer.parts.filter(part=>part.key!==ownerPart && !part.lexical).flatMap(part=>part.bank ?? []))
        .map(([words])=>words).filter(words=>words.length>1);
    }
  }
  return index;
}

export function sequencePacket(ts,worlds,restricted=false,text) {
  const packets=[];
  let stop=ts.length;
  while (stop && ['.','!','?'].includes(ts[stop-1][0])) stop--;
  if (!stop) return packets;
  let commandStarts;
  for (let i=0;i<stop;i++) for (const f of [...worlds.argumentSequences?.get(ts[i][0]) ?? [],
      ...worlds.argumentSequences?.get('') ?? []]) {
    if (!matchesAt(ts,i,f.prefix) || restricted && !f.scopeLiteralSlot) continue;
    const start=i+f.prefix.length;
    if (start>=stop) continue;
    if (f.ownerLed) {
      const det=worlds.determiners[ts[i][0]];
      if (det && !['definite','demonstrative','possessive'].includes(det) ||
          !f.parts[0].nominal.some(noun=>matchesAt(ts,i+Number(Boolean(det)),noun))) continue;
    }
    const addressed=f.owned && !f.bindsPredicate && addressedLead(ts,i,worlds);
    if (f.owned) {
      if (!worlds.literalGrammar.licenses(f.family,f.act) ||
          !addressed && (ts[stop]?.[0]==='?' || !admittedLead(ts,i,worlds))) continue;
    } else if (!f.prefix.some((_,a)=>f.prefix.slice(a).some((_,b)=>
      worlds.lookup(f.prefix.slice(a,a+b+1).join(' ')).some(([role,act,family,mode])=>
        role==='target' && act===f.act && family===f.family && mode===f.mode)))) continue;
    // A connector reserves its complete phrase. An article inside that
    // phrase can still belong to a different written operand.
    const connectors=f.parts.flatMap(part=>part.literal ? [part.literal] : []);
    const protectedPositions=new Set();
    for (const words of [...connectors,...f.boundPhrases ?? [],...f.boundaries]) {
      for (let from=start;from+words.length<=stop;from++) {
        if (!matchesAt(ts,from,words)) continue;
        for (let at=from;at<from+words.length;at++) protectedPositions.add(at);
      }
    }
    // A declared measurement modifier is not a data field name. Leave
    // the tokens available to typed/literal parts, but bar open spans.
    for (const words of f.numericModifiers) {
      for (let from=start;from+2+words.length<=stop;from++) {
        if (!/^\d+$/u.test(ts[from][0]) || ts[from+1][0]!=='-' || !matchesAt(ts,from+2,words)) continue;
        for (let at=from;at<from+2+words.length;at++) protectedPositions.add(at);
      }
    }
    commandStarts ??= coordinatedCommandStarts(ts,worlds);
    const input=ts.slice(start,stop).map(([word,,a,b],j)=>{
      const protectedWord=protectedPositions.has(start+j) || commandStarts.has(start+j) ||
        worlds.negatives.has(word) || worlds.scopeGrammar.conditionals.has(word) ||
        Boolean(worlds.joiners[word]) || worlds.scopeGrammar.auxiliary.has(word) ||
        worlds.lookup(word).some(([role])=>role==='marker') ||
        !/^[\p{L}\p{M}\p{N}_]+$/u.test(word) && !(word==='-' && ts[start+j-1]?.[3]===a && ts[start+j+1]?.[2]===b);
      return [word,a,b,!protectedWord];
    });
    const endings=[stop];
    const politeTail=f.ownerLed && worlds.discourse.some(({text,class:kind})=>
      kind==='politeness' && text===ts[stop-1][0]);
    for (let end=start+1;end<stop;end++) {
      if (politeTail && end===stop-1 || f.tails.some(words=>end+words.length<=stop && matchesAt(ts,end,words))) endings.push(end);
    }
    for (const end of endings) {
      if (end-start>32) continue;
      const parts=f.parts.map(part=>part.format ? {...part,bank:structuredBank(text,ts,start,end,worlds,f.family,part)} : part);
      if (parts.some(part=>part.format && !part.bank.length)) continue;
      const packet={family:f.family,act:f.act,mode:f.mode,parts,input:input.slice(0,end-start),
        anchor:ts[i][2],start:ts[start][2],end:ts[end-1][3]};
      if (f.owned) {
        const boundary=f.prefix.findLastIndex(word=>[',',':'].includes(word));
        packet.owned={...addressed,inferred:f.inferred,ownerKey:f.ownerKey ?? '',ownerValue:f.ownerValue ?? '',
          utteranceEnd:ts[stop-1][3]};
        if (f.scopeLiteralSlot) Object.assign(packet.owned,{scopeLiteralSlot:f.scopeLiteralSlot,scopeLiterals:f.scopeLiterals});
        if (f.bindsPredicate) {
          packet.owned.bindsPredicate=true;
          if (admittedLead(ts,start,worlds)) packet.owned.prefaceEnd=ts[start-1][3];
        }
        else if (!f.ownerLed) Object.assign(packet.owned,{predicateStart:ts[i+boundary+1][2],predicateEnd:ts[start-1][3]});
        if (politeTail && end===stop-1) packet.owned.politeTail=ts[end][2];
      }
      packets.push(packet);
    }
  }
  return packets;
}

export function sequenceReading(text,candidate,proof) {
  if (proof.owned) return;
  const wires=parse(candidate.sop), req=wires.filter(w=>w.type==='w.request.request'), tg=wires.filter(w=>w.type==='w.request.target');
  if (req.length!==1 || tg.length!==1 || one(req[0],'act')!==proof.act || one(tg[0],'family')!==proof.family ||
      one(tg[0],'mode')!==proof.mode || one(tg[0],'request')!=='$'+req[0].id) return;
  const chars=Array.from(text), point=i=>chars.slice(0,i).join('').length;
  const anchor=point(proof.anchor),start=point(proof.start),end=point(proof.end);
  const head=one(tg[0],'sort_words') ?? one(tg[0],'family_words') ?? one(tg[0],'sort');
  if (head && !literalRanges(text.toLowerCase(),head.toLowerCase(),0,start).some(([,b])=>b>anchor)) return;
  const predicate=one(req[0],'predicate');
  if (predicate && !literalRanges(text,predicate,0,start).length) return;
  const scope=one(req[0],'words');
  if (scope && !scope.includes(text.slice(anchor,end))) return;
  const additions=[],ids=new Set(wires.map(w=>w.id));
  for (const [key,canonical,a,b] of proof.bindings) {
    const surface=chars.slice(a,b).join(''),value=canonical || surface;
    const matches=wires.filter(w=>w.type==='w.request.constraint' && one(w,'attribute')===key);
    if (matches.some(w=>one(w,'request')!=='$'+req[0].id || many(w,'value').length!==1 ||
        one(w,'value')!==value || ![undefined,'result'].includes(one(w,'phase')) ||
        ![undefined,'eq'].includes(one(w,'operator')) || one(w,'want') || w.attrs.of)) return;
    if (matches.length) continue;
    let id=req[0].id+'.arg'+additions.length;
    while(ids.has(id)) id+='_';
    ids.add(id);additions.push({id,type:'w.request.constraint',attrs:{request:['$'+req[0].id],on:['attribute'],attribute:[key],value:[canonical && /^[\p{L}_][\p{L}\p{M}\p{N}_.-]*$/u.test(canonical) ? canonical : encode(value)],words:[encode(surface)],operator:['eq'],phase:['result']}});
  }
  if (!additions.length) return;
  return {sop:serialize([...consumeUnread(wires,text,start,end),...additions]),source:'argument-sequence',status:candidate.status};
}

// Recheck speech scope after a full proof has assigned the closed cue to
// a value slot. Keep all other tokens, including any independent negation.
export function sequenceScopeText(text,proof) {
  const slot=proof.owned?.scopeLiteralSlot;
  if (!slot || proof.end!==proof.owned.utteranceEnd) return;
  const binding=proof.bindings.find(([key])=>key===slot);
  if (!binding?.[1]) return;
  const [, ,start,end]=binding, chars=Array.from(text);
  const surface=keys(chars.slice(start,end).join('')).join(' ');
  if (!proof.owned.scopeLiterals.some(words=>words.join(' ')===surface)) return;
  chars.fill(' ',start,end);
  return chars.join('');
}

export function sequenceFrameReading(text,proof,extraBindings=[],labels) {
  if (!proof.owned) return;
  const chars=Array.from(text), span=(start,end)=>chars.slice(start,end).join('');
  const {ownerKey,ownerValue,predicateStart,predicateEnd,utteranceEnd}=proof.owned;
  const owner=proof.bindings.find(([key])=>key===ownerPart);
  const identity=proof.bindings.find(([key])=>key===identityPart);
  if (!owner && !proof.owned.inferred) return;
  const noun=owner && span(owner[2],owner[3]);
  const target=identity ? ' fill=written name='+encode(span(identity[2],identity[3]))+' family_words='+encode(noun) :
    proof.mode==='existing' ? ' fill=description description='+encode(noun) :
      noun ? ' determiner=indefinite family_words='+encode(noun) : '';
  const lines=[
    '@r1 w.request.request act='+encode(proof.act)+' mood=do'+
      (predicateStart===undefined ? '' : ' predicate='+encode(span(predicateStart,predicateEnd)))+
      ' words='+encode(text),
    '@r1.t w.request.target request=$r1 family='+encode(proof.family)+' mode='+proof.mode+target,
  ];
  if (proof.mode==='existing') lines.push('@r1.l w.request.lookup request=$r1 target=$r1.t key=thing from=page');
  const bindings=proof.bindings.flatMap(binding=>binding===owner ?
    (ownerKey ? [[ownerKey,ownerValue,owner[2],owner[3]]] : []) :
    binding===identity || binding[0]===unreadPart || binding[0].startsWith('=') ? [] : [binding]);
  for (const [i,[key,canonical,a,b]] of [...bindings,...extraBindings].entries()) {
    const words=span(a,b), measurement=canonical?.measurement, value=measurement ? canonical.value : canonical || words;
    let keyWords='';
    if (labels?.has(key)) {
      // A role label must be in an adjacent connector. A fronted role may
      // have a label after its value and before the command delimiter.
      const previous=Math.max(proof.start,...proof.bindings.map(binding=>binding[3]).filter(end=>end<=a));
      const beforeRepeat=proof.bindings.find(([slot,,x,y])=>slot.startsWith('=') && y===previous);
      const leadToRepeat=beforeRepeat && Math.max(proof.start,...proof.bindings.map(binding=>binding[3])
        .filter(end=>end<=beforeRepeat[2]));
      const connectors=[[previous,tokens(span(previous,a))]];
      if (beforeRepeat && !span(previous,a).trim()) connectors.push([leadToRepeat,tokens(span(leadToRepeat,beforeRepeat[2]))]);
      const following=proof.owned.bindsPredicate && b<predicateStart ?
        tokens(span(b,Math.min(predicateStart,...proof.bindings.map(binding=>binding[2]).filter(start=>start>=b)))) : [];
      for (const label of labels.get(key)) {
        const prefix=following.slice(0,label.words.length);
        const matches=parts=>label.words.every((word,i)=>word===parts[i]?.[0]);
        const [offset,matched]=connectors.map(([from,connector])=>[from,connector.slice(-label.words.length)])
          .find(([,suffix])=>matches(suffix)) ?? (matches(prefix) ? [b,prefix] : []);
        if (!matched) continue;
        const written=span(offset+matched[0][2],offset+matched.at(-1)[3]);
        if (written.length>keyWords.length) keyWords=written;
      }
    }
    lines.push('@r1.arg'+i+' w.request.constraint request=$r1 on=attribute attribute='+encode(key)+
      ' value='+(!measurement && canonical && atom.test(canonical) ? canonical : encode(value))+
      (words===value && !measurement ? '' : ' words='+encode(words))+(keyWords ? ' key_words='+encode(keyWords) : '')+' operator=eq phase=result'+
      (measurement ? ' measure='+measurement.measure+' unit='+encode(measurement.unit)+' measure_words='+encode(measurement.words) : ''));
  }
  const lead=span(proof.owned.courtesyStart ?? 0,proof.owned.prefaceEnd ??
    (proof.owned.bindsPredicate ? proof.anchor : predicateStart ?? proof.anchor)).trim();
  if (lead) lines.push('@f1 w.request.filler text='+encode(lead.replace(/,\s*$/u,'')));
  const {politeTail}=proof.owned;
  if (politeTail!==undefined) lines.push('@f2 w.request.filler text='+encode(span(politeTail,utteranceEnd)));
  const remainder=span(proof.end,politeTail ?? utteranceEnd).replace(/^\s*,?\s*/u,'');
  const unread=proof.bindings.filter(([key])=>key===unreadPart).map(([, ,a,b])=>span(a,b));
  if (proof.owned.locationEnd) unread.unshift(span(0,proof.owned.locationEnd).trim());
  if (remainder) unread.push(remainder);
  for (const [i,raw] of unread.entries()) lines.push('@r1.u'+i+' w.request.unread request=$r1 text='+encode(raw));
  return {sop:lines.join('\n'),source:'argument-frame',status:unread.length ? 'partial' : 'matched'};
}
