import { serialize } from '../.cache/knowledge/tools/sopworld/sopworld.mjs';
import { literalRanges, sortRanges } from './evidence.mjs';
import { quotedSpans } from './literal-roles.mjs';
import { tokenize } from './model.mjs';
import { consumeUnread } from './nominal-evidence.mjs';
import { parse } from './schema.mjs';

const decode=value=>value?.startsWith('"') ? JSON.parse(value) : value;
const fields=(wire,key)=>(wire.attrs[key] ?? []).map(decode);
const one=(wire,key)=>fields(wire,key)[0];
const phrase=text=>tokenize(text ?? '').map(token=>token.key).join(' ');
const words=/[\p{L}\p{N}]/u;

export function compileReciprocal(facts) {
  const predicates=facts('w.relational.predicate');
  const known=new Set(predicates.map(wire=>wire.id));
  const markers=new Set(facts('pro.reader.reciprocal_marker').flatMap(wire=>fields(wire,'text').map(phrase)).filter(Boolean));
  const forms=new Map();
  for (const wire of facts('core.word')) {
    const languages=fields(wire,'lang');
    if (languages.length && !languages.some(lang=>/^en(?:[-_]|$)/iu.test(lang))) continue;
    const meanings=fields(wire,'means').filter(meaning=>known.has(meaning));
    for (const verb of fields(wire,'text').map(phrase).filter(Boolean)) {
      for (const marker of markers) {
        const form=verb+' '+marker;
        const bindings=forms.get(form) ?? new Set();
        for (const meaning of meanings) bindings.add(meaning);
        if (bindings.size) forms.set(form,bindings);
      }
    }
  }
  return {predicates,forms,maxLength:Math.max(0,...[...forms.keys()].map(form=>form.split(' ').length))};
}

function restricted(text,input,worlds) {
  const grammar=worlds.scopeGrammar;
  return input.some((token,i)=>{
    if (token.key==='?') return true;
    for (let j=i+1;j<=Math.min(input.length,i+6);j++) {
      const form=input.slice(i,j).map(part=>part.key).join(' ');
      const surface=text.slice(token.start,input[j-1].end).toLowerCase().replaceAll('’',"'");
      if (worlds.negatives.has(form) || grammar.negatives.has(form) ||
          grammar.predicateNegators.has(form) || grammar.conditionals.has(form) ||
          [...grammar.endings].some(ending=>surface.endsWith(ending))) return true;
    }
    return false;
  });
}

function pairAt(text,target,wires,input,afterVerb,headStart,owner,worlds) {
  const asNumber=form=>/^\d+$/u.test(form) ? Number(form) :
    Number(worlds.nominalNumbers.get(form)?.value);
  const index=input.findIndex(token=>token.start===headStart);
  if (index<1 || target.attrs.ordinal || target.attrs.quantifier) return false;
  const countWires=wires.filter(wire=>wire.type==='w.request.constraint' &&
    one(wire,'request')===owner && one(wire,'on')==='count');
  const spoken=[...fields(target,'count_words'),...fields(target,'quantity'),...countWires.flatMap(wire=>fields(wire,'words'))];
  const declared=[...fields(target,'count'),...countWires.flatMap(wire=>fields(wire,'value'))];
  if ([...spoken,...declared].some(surface=>asNumber(phrase(surface))!==2) ||
      countWires.some(wire=>one(wire,'operator')!=='eq' || wire.attrs.want)) return false;
  if (!spoken.length && !declared.length) return false;
  const adjacent=input.filter(token=>token.start>=afterVerb && token.end<=headStart);
  if (!adjacent.length || phrase(text.slice(afterVerb,headStart))!==adjacent.map(token=>token.key).join(' ')) return false;
  const forms=[adjacent];
  if (worlds.determiners[adjacent[0].key]==='definite') forms.push(adjacent.slice(1));
  return forms.some(parts=>{
    const form=parts.map(token=>token.key).join(' ');
    const number=worlds.nominalNumbers.get(form);
    const exact=(number && ['cardinal','group'].includes(number.kind) && Number(number.value)===2) || /^0*2$/u.test(form);
    return exact && (!spoken.length || spoken.some(surface=>phrase(surface)===form));
  });
}

