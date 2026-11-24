import { literalRanges } from './evidence.mjs';
import { tokens } from './lexicon.mjs';

const requestType='w.request.request', targetType='w.request.target';
const constraintType='w.request.constraint';
const decode=value=>value?.startsWith('"') ? JSON.parse(value) : value;
const field=(wire,key)=>decode(wire?.attrs[key]?.[0]);
const lexical=/^[\p{L}\p{M}\p{N}_]+$/u;

function normalizedLead(visible, worlds) {
  let start=0;
  while (worlds.fillerPhrases.has(visible[start]) || ['—','–','-',','].includes(visible[start]) ||
    ['addition','sequence'].includes(worlds.joiners[visible[start]])) start++;
  return visible.slice(start).map(word=>worlds.determiners[word] ? '<'+worlds.determiners[word]+'>' : word);
}

function boundary(word,worlds) {
  if (word===':') return ':';
  if (worlds.lookup(word).some(([role,act,arg])=>role==='marker' && act==='make' && arg==='part')) return word;
}

function keyOf(words) {
  return words.join(' ');
}

export function createSceneConstructLearner(worlds) {
  const keys=new Set(worlds.requestKeys.filter(k=>k.head.split('+').includes('span') && !k.values.length).map(k=>k.name));
  const constructs=new Map();
  return {
    observe(text,wires) {
      if (text.includes('?') || !wires.some(w=>w.type===constraintType && keys.has(field(w,'attribute')))) return;
      const requests=new Map(wires.filter(w=>w.type===requestType).map(w=>['$'+w.id,w]));
      if (requests.size<2) return;
      const items=new Map();
      for (const w of wires) {
        if (w.type!==targetType || field(w,'mode')!=='new') continue;
        const ref=field(w,'request'), req=requests.get(ref);
        if (field(req,'act')!=='make' || ![undefined,'do','propose'].includes(field(req,'mood'))) continue;
        const scope=field(req,'words'), noun=field(w,'sort_words') ?? field(w,'family_words') ?? field(w,'sort');
        const scopeSpans=scope ? literalRanges(text,scope) : [];
        const nounSpans=noun && scope ? literalRanges(scope,noun) : [];
        if (scopeSpans.length!==1 || nounSpans.length!==1) continue;
        const position=scopeSpans[0][0]+nounSpans[0][0];
        items.set(ref,Math.min(position,items.get(ref) ?? Infinity));
      }
      if (items.size<2) return;
      const ts=tokens(text);
      const firstItem=Math.min(...items.values());
      const firstChar=Array.from(text.slice(0,firstItem)).length;
      for (const wire of wires) {
        if (wire.type!==constraintType || !keys.has(field(wire,'attribute')) || wire.attrs.value?.length!==1 ||
            ![undefined,'result'].includes(field(wire,'phase')) || ![undefined,'eq'].includes(field(wire,'operator')) ||
            ![undefined,'yes'].includes(field(wire,'want'))) continue;
        const req=requests.get(field(wire,'request'));
        if (!['change','make'].includes(field(req,'act')) || ![undefined,'do','propose'].includes(field(req,'mood'))) continue;
        const scope=field(req,'words'), value=field(wire,'value');
        const location=value ? literalRanges(text,value) : [];
        if (location.length!==1 && scope) {
          // A place name can reappear as a landmark. Its request scope must
          // identify a unique earlier occurrence.
          const scopes=literalRanges(text,scope);
          if (scopes.length===1) location.splice(0,location.length,...literalRanges(text,value,...scopes[0]));
        }
        if (!scope || !value || !literalRanges(scope,value).length || location.length!==1 || location[0][1]>=firstItem) continue;
        const [from,to]=location[0].map(i=>Array.from(text.slice(0,i)).length);
        const index=ts.findIndex(token=>token[2]===from);
        const end=ts.findIndex(token=>token[3]===to)+1;
        const cut=ts.findLastIndex(([word,,start])=>start>=to && start<firstChar && boundary(word,worlds));
        if (index<0 || end<=index || cut<end || ts[cut-1]?.[0]==='?') continue;
        const lead=normalizedLead(ts.slice(0,index).map(([key])=>key),worlds);
        const setting=ts.slice(index,end).map(([key])=>key);
        if (!lead.length || lead.length>8 || !lead.every(key=>lexical.test(key) || key.startsWith('<')) ||
            !setting.every(key=>lexical.test(key))) continue;
        const connector=boundary(ts[cut][0],worlds);
        const body=keyOf(ts.slice(cut+1).filter(([key])=>lexical.test(key)).map(([key])=>key));
        const id=JSON.stringify([field(wire,'attribute'),connector]);
        const record=constructs.get(id) ?? {leads:new Map(),settings:new Map()};
        if (!constructs.has(id)) constructs.set(id,record);
        for (const [table,phrase] of [[record.leads,lead],[record.settings,setting]]) {
          const key=keyOf(phrase);
          const witnesses=table.get(key) ?? new Set();
          if (!table.has(key)) table.set(key,witnesses);
          // Distinct body text prevents courtesy variants from corroborating
          // a frame on their own.
          if (witnesses.size<2) witnesses.add(body);
        }
      }
    },
    finish() {
      return [...constructs].flatMap(([id,{leads,settings}])=>{
        const accepted=table=>[...table].filter(([,sources])=>sources.size>=2).map(([key])=>key);
        const shape=accepted(leads), subjects=accepted(settings);
        if (!shape.length || !subjects.length) return [];
        const [role,connector]=JSON.parse(id);
        return [{role,connector,leads:shape,settings:subjects}];
      });
    },
  };
}

export function learnedSceneBoundary(head, worlds, constructs, nominal) {
  if (!constructs?.length || head.includes('?')) return;
  for (let end=1;end<Math.min(head.length,25);end++) {
    if (!nominal(end+1)) continue;
    const kind=boundary(head[end],worlds);
    if (!kind) continue;
    for (const {connector,leads,settings} of constructs) {
      if (connector!==kind) continue;
      for (const setting of settings) {
        const words=setting.split(' ');
        for (let begin=0;begin+words.length<=end;begin++) {
          if (!words.every((word,i)=>head[begin+i]===word)) continue;
          const left=head.slice(0,begin);
          if (left.some((word,i)=>worlds.negatives.has(word) || worlds.scopeGrammar.negatives.has(word) ||
              worlds.scopeGrammar.conditionals.has(word) || [...worlds.scopeGrammar.endings].some(ending=>
                left.slice(i,i+4).join('').endsWith(ending)))) continue;
          if (leads.includes(keyOf(normalizedLead(left,worlds)))) return end;
        }
      }
    }
  }
}
