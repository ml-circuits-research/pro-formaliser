import {catalogIssues} from './catalog.mjs';
import {visibleTokens} from './composition.mjs';
import {evidenceInText} from './grounding.mjs';
import {tokens} from './lexicon.mjs';
import {quotedSpans} from './literal-roles.mjs';
import {parse,validate} from './schema.mjs';
import {serialize,str} from '../.cache/knowledge/tools/sopworld/sopworld.mjs';

const terminal=new Set(['.','?','!']);
const requestType='w.request.request';
const targetType='w.request.target';
const constraintType='w.request.constraint';
const unreadType='w.request.unread';
const one=(wire,key)=>str(wire.attrs[key]?.[0]);
const word=/[\p{L}\p{N}]/u;

function boundedSentences(text) {
  const chars=Array.from(text), ts=tokens(text);
  const visible=visibleTokens(chars,ts);
  const parts=[];
  let start=0;
  for (let i=0;i<visible.length-1;i++) {
    const mark=visible[i];
    if (!terminal.has(mark)) continue;
    const [, ,at,end]=ts[i];
    if (!/\s/u.test(chars[end] ?? '')) continue;
    // Initials and short dotted identifiers are not independent sentences.
    if (mark==='.' && ts[i-1]?.[3]===at &&
        (/^\p{L}$/u.test(ts[i-1][1]) || ts[i-2]?.[0]==='.' && ts[i-2][3]===ts[i-1][2])) continue;
    const part=chars.slice(start,end).join('').trim();
    if (!word.test(part)) return [];
    parts.push(part);
    if (parts.length===3) return [];
    start=end;
  }
  if (!parts.length) return [];
  const tail=chars.slice(start).join('').trim();
  return word.test(tail) ? [...parts,tail] : [];
}

function credible(text,candidate,worlds) {
  if (!candidate?.sop) return;
  const wires=parse(candidate.sop);
  const requests=wires.filter(wire=>wire.type===requestType);
  const targets=wires.filter(wire=>wire.type===targetType);
  if (requests.length!==1 || targets.length!==1) return;
  const [request]=requests,[target]=targets, ref='$'+request.id;
  if (one(target,'request')!==ref || !one(target,'family') || !one(target,'mode')) return;
  const act=one(request,'act');
  if (!act || !worlds.literalGrammar.licenses(one(target,'family'),act)) return;
  const constraints=wires.filter(wire=>wire.type===constraintType && one(wire,'request')===ref);
  const result=constraints.some(wire=>one(wire,'phase')==='result' && !one(wire,'want'));
  if (act==='ask') {
    if (!one(request,'asked') && !one(request,'question') && !constraints.length) return;
  } else if (!result && (act==='change' || !one(request,'predicate') ||
      !['name','description','sort','ids'].some(key=>one(target,key)))) return;
  if (wires.some(wire=>wire.type==='w.request.previous' || wire.type===unreadType &&
      tokens(one(wire,'text') ?? '').some(([key])=>word.test(key) &&
        !Object.hasOwn(worlds.determiners,key) && !worlds.evidenceVocabulary.filler.has(key)))) return;
  if (catalogIssues(wires,worlds).length || !evidenceInText(text,candidate.sop,worlds)) return;
  return wires;
}

function remap(wires,prefix,text) {
  const ids=new Map(wires.map(wire=>[wire.id,prefix+wire.id]));
  if (wires.some(wire=>Object.values(wire.attrs).flat().some(value=>value.startsWith('$') && !ids.has(value.slice(1))))) return;
  return wires.map(wire=>{
    const attrs=Object.fromEntries(Object.entries(wire.attrs).map(([key,values])=>[key,values.map(value=>
      value.startsWith('$') ? '$'+ids.get(value.slice(1)) : value)]));
    if (wire.type===requestType && !attrs.words) attrs.words=[JSON.stringify(text)];
    return {...wire,id:ids.get(wire.id),attrs};
  });
}

function alternatives(part,index,worlds) {
  const choices=[{body:part}];
  if (!index) return choices;
  const ts=tokens(part), chars=Array.from(part);
  for (let end=1;end<Math.min(ts.length,5);end++) {
    const head=ts.slice(0,end).map(([key])=>key).join(' ');
    if (!worlds.sentenceAdditions?.has(head) && !['addition','coordination','sequence'].includes(worlds.joiners[head])) continue;
    const [, ,start]=ts[end];
    choices.push({body:chars.slice(start).join(''),lead:chars.slice(0,start).join('').trim()});
  }
  return choices;
}

function fragmentSurfaces(body) {
  const alternate=body.endsWith('.') && !body.endsWith('..') ? body.slice(0,-1).trimEnd() : body;
  return alternate===body ? [body] : [body,alternate];
}

export async function combineIndependentRequests(parts,worlds,read,permit) {
  if (parts.length<2 || parts.length>3) return [];
  let beam=[[]];
  for (const [index,part] of parts.entries()) {
    const options=[];
    const seen=new Set();
    for (const {body,lead} of alternatives(part,index,worlds)) {
      if (!permit(body,quotedSpans(body))) continue;
      let candidates=await read(body);
      const surfaces=fragmentSurfaces(body);
      if (surfaces.length>1 && !candidates.some(candidate=>credible(body,candidate,worlds))) {
        candidates=await read(surfaces[1]);
      }
      for (const candidate of candidates) {
        const wires=credible(body,candidate,worlds);
        if (!wires) continue;
        const prefix='sentence'+(index+1)+'.';
        const mapped=remap(wires,prefix,body);
        if (!mapped) continue;
        const signature=serialize(mapped);
        if (seen.has(signature)) continue;
        seen.add(signature);
        if (lead) {
          let id=prefix+'lead';
          while (mapped.some(wire=>wire.id===id)) id+='_';
          mapped.unshift({id,type:'w.request.filler',attrs:{text:[JSON.stringify(lead)]}});
        }
        options.push(mapped);
        if (options.length===4) break;
      }
      if (options.length===4) break;
    }
    if (!options.length) return [];
    beam=beam.flatMap(previous=>options.map(option=>[...previous,...option])).slice(0,12);
  }
  return beam.map(wires=>serialize(wires)).filter(sop=>validate(sop,worlds))
    .map(sop=>({sop,source:'sentence-requests',status:'matched'}));
}

export async function sentenceRequestReadings(text,worlds,read,permit) {
  const parts=boundedSentences(text);
  if (!parts.length || !permit(text,quotedSpans(text))) return [];
  return combineIndependentRequests(parts,worlds,read,permit);
}
