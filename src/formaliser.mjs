import {ownedEffectReadings} from './owned-effects.mjs';
import {createAppositiveSelectorReader} from './appositive-selector.mjs';
import {quantifiedVerbReadings} from './quantified-verb.mjs';
import {createTopicCommands,topicCommandPacket,topicCommandReading} from './topic-commands.mjs';
import {postposedClauseReadings} from './postposed-clause.mjs';
import {analyticalOwnerBindings} from './analytical-frames.mjs';
import {orientationLandmarkReadings} from './orientation-landmark.mjs';
import {reciprocalReading} from './reciprocal-reading.mjs';
import {spatialAnchorReadings} from './spatial-anchor.mjs';
import {discourseReason,discourseReasonReading} from './discourse-reason.mjs';
import {sequenceReferenceReadings} from './sequence-reference.mjs';
import {nativePropertyPacket,nativePropertyReadings} from './native-property-frames.mjs';
import {preservationAdjunct,preservationAdjunctReading} from './preservation-adjunct.mjs';
import { directionalResultCandidates } from './directional-result.mjs';
import { verbEffectIndex,verbEffectReading } from './verb-effects.mjs';
import { transformationReadings } from './transformation.mjs';
import { numberedQualifierReadings } from './numbered-qualifier.mjs';
import { coordinatedPacket,effectReading } from './coordinated-effects.mjs';
import { discourseBody } from './trailing-discourse.mjs';
import { memberActionPackets,memberActionReadings } from './member-actions.mjs';
import { affectedTargetCandidates } from './affected-target.mjs';
import { ownerPropertyReadings } from './owner-property.mjs';
import { serialize } from '../.cache/knowledge/tools/sopworld/sopworld.mjs';
import { alternateBodies } from './request-alternations.mjs';
import { evidenceReport } from './evidence.mjs';
import {createEndpointReferenceReader} from './endpoint-reference.mjs';
import {createCompoundReferenceReader} from './compound-reference.mjs';
import {nominalScaleReading} from './nominal-scales.mjs';
import { sequencePacket,sequenceReading,sequenceFrameReading } from './argument-sequences.mjs';
import { propertyCommandPacket } from './property-commands.mjs';
import { createPredicateTransfer } from './predicate-transfer.mjs';
import { fixedPropertyReadings } from './fixed-properties.mjs';
import { nominalClassReading } from './nominal-class.mjs';
import { identitySelectorReadings } from './identity-selectors.mjs';
import { openPairReadings } from './open-pairs.mjs';
import { clauseQualifiers } from './clause-qualifiers.mjs';
import { nativeNominalPhraseReadings, nominalPhraseReadings } from './nominal-phrases.mjs';
import { sequenceNameReadings } from './sequence-names.mjs';
import { postfixSetQuestions, universalTargetReading } from './set-query.mjs';
import { modifierReading } from './nominal-modifiers.mjs';
import { literalAttachments, quotedLiteralCleanup } from './literal-attachment.mjs';
import { createNearExample } from './near-example.mjs';
import { nominalNumberReading } from './nominal-number.mjs';
import { namedTargetReading } from './target-names.mjs';
import { catalogIssues } from './catalog.mjs';
import { frameSupport } from './language-frames.mjs';
import { contextScores } from './context.mjs';
import { prologWorker } from './prolog-worker.mjs';
import { requestScope } from './request-scope.mjs';
import { sceneParts } from './scene-parts.mjs';
import { guardedPropertyReadings } from './guarded-properties.mjs';
import { createRelationKeyResolver } from './relation-keys.mjs';
import { createInstanceReferenceReader } from './instance-references.mjs';
import { signatures } from './signatures.mjs';
import { tokens } from './lexicon.mjs';
import { literalRoleCandidates, maskQuoted, quotedSpans } from './literal-roles.mjs';
import { namedArgumentCandidates } from './named-arguments.mjs';
import { clausePrefixes, composableWires, composeParts, coordinationActs, createPreservation, enumeratedParts, sequenceParts, visibleTokens } from './composition.mjs';
import { constraintGrounder, evidenceInText, valueResolver } from './grounding.mjs';
import { createTransfer } from './transfer.mjs';
import { loadWorlds } from './worlds.mjs';
import { parse, validate } from './schema.mjs';

const conditionalScope = Symbol('conditional scope');

function add(map, key, item) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(item);
}

const valueOf=(wire,key)=>{
  const raw=wire.attrs[key]?.[0];
  return raw?.startsWith('"') ? JSON.parse(raw) : raw;
};

function spatialOverlap(hits,chars,ts) {
  const markers=hits.filter(([, , [role,,slot,relation]])=>
    role==='marker' && relation && ['spatial','place'].includes(slot));
  const byEnd=new Map(), byPropertyEnd=new Map();
  const previousEnd=new Map(ts.slice(1).map((token,i)=>[token[2],ts[i][3]]));
  for (const marker of markers) add(byEnd,marker[1],marker);
  for (const hit of hits) {
    if (hit[2][0]==='constraint' && typeof hit[2][3]==='string' && hit[2][3].includes('key_words='))
      add(byPropertyEnd,hit[1],hit);
  }
  const omitted=new Set(), evidence=[];
  for (const longer of markers) {
    const [start,end,[,license,slot]]=longer;
    for (const [boundary,,[,shortLicense,shortSlot,relation]] of byEnd.get(end)) {
      if (boundary<=start || shortLicense!==license || shortSlot!==slot) continue;
      for (const [propertyStart,,[,,family,body]] of byPropertyEnd.get(previousEnd.get(boundary)) ?? []) {
        if (propertyStart>=start) continue;
        const [property]=parse('@p w.request.constraint '+body);
        const key=valueOf(property,'attribute'), value=valueOf(property,'value');
        if (!key || !value || valueOf(property,'operator')!=='eq' || valueOf(property,'on')!=='attribute' ||
            !valueOf(property,'key_words') || property.attrs.want) continue;
        omitted.add(longer);
        evidence.push({family,key,value,relation,marker:chars.slice(boundary,end).join('')});
      }
    }
  }
  if (!omitted.size) return;
  return {hits:hits.filter(hit=>!omitted.has(hit)),evidence};
}