function placeBridge(text,wires,owner,left,right) {
  if (left===right || !text.slice(left,right).trim()) return true;
  return wires.some(wire=>wire.type==='w.request.constraint' && one(wire,'request')===owner &&
    one(wire,'on')==='place' && ['words','value'].some(key=>fields(wire,key).some(value=>
      value===text.slice(left,right).trim())));
}

export function reciprocalReading(text,candidate,worlds) {
  const {forms,maxLength}=worlds.reciprocal ?? {};
  if (!forms?.size) return;
  const wires=parse(candidate.sop);
  const targets=wires.filter(wire=>wire.type==='w.request.target');
  const requests=wires.filter(wire=>wire.type==='w.request.request');
  if (targets.length!==1 || requests.length!==1 ||
      wires.some(wire=>wire.type==='w.relational.reciprocal')) return;
  const [target]=targets,[request]=requests;
  const owner='$'+request.id,members='$'+target.id;
  const act=one(request,'act'),family=one(target,'family'),predicate=one(request,'predicate');
  if (one(target,'request')!==owner || !predicate || !worlds.literalGrammar.licenses(family,act) ||
      !worlds.lookup(phrase(predicate)).some(([role,sense,mood])=>role==='act' && sense===act && (!mood || mood==='do')) ||
      (one(request,'mood') ?? 'do')!=='do' || request.attrs.polarity || request.attrs.guard) return;
  const scope=one(request,'words');
  const bounds=scope ? literalRanges(text,scope) : [[0,text.length]];
  if (bounds.length!==1) return;
  const [[left,right]]=bounds;
  const quotes=quotedSpans(text).map(quote=>[quote.start,quote.end].map(offset=>Array.from(text).slice(0,offset).join('').length));
  const visible=(from,to)=>!quotes.some(([start,end])=>start<to && from<end);
  const visibleInput=tokenize(text).filter(token=>visible(token.start,token.end));
  if (restricted(text,visibleInput,worlds)) return;
  const input=visibleInput.filter(token=>token.start>=left && token.end<=right);
  const head=one(target,'sort_words') ?? one(target,'family_words');
  const heads=(head ? literalRanges(text,head,left,right) : sortRanges(text,one(target,'sort'),left,right))
    .filter(([start,end])=>visible(start,end));
  if (heads.length!==1) return;
  const action=literalRanges(text,predicate,left,heads[0][0]).filter(([start,end])=>visible(start,end));
  if (action.length!==1) return;
  const lead=phrase(text.slice(0,action[0][0]));
  if (lead && !worlds.literalGrammar.leads.has(lead) && !worlds.fillerPhrases.has(lead)) return;
  if (!pairAt(text,target,wires,input,action[0][1],heads[0][0],owner,worlds)) return;
  const matches=[];
  for (let i=0;i<input.length;i++) {
    if (input[i].start<heads[0][1]) continue;
    for (let j=i+1;j<=Math.min(i+maxLength,input.length);j++) {
      const start=input[i].start,end=input[j-1].end;
      if (!visible(start,end)) continue;
      const reading=forms.get(phrase(text.slice(start,end)));
      if (reading?.size===1) matches.push({start,end,relation:reading.values().next().value});
    }
  }
  if (matches.length!==1) return;
  const [{start,end,relation}]=matches;
  if (words.test(input.find(token=>token.start>=end)?.key ?? '')) return;
  if (!placeBridge(text,wires,owner,heads[0][1],start)) return;
  // The quantity was grounded on this target by pairAt. Record it where
  // the native pair-cardinality rule checks the members of the relation.
  target.attrs.count=['2'];
  const retained=consumeUnread(wires,text,heads[0][0],end);
  let id=request.id+'.reciprocal';
  for (let n=2;retained.some(wire=>wire.id===id);n++) id=request.id+'.reciprocal.'+n;
  const sop=serialize([...retained,{id,type:'w.relational.reciprocal',attrs:{
    request:[owner],members:[members],predicate:['$'+relation],words:[JSON.stringify(text.slice(start,end))]
  }}]);
  return {sop,source:'reciprocal',status:candidate.status};
}
