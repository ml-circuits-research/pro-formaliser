import { tokens } from './lexicon.mjs';
import { quotedSpans } from './literal-roles.mjs';
import { resolveWrittenMeasurement } from './owner-property.mjs';
import { parse } from './schema.mjs';

const quote=JSON.stringify;
const decode=item=>item?.startsWith('"') ? JSON.parse(item) : item;
const all=(wire,key)=>(wire.attrs[key] ?? []).map(decode);
const one=(wire,key)=>all(wire,key)[0];
const form=text=>tokens(text).map(([term])=>term).join(' ');
const keyOf=(family,key)=>JSON.stringify([family,key]);
const atom=/^[\p{L}\p{N}_][\p{L}\p{N}_.-]*$/u;
const nominal=/^[\p{L}\p{M}\p{N}_'-]+$/u;
const slots=new Set(['owner','property','value','prior']);

export function compileOwnedEffects(facts,keys,propertyLabels) {
  const library=new Map(), frames=new Map(), ownerHeads=new Map(), comparatives=new Map(), senses=new Map();
  for (const key of keys) {
    const index=keyOf(key.family,key.name), group=library.get(index) ?? [];
    group.push(key); library.set(index,group);
  }
  for (const row of facts('pro.reader.effect_owner')) {
    const family=one(row,'family'), head=ownerHeads.get(family) ?? new Set();
    for (const word of all(row,'text')) head.add(form(word));
    ownerHeads.set(family,head);
  }
  for (const row of facts('k.values.comparative')) {
    if (one(row,'degree')!=='comparative') continue;
    const step={up:'more',down:'less'}[one(row,'way')];
    if (step) comparatives.set(JSON.stringify([one(row,'scale'),form(one(row,'text'))]),step);
  }
  for (const row of facts('pro.reader.effect_sense')) {
    const family=one(row,'family'), key=one(row,'key'), index=keyOf(family,key);
    if (!library.has(index)) continue;
    const aliases=new Map();
    for (const alias of all(row,'alias')) {
      const at=alias.indexOf('=');
      if (at>0) aliases.set(form(alias.slice(0,at)),alias.slice(at+1));
    }
    const variants=senses.get(index) ?? [];
    variants.push({id:row.id,aliases,scale:one(row,'scale'),surfaces:new Set(all(row,'text').map(form)),
      command:one(row,'property_command')==='true'});
    senses.set(index,variants);
  }
  for (const row of facts('pro.reader.owned_effect')) {
    const operation=one(row,'operation'), command=one(row,'property_command')==='true';
    const openText=one(row,'open_text')==='true';
    for (const pattern of all(row,'pattern')) {
      const parts=pattern.split(/(\{[a-z]+\})/u).flatMap(piece=>{
        if (piece.startsWith('{')) return [{slot:piece.slice(1,-1)}];
        return form(piece).split(' ').filter(Boolean).map(word=>({word}));
      });
      const captures=parts.flatMap(part=>part.slot ? [part.slot] : []);
      if (!parts.some(p=>p.word) && !command && parts[0]?.slot!=='property' ||
          !captures.includes('property') || captures.some(slot=>!slots.has(slot)) ||
          new Set(captures).size!==captures.length || captures.includes('value')!==(operation==='set')) continue;
      const first=parts[0].word ?? '';
      const choices=frames.get(first) ?? [];
      choices.push({parts,operation,command,openText});
      frames.set(first,choices);
    }
  }
  const properties=new Map(), propertyHeads=new Map();
  const register=(surface,family,key,variants)=>{
    const index=keyOf(family,key), [spec,...rest]=library.get(index) ?? [];
    const words=surface.split(' ');
    if (!spec || !surface || words.length>12 || rest.some(other=>
      other.head!==spec.head || quote(other.values)!==quote(spec.values))) return;
    const propertiesAtSurface=properties.get(surface) ?? new Map();
    const candidates=propertiesAtSurface.get(family) ?? new Map();
    for (const sense of variants ?? senses.get(index) ?? [undefined]) {
      candidates.set(keyOf(key,sense?.id),{spec,sense});
    }
    propertiesAtSurface.set(family,candidates);
    properties.set(surface,propertiesAtSurface);
    propertyHeads.set(words[0],Math.max(propertyHeads.get(words[0]) ?? 0,words.length));
  };
  for (const [index,labels] of propertyLabels) {
    const [surface,family]=JSON.parse(index);
    for (const {attribute} of labels) register(surface,family,attribute);
  }
  for (const [index,variants] of senses) {
    const [family,key]=JSON.parse(index);
    for (const sense of variants) for (const surface of sense.surfaces) register(surface,family,key,[sense]);
  }
  return {frames,comparatives,ownerHeads,properties,propertyHeads};
}

function resolveOwner(tokens,span,a,b,worlds,frame,heads) {
  if (!tokens.slice(a,b).every(token=>nominal.test(token[0]))) return;
  const words=span(a,b);
  const normalized=names(tokens,a,b);
  if (normalized.split(' ').some(token=>worlds.negatives.has(token) || worlds.joiners[token])) return;
  const determiner=worlds.determiners[tokens[a][0]];
  const headStart=determiner ? a+1 : a;
  const familyNoun=[...heads].some(head=>normalized===head || normalized.endsWith(' '+head)) ||
    tokens.slice(headStart,b).some((_,i)=>worlds.lookup(names(tokens,headStart+i,b)).some(([role,act,family,mode])=>
      role==='target' && act==='change' && family===frame.family && mode==='existing'));
  if (headStart===b || ['indefinite','quantified'].includes(determiner) || worlds.isReference(normalized) ||
      tokens.slice(headStart,b).some(([term])=>worlds.scopeGrammar.subjects.has(term))) return;
  const written=span(headStart,b);
  const hasTitle=/^\p{Lu}/u.test(written) && /\p{L}/u.test(written.slice(1));
  return {words,licensed:familyNoun || hasTitle,identity:form(written),...(familyNoun ? {description:words} : {name:written})};
}

function names(ts,a,b) { return ts.slice(a,b).map(([term])=>term).join(' '); }

function openValueText(written,worlds,grammar,family) {
  const terms=written.split(' ');
  return terms.every((term,i)=>nominal.test(term) && !worlds.negatives.has(term) && !worlds.joiners[term] &&
    !Array.from({length:Math.min(8,terms.length-i)},(_,j)=>terms.slice(i,i+j+1).join(' ')).some(surface=>
      worlds.scopeGrammar.conditionals.has(surface) || worlds.scopeGrammar.questions.has(surface) ||
      worlds.lookup(surface).some(([role])=>role==='act') ||
      i>0 && [...(grammar.properties.get(surface)?.get(family)?.values() ?? [])].some(({spec,sense})=>{
        const tail=terms.slice(i+surface.split(' ').length).join(' ');
        return spec.values.some(value=>form(value.replaceAll('_',' '))===tail) || sense?.aliases.has(tail) ||
          grammar.comparatives.has(quote([sense?.scale,tail]));
      })));
}

function operand(frame,property,captured,worlds,grammar) {
  const {spec,sense}=property, heads=spec.head.split('+');
  if (frame.operation!=='set') {
    return spec.values.includes(frame.operation) ? {value:frame.operation,words:captured.property.words} : undefined;
  }
  const {words,quoted}=captured.value;
  const written=form(words);
  if (quoted) return heads.includes('span') && !spec.values.length && words.trim() ? {value:words,words,open:true} : undefined;
  if (frame.command) return;
  const step=grammar.comparatives.get(JSON.stringify([sense?.scale,written]));
  if (step && heads.some(head=>['candidate','number','span','step'].includes(head))) return {step,words};
  if (heads.includes('number') && !spec.values.length) {
    const resolved=resolveWrittenMeasurement(words,worlds,spec.family,spec.name);
    if (resolved?.value) return {value:resolved.value,words,measurement:resolved.measurement};
  }
  const options=new Set(spec.values.filter(value=>form(value.replaceAll('_',' '))===written));
  const alias=sense?.aliases.get(written);
  if (spec.values.includes(alias)) options.add(alias);
  for (const [body] of worlds.ownerPropertyValues.get(keyOf(spec.family,written)) ?? []) {
    const [wire]=parse('@value w.request.constraint '+body);
    const value=one(wire,'value');
    if (!wire.attrs.want && one(wire,'phase')==='result' && one(wire,'operator')==='eq' &&
        one(wire,'attribute')===spec.name && spec.values.includes(value)) options.add(value);
  }
  if (options.size===1) return {value:options.values().next().value,words};
  // Unquoted open text is admissible only in an explicit owner construction.
  if (frame.openText && captured.owner && heads.includes('span') && !spec.values.length && !sense?.scale &&
      (captured.owner.reference ? sense?.command && openValueText(written,worlds,grammar,spec.family) :
        written.split(' ').every(term=>nominal.test(term) && !worlds.negatives.has(term) && !worlds.joiners[term]))) {
    return {value:words,words,open:true};
  }
}

export function ownedEffectReadings(text,worlds,grammar=worlds.ownedEffects) {
  if (!grammar?.frames.size) return [];
  const ts=tokens(text), chars=Array.from(text);
  if (ts.length<3 || ts.length>55) return [];
  const sensitive=quotedSpans(text);
  const quoteAt=new Map(sensitive.map(q=>[q.start,q]));
  const covered=(a,b)=>sensitive.some(q=>q.start<ts[b-1][3] && q.end>ts[a][2]);
  const span=(a,b)=>chars.slice(ts[a][2],ts[b-1][3]).join('');
  const norm=(a,b)=>names(ts,a,b);
  const final=/^[.!?]$/u.test(ts.at(-1)[0]) ? ts.length-1 : ts.length;
  const registered=new Map(), families=new Set();
  for (let a=0;a<final;a++) {
    const width=grammar.propertyHeads.get(ts[a][0]) ?? 0;
    for (let b=a+1;b<=Math.min(a+width,final);b++) {
      const surfaces=grammar.properties.get(norm(a,b));
      if (!surfaces || covered(a,b)) continue;
      const options=[];
      for (const [family,bank] of surfaces) {
        if (!worlds.literalGrammar.licenses(family,'change')) continue;
        options.push([family,[...bank.values()]]);
        families.add(family);
      }
      if (options.length) {
        const at=registered.get(a) ?? new Map();
        at.set(b,new Map(options));
        registered.set(a,at);
      }
    }
  }
  if (!registered.size) return [];
  const licensedLead=lead=>worlds.literalGrammar.leads.has(lead) || worlds.fillerPhrases.has(lead);
  const leadAllowed=lead=>!lead || licensedLead(lead) || lead.split(' ').some((_,end,parts)=>{
    const tail=parts.slice(end);
    return end>0 && licensedLead(parts.slice(0,end).join(' ')) &&
      (licensedLead(tail.join(' ')) || tail.length===1 && worlds.joiners[tail[0]]==='addition');
  });
  function* match(frame,family,part,a,b,captured) {
    if (part===frame.parts.length) {
      if (a===b) yield captured;
      return;
    }
    if (a===b) return;
    const {word,slot}=frame.parts[part];
    if (word) {
      if (ts[a][0]===word && !covered(a,a+1)) yield* match(frame,family,part+1,a+1,b,captured);
      return;
    }
    if (slot==='property' && !covered(a,a+1) && worlds.determiners[ts[a][0]]==='definite' &&
        !(frame.parts[part-1]?.word && worlds.determiners[frame.parts[part-1].word])) a++;
    for (let end=a+1;end<=Math.min(a+12,b);end++) {
      let result;
      if (slot==='owner') {
        if (!covered(a,end)) {
          const surface=norm(a,end);
          if (frame.openText && frame.parts[part+1]?.word &&
              frame.parts[part+2]?.slot==='property' && worlds.sequenceObjectPronouns.get(surface)==='sg') {
            result={reference:true,words:span(a,end)};
          } else result=resolveOwner(ts,span,a,end,worlds,{family},grammar.ownerHeads.get(family) ?? []);
        }
      } else if (slot==='property') {
        const choices=registered.get(a)?.get(end)?.get(family);
        if (choices?.length) result={words:span(a,end),choices};
      } else {
        const quoted=quoteAt.get(ts[a][2]);
        if (quoted?.end===ts[end-1][3]) result={words:quoted.value,quoted:true};
        else if (!covered(a,end)) result={words:span(a,end)};
      }
      if (result) yield* match(frame,family,part+1,end,b,{...captured,[slot]:result});
    }
  }
  const segments=new Map();
  function effects(a,b) {
    const index=quote([a,b]);
    if (segments.has(index)) return segments.get(index);
    const result=[];
    for (let start=a;start<b;start++) {
      const lead=norm(a,start).replace(/ [,;]$/u,'');
      if (!leadAllowed(lead)) continue;
      const frames=[...(grammar.frames.get(ts[start][0]) ?? []),
        ...(registered.has(start) ? grammar.frames.get('') ?? [] : [])];
      for (const frame of frames) {
        for (const family of families) {
          for (const captured of match(frame,family,0,start,b,{})) {
            for (const property of captured.property.choices) {
              if ((frame.command || captured.owner?.reference) && !property.sense?.command) continue;
              const value=operand(frame,property,captured,worlds,grammar);
              if (!value) continue;
              if (captured.prior) {
                const previous=operand(frame,property,{...captured,value:captured.prior},worlds,grammar);
                if (!previous?.value || previous.open || previous.value===value.value || value.open) continue;
              }
              const head=frame.parts[0].word, next=frame.parts[1];
              const predicate=head && !worlds.determiners[head] &&
                (next?.slot==='property' || captured.owner?.reference || worlds.determiners[next?.word]) ? span(start,start+1) : undefined;
              result.push({family,key:property.spec.name,keyWords:captured.property.words,owner:captured.owner,value,predicate});
            }
          }
        }
      }
    }
    segments.set(index,result);
    return result;
  }
  const coordinator=(a,b)=>{
    const terms=ts.slice(a,b).map(([term])=>term);
    const words=terms.filter(term=>!/^[.,;—]$/u.test(term));
    return words.length ? words.every(word=>['sequence','coordination','clause'].includes(worlds.joiners[word])) :
      terms.length===1;
  };
  function* paths(start,depth=0) {
    yield* effects(start,final).map(effect=>[effect]);
    if (depth===3) return;
    for (let a=start+2;a<final-1;a++) for (let b=a+1;b<=Math.min(a+7,final-1);b++) {
      if (covered(a,b) || !coordinator(a,b)) continue;
      const left=effects(start,a);
      if (!left.length) continue;
      for (const rest of paths(b,depth+1)) {
        for (const first of left) if (rest.every(effect=>effect.family===first.family)) yield [first,...rest];
      }
    }
  }
  const readings=new Map();
  for (let start=0;start<final;start++) {
    if (start && ts[start-1][0]!==':') continue;
    for (const path of paths(start)) {
      const {family}=path[0];
      const topics=start ? Array.from({length:start-1},(_,at)=>at).flatMap(at=>{
        if (!leadAllowed(norm(0,at))) return [];
        if (covered(at,start-1)) return [];
        const owner=resolveOwner(ts,span,at,start-1,worlds,{family},grammar.ownerHeads.get(family) ?? []);
        return owner?.licensed ? [owner] : [];
      }) : [];
      const topic=topics.at(-1);
      if (start && !topic) continue;
      if (!topic && path[0].owner?.reference && path.some(effect=>effect.owner && !effect.owner.reference)) continue;
      const owners=[...path.map(effect=>effect.owner).filter(item=>item && !item.reference),...(topic ? [topic] : [])];
      if (new Set(path.map(effect=>effect.key)).size!==path.length) continue;
      const owner=owners.find(owner=>owner.licensed);
      const anaphoric=path.some(effect=>effect.owner?.reference);
      if (anaphoric && owners.length && !owner?.name) continue;
      const contextual=!owners.length && path.every(effect=>!effect.value.open || effect.owner?.reference);
      if (!contextual && (!owner || new Set(owners.map(item=>item.identity)).size!==1)) continue;
      const predicate=contextual && path[0].predicate;
      const lines=['@r w.request.request act=change mood=do words='+quote(text)+(predicate ? ' predicate='+quote(predicate) : ''),
        '@t w.request.target request=$r family='+quote(family)+' mode=existing '+
          (contextual ? 'fill=context' : owner.name ? 'fill=written name='+quote(owner.name) : 'fill=description description='+quote(owner.description)),
        '@l w.request.lookup request=$r target=$t key=thing from=page'];
      for (const [i,effect] of path.entries()) {
        const {key,keyWords,value}=effect;
        lines.push('@c'+i+' w.request.constraint request=$r on=attribute attribute='+quote(key)+
          ' phase=result key_words='+quote(keyWords)+' words='+quote(value.words)+
          (value.step ? ' operator=delta step='+value.step :
            ' operator=eq value='+(!value.open && atom.test(value.value) ? value.value : quote(value.value)))+
          (value.measurement ? ' measure='+value.measurement.measure+' unit='+quote(value.measurement.unit)+
            ' measure_words='+quote(value.measurement.words) : ''));
      }
      const sop=lines.join('\n');
      readings.set(sop,{sop,source:contextual ? 'contextual-effects' : 'owned-effects',status:'matched'});
    }
  }
  return [...readings.values()];
}