function keepsSpatialOverlap(sop,evidence) {
  const wires=parse(sop), constraints=wires.filter(w=>w.type==='w.request.constraint');
  return evidence.some(({family,key,value,relation,marker})=>wires.some(target=>
    target.type==='w.request.target' && valueOf(target,'family')===family &&
    constraints.some(field=>valueOf(field,'request')===valueOf(target,'request') &&
      valueOf(field,'attribute')===key && valueOf(field,'value')===value) &&
    constraints.some(field=>valueOf(field,'request')===valueOf(target,'request') &&
      valueOf(field,'relation')===relation && valueOf(field,'words')?.startsWith(marker+' '))));
}

// The index eliminates impossible candidates. Prolog unifies the full pattern,
// binds the raw input spans and orders the resulting circuits.
export function createFormaliser(model = {version:1,examples:[],templates:[]}, worlds = loadWorlds(), {languageFrames=true} = {}) {
  if (model.version !== 1) throw Error('Unsupported model version');
  const modes=new Map();
  for (const [key,mode] of Object.entries(model.predicateModes ?? {})) {
    const [surface,act,family]=JSON.parse(key);
    add(modes,surface,[act,family,mode]);
  }
  const pairGrammars=[worlds.openPairs,model.openPairs].filter(Boolean);
  const openPairHeads=new Set(pairGrammars.flatMap(grammar=>
    Object.values(grammar).flatMap(frames=>frames.map(f=>f.prefix[0]))));
  const phraseHeads=new Set(Object.keys(model.nominalPhrases ?? {}).map(k=>JSON.parse(k)[3]));
  const knownModifiers=new Set(Object.keys(model.modifiers ?? {}).map(k=>JSON.parse(k)[1]));
  const appositiveSelector=createAppositiveSelectorReader(model,worlds);
  const topicGrammar=createTopicCommands(model,worlds);
  const predicateTransfer=createPredicateTransfer(model.examples,worlds);
  const nearExample = createNearExample(model.examples,{discourse:worlds.discourse,worlds});
  const closedKeys=new Map();
  for (const {family,name,values} of worlds.requestKeys) {
    if (!values.length) continue;
    const key=JSON.stringify([family,name]), bank=closedKeys.get(key) ?? new Set();
    for (const value of values) bank.add(value);
    closedKeys.set(key,bank);
  }
  const transfer = createTransfer(model.examples, {
    propertyLabels:worlds.ownerPropertyLabels,requestKeys:worlds.requestKeys,joiners:worlds.joiners,
    resolveValue:valueResolver(worlds,model.lexicon,model.forms), fillerPhrases:worlds.discourse,
    typedSlot(field,value) {
      if (field.key==='sort') return true;
      const bank=closedKeys.get(JSON.stringify([field.family,field.attribute]));
      return field.key==='value' && !field.open && bank?.has(field.value) &&
        (value===undefined || bank.has(value));
    },
    determiners:worlds.determiners,
  });
  const targetRoles=[...new Set(worlds.languageFrames.bindings.filter(b=>b.type==='w.request.target').map(b=>b.role))];
  const verbIndex=verbEffectIndex(worlds,model.verbEffects);
  const ground = constraintGrounder();
  const resolveRelationKeys = createRelationKeyResolver(worlds);
  const compounds=createCompoundReferenceReader(worlds);
  const endpoints=createEndpointReferenceReader(worlds);
  const instanceReferences = createInstanceReferenceReader(worlds);
  const preservation = createPreservation(model.examples,worlds,model.lexicon);
  const sequenceOptions = {
    isAct:coordinationActs(worlds,model.lexicon),
    isPreservation:preservation.recognises,
    prefixes:clausePrefixes([...(worlds.literalGrammar?.leads ?? []),
      ...(worlds.discourse ?? []).filter(({class:kind})=>kind==='politeness' || kind==='interjection').map(({text})=>text)]),
  };
  function admissibleKey(text, sop) {
    if (!sop || !validate(sop,worlds) || !evidenceInText(text,sop,worlds)) return;
    const wires = parse(sop);
    if (catalogIssues(wires,worlds).length) return;
    return JSON.stringify(signatures(wires,true));
  }
  const examples = new Map(), buckets = new Map(), frequencies = new Map();
  for (const example of model.examples) add(examples, example.text, example);
  for (const t of model.templates) {
    for (const literal of new Set(t.pattern.filter(x => typeof x === 'string'))) {
      frequencies.set(literal, (frequencies.get(literal) ?? 0) + 1);
    }
  }
  for (const template of model.templates) {
    const literals = template.pattern.filter(x => typeof x === 'string');
    const anchor = literals.reduce((a,b) => frequencies.get(a) < frequencies.get(b) ? a : b, literals[0]);
    const min = template.pattern.reduce((n,x) => n + (x.min ?? 1), 0);
    const max = template.pattern.reduce((n,x) => n + (x.max ?? 1), 0);
    add(buckets, anchor, {min,max,template});
  }
  const classHeads = new Set([...(worlds.nominalClasses?.values() ?? [])].flatMap(forms => [...forms.keys()]));
  const numberHeads = new Set([...worlds.nominalNumbers.keys()].map(term=>term.split(' ')[0]));
  const positionHeads = new Set([...(worlds.nominalPositions?.values() ?? [])].flatMap(forms => [...forms.keys()]));
  const worker = prologWorker(new URL('../prolog/formalise.pl',import.meta.url));
  async function read(text) {
    if (typeof text !== 'string') throw Error('Expected a text string');
    const ts = tokens(text), chars = Array.from(text);
    const ambiguousTargets = [], templates = [], hits = [], determiners = [], properties = [], predicateModes=[];
    const inflectionHits = [], inflectionTargets = [];
    // A quoted label may itself contain punctuation, negation or a sequence word.
    // Its span remains available to property binding in Prolog.
    const quotes = quotedSpans(text);
    const scopeText = maskQuoted(text,quotes);
    const outside = scopeText === text ? null : new Set(tokens(scopeText).map(t => t[2]));
    const scores = contextScores(text, model.context ?? {});
    for (const anchor of new Set([undefined,...ts.map(t => t[0])])) {
      for (const {min,max,template} of buckets.get(anchor) ?? []) {
        if (min <= ts.length && ts.length <= max) templates.push(template);
      }
    }
    for (let i=0; i<ts.length; i++) {
      let words = '';
      for (let j=i; j<ts.length && j<i+8; j++) {
        if (outside && !outside.has(ts[j][2])) break;
        words += (j===i?'':' ') + ts[j][0];
        for (const property of worlds.properties(words)) properties.push([ts[i][2],ts[j][3],property]);
        if (/^(?:[0-9]+|[(:=+-])$/u.test(ts[j+1]?.[0] ?? '')) {
          for (const tuple of worlds.tuples(words)) properties.push([ts[i][2],ts[j][3],tuple]);
        }
        if (Object.hasOwn(worlds.determiners,words)) determiners.push([ts[i][2],ts[j][3],worlds.determiners[words]]);
        for (const mode of modes.get(words) ?? []) predicateModes.push([ts[i][2],ts[j][3],...mode]);
        const learned = Object.hasOwn(model.lexicon ?? {},words) ? model.lexicon[words] : [];
        const local = new Set(learned.map(e => JSON.stringify(e.slice(0,-1))));
        const declared = worlds.lookup(words);
        const families = new Set(declared.filter(e=>e[0]==='target').map(e=>e[2]));
        if (!families.size && !learned.some(([role]) => role === 'target')) {
          const senses = worlds.nominalInflection(words, worlds.lookup);
          for (const entry of senses) {
            inflectionHits.push([ts[i][2],ts[j][3],entry,0]);
            inflectionTargets.push([entry[2],entry[4],chars.slice(ts[i][2],ts[j][3]).join('')]);
          }
        }
        if (families.size>1) ambiguousTargets.push([ts[i][2],ts[j][3], [...families]]);
        const bindings = declared.filter(e => !local.has(JSON.stringify(e.slice(0,-1))));
        for (let entry of [...learned,...bindings]) {
          const [role,a,b] = entry;
          if (role === 'act' && Object.hasOwn(worlds.determiners,words) && !Object.hasOwn(worlds.lexicon,words)) continue;
          if (role === 'constraint') {
            if (Object.hasOwn(worlds.determiners,words)) continue;
            entry = ground(entry,chars.slice(ts[i][2],ts[j][3]).join(''));
            if (!entry) continue;
          }
          const prior = role === 'act' ? scores['act:' + a + '/' + b] ?? 0 : 0;
          hits.push([ts[i][2],ts[j][3],entry,prior]);
        }
      }
    }
    const scope = requestScope(text,scopeText,worlds,hits);
    hits.push(...scope.intentHits);
    const allowConstraints = scope.windows.length > 0;
    const exact = examples.get(text) ?? [];
    const transfers = exact.length ? [] : transfer(text);
    const language = languageFrames ? worlds.languageFrames.prepare(ts,quotes,worlds) : {length:ts.length,events:[],frames:[]};
    const topicCommands=scope.restricted ? undefined : topicCommandPacket(text,ts,quotes,worlds,topicGrammar);
    const propertyCommands=scope.restricted || quotes.length ? undefined : propertyCommandPacket(text,ts,model.propertyCommands);
    const argumentSequences=scope.restricted || quotes.length ? [] : sequencePacket(ts,worlds);
    const memberActions=scope.restricted ? [] : memberActionPackets(text,ts,quotes,worlds);
    const coordinatedEffects=scope.restricted || quotes.length ? undefined : coordinatedPacket(ts,worlds,model.lexicon);
    const verbEffects=scope.restricted || quotes.length ? [] : [...new Set(ts.map(t=>t[0]))].flatMap(head=>verbIndex.get(head) ?? []);
    const nativeProperties=nativePropertyPacket(text,ts,quotes,worlds,{questionsOnly:scope.restricted});
    const titleConnectors = ts.map(([key])=>key).filter(key=>worlds.evidenceVocabulary.grammar.has(key));
    const request = {text,topicCommands,titleConnectors,nativeProperties,verbEffects,coordinatedEffects,memberActions,argumentSequences,propertyCommands,predicateModes,scopes:scope.windows,language,targetRoles,ambiguousTargets,allowConstraints,tokens:ts,templates,hits,examples:exact,transfers,determiners,properties};
    const candidates = [], seen = new Set();
    function retain(answer) {
      const key = admissibleKey(text,answer.sop);
      if (key && scope.restricted && !scope.permits(parse(answer.sop))) return;
      if (key && !seen.has(key)) { seen.add(key); candidates.push(answer); }
    }
    for (const candidate of namedArgumentCandidates(text,ts,quotes,worlds,sequenceOptions)) retain(candidate);
    for (const candidate of literalRoleCandidates(text,ts,quotes,worlds)) retain(candidate);
    const contextualTargets = [];
    const response = await worker.request(request);
    for (const answer of response.candidates) {
      if (answer.source !== 'lexicon') { retain(answer); continue; }
      const {operationMode,...plain}=answer;
      const lexical = {...plain,sop:resolveRelationKeys(answer.sop)};
      retain(lexical);
      if (operationMode) retain({...lexical,sop:lexical.sop.replace(/^(.*w\.request\.request[^\n]*)/u,
        line=>line+' mode='+operationMode)});
      for (const attachment of literalAttachments(text,lexical,worlds)) retain(attachment);
      const named = namedTargetReading(text,lexical,worlds);
      if (named) retain(named);
      for (const sop of resolveRelationKeys.targetlessAlternatives(answer.sop)) {
        contextualTargets.push({...plain,sop});
      }
    }
    // The ordinary search prefers a longer marker. If its prefix also
    // finishes a grounded property, try the native suffix marker separately.
    const competing=allowConstraints && !scope.restricted && spatialOverlap(hits,chars,ts);
    if (competing) {
      const alternative=await worker.request({...request,hits:competing.hits,
        templates:[],examples:[],transfers:[],argumentSequences:[],propertyCommands:undefined,
        coordinatedEffects:undefined,verbEffects:[]});
      for (const answer of alternative.candidates) {
        if (answer.source!=='lexicon' || !keepsSpatialOverlap(answer.sop,competing.evidence)) continue;
        const {operationMode:_mode,...candidate}=answer;
        retain({...candidate,sop:resolveRelationKeys(candidate.sop)});
      }
    }
    for (const reading of nativePropertyReadings(text,response.nativeProperties ?? [])) retain(reading);
    if (!scope.restricted) {
      for (const candidate of compounds(text,ts,quotes)) retain(candidate);
      for (const candidate of endpoints(text,ts,quotes)) retain(candidate);
      for (const reading of affectedTargetCandidates(text,ts,quotes,worlds)) retain(reading);
      for (const reading of directionalResultCandidates(text,ts,quotes,worlds)) retain(reading);
      for (const reading of transformationReadings(text,ts,quotes,worlds)) retain(reading);
      for (const reading of ownedEffectReadings(text,worlds)) retain(reading);
      for (const reading of quantifiedVerbReadings(text,worlds)) retain(reading);
      for (const reading of ownerPropertyReadings(text,ts,quotes,worlds)) retain(reading);
    }
    for (const candidate of instanceReferences(text,ts,quotes,hits)) retain(candidate);
    // Family hypotheses for pronouns follow the text's own readings. The
    // independent estimator can promote one when there is supporting context.
    for (const candidate of contextualTargets) retain(candidate);
    // Add independent constructions after the ranked Prolog proposals so that
    // a new surface form cannot evict an older reading from its bounded search.
    if (!scope.restricted) for (const candidate of predicateTransfer(text)) retain(candidate);
    if (!exact.length) for (const candidate of nearExample(text)) retain({...candidate,source:'near-example'});
    for (const candidate of postfixSetQuestions(text,ts,worlds,hits,quotes)) retain(candidate);
    if (!scope.restricted && ts.some(t=>worlds.scopeGrammar.universalHeads.has(t[0]))) {
      for (const candidate of [...candidates]) {
        const universal=universalTargetReading(text,ts,worlds,candidate,quotes);
        if (universal) retain(universal);
      }
    }
    if (!scope.restricted && ts.some(t=>knownModifiers.has(t[0]))) {
      for (const candidate of [...candidates]) {
        const modified=modifierReading(text,ts,quotes,candidate,model.modifiers);
        if (modified) retain(modified);
      }
    }
    if (!scope.restricted && worlds.nominalScales?.byFamily.size) {
      for (const candidate of [...candidates]) {
        const reading=nominalScaleReading(text,ts,quotes,candidate,worlds);
        if (reading) retain(reading);
      }
    }
    if (ts.some(t=>numberHeads.has(t[0]) || /^\d+$/u.test(t[0]))) {
      for (const candidate of [...candidates]) {
        const qualified=nominalNumberReading(text,candidate,worlds.nominalNumbers,quotes,model.modifiers);
        if (qualified) retain(qualified);
      }
    }
    if (!scope.restricted && ts.some(t=>phraseHeads.has(t[0]))) {
      for (const candidate of [...candidates]) {
        for (const reading of nominalPhraseReadings(text,ts,quotes,candidate,model.nominalPhrases,worlds)) retain(reading);
      }
    }
    if (!scope.restricted && ts.some(t=>openPairHeads.has(t[0]))) {
      for (const candidate of [...candidates]) {
        for (const grammar of pairGrammars) {
          for (const reading of openPairReadings(text,ts,quotes,candidate,grammar,worlds)) retain(reading);
        }
      }
    }
    if (!candidates.some(candidate => candidate.source !== 'lexicon' && !candidate.unread)) {
      const offset = candidates.length;
      for (const candidate of preservation.readings(text,candidates)) retain(candidate);
      candidates.unshift(...candidates.splice(offset));
    }
    if (inflectionHits.length && !exact.length) {
      // Resolve morphology on the original text in a separate search so a
      // fallback sense cannot replace an existing proposal in the beam.
      const extended = await worker.request({...request, hits:[...hits,...inflectionHits],
        templates:[], transfers:[], examples:[]});
      for (const answer of extended.candidates) {
        const sop = resolveRelationKeys(answer.sop);
        const used = parse(sop).some(wire => {
          if (wire.type !== 'w.request.target') return false;
          const value = key => {
            const raw = wire.attrs[key]?.[0];
            return raw?.startsWith('"') ? JSON.parse(raw) : raw;
          };
          return inflectionTargets.some(([family,sort,surface]) => value('family') === family &&
            (sort ? value('sort') === sort && value('sort_words') === surface : value('family_words') === surface));
        });
        if (!used) continue;
        const candidate = {...answer,sop,source:'nominal-inflection',status:'partial'};
        retain(candidate);
        const qualified = nominalNumberReading(text,candidate,worlds.nominalNumbers,quotes,model.modifiers);
        if (qualified) retain(qualified);
      }
    }
    if (!scope.restricted && worlds.fixedProperties?.has(ts[0]?.[0])) {
      for (const candidate of [undefined,...candidates]) {
        for (const reading of fixedPropertyReadings(text,ts,quotes,candidate,worlds)) retain(reading);
      }
    }
    if (!scope.restricted && ts.some(([key]) => classHeads.has(key))) {
      for (const candidate of [...candidates]) {
        const reading=nominalClassReading(text,ts,quotes,candidate,worlds);
        if (reading) retain(reading);
      }
    }
    if (!scope.restricted && ts.some(([key]) => positionHeads.has(key))) {
      for (const candidate of [...candidates]) {
        for (const reading of nativeNominalPhraseReadings(text,ts,quotes,candidate,worlds.nominalPositions,worlds)) retain(reading);
      }
    }
    if (!scope.restricted) {
      for (const candidate of [...candidates]) {
        if (candidate.sop.includes('phase=result')) {
          for (const selected of identitySelectorReadings(text,candidate,worlds)) retain(selected);
        }
      }
    }
    for (const proof of response.sequences ?? []) {
      if (proof.owned) {
        const reading=sequenceFrameReading(text,proof,analyticalOwnerBindings(text,proof,worlds));
        if (reading) retain(reading);
        continue;
      }
      for (const candidate of [...candidates]) {
        const reading=sequenceReading(text,candidate,proof);
        if (reading) retain(reading);
      }
    }
    if (!scope.restricted && ts.some(([key])=>/\d/u.test(key) || worlds.nominalNumbers.has(key))) {
      for (const candidate of [...candidates]) for (const reading of numberedQualifierReadings(text,candidate,worlds)) retain(reading);
    }
    if (response.verbEffects?.length) {
      const owners=candidates.slice();
      for (const proof of response.verbEffects) for (const candidate of owners) {
        const reading=verbEffectReading(text,candidate,proof);
        if (reading) retain(reading);
      }
    }
    for (const proof of response.topicCommands ?? []) retain(topicCommandReading(text,proof));
    for (const proof of response.coordinatedEffects ?? []) retain(effectReading(text,ts,proof));
    for (const reading of memberActionReadings(text,response.memberActions ?? [],worlds)) retain(reading);
    if (!candidates.length) return {status:'unresolved',sop:'',unread:text,alternatives:[],[conditionalScope]:scope.preventsSplitting};
    if (response.proofs.length) {
      for (const c of candidates) {
        const proof=frameSupport(parse(c.sop),response.proofs,ts,text,worlds);
        if (proof) c.language=proof;
      }
      // Exact examples, complete templates and special constructions retain
      // their source priority. Break ties between lexical fallback readings.
      const lexical=candidates.filter(c=>c.source==='lexicon');
      const fit=c=>c.language?.conflicts.length ? -1 : c.language?.discriminating ? 1 : 0;
      lexical.sort((a,b)=>fit(b)-fit(a));
      let i=0;
      for (let j=0;j<candidates.length;j++) if (candidates[j].source==='lexicon') candidates[j]=lexical[i++];
    }
    const [best,...alternatives] = candidates;
    return {...best,status:best.status ?? (best.source === 'lexicon' || best.unread ? 'partial' : 'matched'),alternatives,[conditionalScope]:scope.preventsSplitting};
  }
  function combine(text, parts, results, enumeration) {
    let beam = [{cost:0,clauses:[]}];
    const coverageChoice = [];
    for (const [index,result] of results.entries()) {
      const {alternatives,[conditionalScope]:_conditional,...first} = result;
      const targets = enumeration?.items[index];
      const item = targets && {act:enumeration.act,predicate:enumeration.predicate,targets};
      // Discard non-composable readings before they can occupy the beam.
      // Original rank and clause order still break ties between usable readings.
      const options = [first,...alternatives].flatMap((clause,rank)=>{
        const wires = composableWires(clause,item);
        if (!wires) return [];
        const unread = wires.filter(w=>w.type==='w.request.unread')
          .flatMap(w=>w.attrs.text ?? [])
          .reduce((sum,raw)=>sum+tokens(raw.startsWith('"') ? JSON.parse(raw) : raw).length,0);
        return [{clause,rank,unread}];
      });
      if (!options.length) return [];
      coverageChoice.push(options.reduce((a,b)=>b.unread<a.unread ? b : a).clause);
      const next = beam.flatMap(prefix => options.map(({clause,rank}) =>
        ({cost:prefix.cost+rank,clauses:[...prefix.clauses,clause]})));
      beam = next.sort((a,b)=>a.cost-b.cost).slice(0,12);
    }
    const readings = [];
    const seen = new Set();
    // An independently complete reading of each clause can fall outside the
    // rank-sum beam. Keep that combination too; validation and deduplication follow.
    for (const {clauses} of [...beam,{clauses:coverageChoice}]) {
      const sop = composeParts(parts,clauses,enumeration);
      const key = admissibleKey(text,sop);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      readings.push({sop,source:enumeration?'enumeration':'sequence',
        status:enumeration?.prefix || clauses.some(c=>c.status==='partial' || c.source==='lexicon' || c.unread) ? 'partial' : 'matched',
        parts:parts.map((text,i)=>({text,source:clauses[i].source}))});
    }
    return readings;
  }
  function mergeReadings(base, readings, preferBase) {
    if (!readings.length) return base;
    const {alternatives,...single} = base;
    const ordered = preferBase ? [single,...readings,...alternatives] : [...readings,single,...alternatives];
    const seen = new Set();
    const [best,...rest] = ordered.filter(candidate => {
      if (!candidate.sop) return false;
      const key = JSON.stringify(signatures(parse(candidate.sop),true));
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return {...best,alternatives:rest};
  }
  const enumerationPlans = (text,ts = tokens(text)) => {
    const options={...sequenceOptions,learned:model.lexicon,visible:visibleTokens(Array.from(text),ts)};
    const scene=sceneParts(text,ts,worlds,options);
    const enumeration=enumeratedParts(text,ts,worlds,{prefixes:sequenceOptions.prefixes,learned:model.lexicon});
    const plans=enumeration ? (scene?.prefix ? [enumeration,scene] : [enumeration]) : (scene ? [scene] : []);
    if (model.sceneConstructs) {
      const extra=sceneParts(text,ts,worlds,{...options,constructs:model.sceneConstructs});
      if (extra && !plans.some(p=>JSON.stringify(p)===JSON.stringify(extra))) plans.push(extra);
    }
    return plans;
  };
  async function readEnumeration(text, base, plans) {
    if (!plans.length || base[conditionalScope]) return base;
    const readings = [], inputs = new Map();
    for (const plan of plans) {
      const results = [];
      for (const input of plan.inputs) {
        if (!inputs.has(input)) inputs.set(input,await read(input));
        results.push(inputs.get(input));
      }
      if (plan.singleNominal) {
        const [{alternatives,...first}]=results;
        const item={act:plan.act,predicate:plan.predicate,targets:plan.items[0]};
        const [article,articleText]=tokens(text)[0];
        const determiner=worlds.determiners[article];
        const projected=(choice,predicate)=>composableWires(choice,{...item,predicate});
        const options=[first,...alternatives].map(choice=>projected(choice,item.predicate));
        // A bare quantity has no written verb. The nominal plan supplies the
        // kind and action; every word still needs independent evidence below.
        if (plan.quantity) {
          const ts=tokens(text), length=tokens(plan.quantity).length, chars=Array.from(text);
          for (const target of item.targets) {
            if (target.start!==length || ts.slice(target.end).some(([key])=>key!=='.' && key!=='!')) continue;
            const noun=chars.slice(ts[target.start][2],ts[target.end-1][3]).join('');
            const semanticHead=target.sort ? 'sort='+JSON.stringify(target.sort)+' sort_words=' : 'family_words=';
            options.push(parse('@r w.request.request act=make mood=do\n@t w.request.target request=$r mode=new family='+
              JSON.stringify(target.family)+' '+semanticHead+JSON.stringify(noun)+' quantity='+JSON.stringify(plan.quantity)+
              ' count_words='+JSON.stringify(plan.quantity)));
          }
          for (const choice of [base,...base.alternatives]) {
            if (!choice.sop || !choice.sop.includes('quantity=')) continue;
            const root=parse(choice.sop).find(w=>w.type==='w.request.request');
            if (root) options.push(projected(choice,valueOf(root,'predicate')));
          }
        }
        for (const wires of options) {
          if (!wires || wires.some(w=>['w.request.previous','w.request.clock','w.request.context'].includes(w.type))) continue;
          const req=wires.find(w=>w.type==='w.request.request');
          delete req.attrs.predicate;
          delete req.attrs.words;
          const target=wires.find(w=>w.type==='w.request.target');
          if (plan.quantity) {
            if (valueOf(target,'quantity')!==plan.quantity || target.attrs.count) continue;
            target.attrs.determiner=['quantified'];
          } else {
            if (valueOf(target,'determiner') && valueOf(target,'determiner')!==determiner) continue;
            target.attrs.determiner=[determiner];
          }
          const retained=wires.filter(w=>w.type!=='w.request.unread' ||
            valueOf(w,'text')!==articleText);
          const proof=evidenceReport(text,retained,worlds.evidenceVocabulary);
          if (proof.missing.length || proof.counts.uncovered || proof.counts.unread) continue;
          const sop=serialize(retained);
          if (admissibleKey(text,sop)) readings.push({sop,source:'nominal-creation',status:'matched'});
        }
        continue;
      }
      const headings=plan.prefix ? transfer.sceneHeadings(plan.prefix,plan.headingRole) : [];
      if (headings.length) {
        const [first,...alternatives]=headings;
        const parts=[plan.prefix,plan.firstObject,...plan.parts.slice(1)];
        const grounded={...plan,prefix:undefined,items:[null,...plan.items]};
        readings.push(...combine(text,parts,[{...first,alternatives},...results],grounded));
      }
      readings.push(...combine(text,plan.parts,results,plan));
    }
    return mergeReadings(base,readings,base.status==='matched');
  }
  async function formalise(text) {
    const base = await read(text);
    if (base[conditionalScope]) {
      const guarded = await guardedPropertyReadings(text,worlds,read);
      return mergeReadings(base,guarded.filter(candidate=>admissibleKey(text,candidate.sop)),base.status==='matched');
    }
    const ts = tokens(text);
    const parts = sequenceParts(text,ts,worlds.joiners,sequenceOptions);
    if (!parts.length) return readEnumeration(text,base,enumerationPlans(text,ts));
    const plans = parts.map(part=>enumerationPlans(part));
    // A complete existing sequence can preserve dependencies that separate
    // lexical reads do not currently resolve.
    const complete = base.status==='matched' &&
      parse(base.sop).filter(w=>w.type==='w.request.request').length>=parts.length;
    // A matching request count does not establish that all arguments were bound.
    const plain = [], results = [];
    for (const [index,part] of parts.entries()) {
      const ordinary = await read(part);
      const result = await readEnumeration(part,ordinary,plans[index]);
      if (!result.sop) return base;
      plain.push(ordinary);
      results.push(result);
    }
    const readings = combine(text,parts,results);
    if (!results.some(r=>r[conditionalScope])) {
      for (const reading of sequenceNameReadings(parts,results,worlds,sequenceOptions)) {
        if (admissibleKey(text,reading.sop)) readings.push(reading);
      }
    }
    if (results.some((result,index)=>result!==plain[index])) readings.push(...combine(text,parts,plain));
    return mergeReadings(base,readings,
      complete || base.status==='matched' && results.some(r=>r.status!=='matched'));
  }
  async function wrapped(text) {
    const base=await formalise(text);
    const {alternatives,[conditionalScope]:conditional,...first}=base;
    const candidates=first.sop ? [first,...alternatives] : [];
    const bodies=languageFrames ? alternateBodies(text,worlds.alternations) : [];
    if (!bodies.length || conditional) return candidates;
    const seen=new Set(candidates.map(c=>JSON.stringify(signatures(parse(c.sop),true))));
    for (const body of bodies) {
      const {alternatives,...head}=await formalise(body.text);
      const boundaries=sequenceParts(body.text,tokens(body.text),worlds.joiners,sequenceOptions);
      for (const choice of [head,...alternatives]) {
        if (!choice.sop || choice.sop.includes(' w.request.unread ')) continue;
        const wires=parse(choice.sop), requests=wires.filter(w=>w.type==='w.request.request');
        if (!requests.length || requests.length<boundaries.length ||
            requests.length>1 && requests.some(r=>!r.attrs.words)) continue;
        const [request]=requests;
        if (body.mode==='question' && !['ask','check'].includes(request.attrs.mood?.[0]) && request.attrs.act?.[0]!=='ask') continue;
        const evidence=evidenceReport(body.text,wires,worlds.evidenceVocabulary);
        if (evidence.missing.length || evidence.counts.uncovered) continue;
        if (requests.length===1) request.attrs.words=[JSON.stringify(text)];
        const sop=serialize(wires);
        const key=admissibleKey(text,sop);
        if (key && !seen.has(key)) {
          seen.add(key);
          candidates.push({sop,status:choice.status,source:'language-alternation'});
        }
      }
    }
    return candidates;
  }
  return {
    async formalise(text) {
      const candidates=await wrapped(text);
      const reason=discourseReason(text,worlds);
      if (reason) {
        const seen=new Set(candidates.map(c=>JSON.stringify(signatures(parse(c.sop),false))));
        const steps=sequenceParts(reason.body,tokens(reason.body),worlds.joiners,sequenceOptions);
        for (const candidate of await wrapped(reason.body)) {
          if (steps.length && parse(candidate.sop).filter(w=>w.type==='w.request.request').length<steps.length) continue;
          const reading=discourseReasonReading(reason,candidate);
          const key=reading && admissibleKey(text,reading.sop) && JSON.stringify(signatures(parse(reading.sop),false));
          if (key && !seen.has(key)) {seen.add(key);candidates.push(reading);}
        }
      }
      const body=discourseBody(text,worlds.trailingDiscourse);
      if (body) {
        const seen=new Set(candidates.map(c=>JSON.stringify(signatures(parse(c.sop),true))));
        const steps=sequenceParts(body.text,tokens(body.text),worlds.joiners,sequenceOptions);
        for (const candidate of await wrapped(body.text)) {
          const wires=parse(candidate.sop);
          if (steps.length>wires.filter(w=>w.type==='w.request.request').length) continue;
          let id='courtesy';
          while (wires.some(w=>w.id===id)) id+='_';
          wires.push({id,type:'w.request.filler',attrs:{text:[JSON.stringify(body.suffix)]}});
          const sop=serialize(wires),key=admissibleKey(text,sop);
          if (key && !seen.has(key)) {
            seen.add(key);candidates.push({sop,status:candidate.status,source:'trailing-discourse'});
          }
        }
      }
      const retained=preservationAdjunct(text,worlds);
      if (retained && !requestScope(text,maskQuoted(text,quotedSpans(text)),worlds,[]).restricted) {
        const seen=new Set(candidates.map(c=>JSON.stringify(signatures(parse(c.sop),true))));
        const steps=sequenceParts(retained.body,tokens(retained.body),worlds.joiners,sequenceOptions);
        const bodyReadings=await wrapped(retained.body);
        for (const base of [...bodyReadings,...candidates]) {
          if (steps.length && parse(base.sop).filter(w=>w.type==='w.request.request').length<steps.length) continue;
          const reading=preservationAdjunctReading(text,retained,base,worlds);
          const key=reading && admissibleKey(text,reading.sop);
          if (key && !seen.has(key)) {seen.add(key);candidates.push(reading);}
        }
      }
      const permit=(words,quotes)=>
        !requestScope(words,maskQuoted(words,quotes),worlds,[]).restricted;
      const qualify=clauseQualifiers(text,worlds,model,permit);
      const additional=new Map();
      for (const candidate of candidates) {
        if (!candidate.sop.includes(' words=') || candidate.sop.indexOf(' w.request.request')===
            candidate.sop.lastIndexOf(' w.request.request')) continue;
        const enriched=qualify(candidate);
        if (enriched) {
          const key=admissibleKey(text,enriched.sop);
          if (key) additional.set(key,enriched);
        }
      }
      const sourceTokens=tokens(text), sourceQuotes=quotedSpans(text);
      const scaleBanks=[...worlds.nominalScales.byFamily.values()];
      if (sourceTokens.some(([key])=>scaleBanks.some(bank=>bank.forms.has(key))) && permit(text,sourceQuotes)) {
        const options={splitCompounds:true};
        const distinctModifiers=clauseQualifiers(text,worlds,model,permit,options);
        for (const candidate of [...candidates,...additional.values()]) {
          // Add a competing attachment after ordinary composition, so the
          // full reading of a lexical compound remains available as well.
          const single=candidate.sop.indexOf(' w.request.request')===candidate.sop.lastIndexOf(' w.request.request');
          const reading=single ? nominalScaleReading(text,sourceTokens,sourceQuotes,candidate,worlds,options) :
            distinctModifiers(candidate);
          const key=reading && admissibleKey(text,reading.sop);
          if (key) additional.set(key,reading);
        }
      }
      for (const candidate of [...candidates,...additional.values()]) {
        if (candidate.sop.indexOf(' w.request.request')===candidate.sop.lastIndexOf(' w.request.request')) continue;
        for (const reading of sequenceReferenceReadings(text,candidate,worlds,permit)) {
          const key=admissibleKey(text,reading.sop);
          if (key) additional.set(key,reading);
        }
      }
      for (const candidate of [...candidates,...additional.values()]) {
        for (const reading of spatialAnchorReadings(text,candidate,worlds,permit)) {
          const key=admissibleKey(text,reading.sop);
          if (key) additional.set(key,reading);
        }
      }
      if (text.includes(',') && worlds.appositiveSelectors.bindings.length) {
        for (const candidate of [...candidates,...additional.values()]) {
          const reading=appositiveSelector(text,candidate,permit);
          const key=reading && admissibleKey(text,reading.sop);
          if (key) additional.set(key,reading);
        }
      }
      if (worlds.postposedClauses.bindings.length) {
        for (const candidate of [...candidates,...additional.values()]) {
          for (const reading of postposedClauseReadings(text,candidate,worlds,permit)) {
            const key=admissibleKey(text,reading.sop);
            if (key) additional.set(key,reading);
          }
        }
      }
      if (worlds.orientationLandmarks.bindings.length) {
        for (const candidate of [...candidates,...additional.values()]) {
          for (const reading of orientationLandmarkReadings(text,candidate,worlds,permit)) {
            const key=admissibleKey(text,reading.sop);
            if (key) additional.set(key,reading);
          }
        }
      }
      if (quotedSpans(text).length) {
        for (const candidate of [...candidates,...additional.values()]) {
          const reading=quotedLiteralCleanup(text,candidate,worlds);
          const key=reading && admissibleKey(text,reading.sop);
          if (key) additional.set(key,reading);
        }
      }
      if (worlds.reciprocal) {
        for (const candidate of [...candidates,...additional.values()]) {
          const reading=reciprocalReading(text,candidate,worlds);
          const key=reading && admissibleKey(text,reading.sop);
          if (key) additional.set(key,reading);
        }
      }
      if (additional.size) {
        for (const candidate of candidates) additional.delete(JSON.stringify(signatures(parse(candidate.sop),true)));
        candidates.push(...additional.values());
      }
      return {candidates,candidateCount:candidates.length,multipleInterpretations:candidates.length>1,
        ...(!candidates.length ? {unread:text} : {})};
    },
    close:worker.close
  };
}
