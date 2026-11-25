import {str} from '../.cache/knowledge/tools/sopworld/sopworld.mjs';
import {tokens} from './lexicon.mjs';
import {nativeInventory} from './native-inventory.mjs';

export const nominalSelectorType='pro.reader.nominal_selector';
const values=(wire,key)=>(wire.attrs[key] ?? []).map(str);
const one=(wire,key)=>values(wire,key)[0];
const normalize=text=>tokens(text).map(([term])=>term).join(' ');

export function nominalSelectorProviders(wire) {
  return [one(wire,'value_type'),...values(wire,'head_type')].filter(Boolean);
}

export function compileNominalSelectors(facts,requestKeys,words) {
  const inventories=new Map();
  const inventory=type=>{
    if (!inventories.has(type)) inventories.set(type,nativeInventory(facts,type,words));
    return inventories.get(type);
  };
  return facts(nominalSelectorType).flatMap(wire=>{
    const [family,key,position,type]=['family','key','position','value_type'].map(slot=>one(wire,slot));
    const keys=requestKeys.filter(declaration=>declaration.family===family && declaration.name===key);
    const markers=values(wire,'marker').map(normalize);
    if (!keys.length || !type || !['before','after'].includes(position) || position==='after' && !markers.length) return [];
    const compatible=name=>keys.some(declaration=>!declaration.values.length || declaration.values.includes(name));
    const bank=new Map([...inventory(type)].flatMap(([surface,names])=>{
      const possible=[...names].filter(compatible);
      return possible.length===1 ? [[surface,possible[0]]] : [];
    }));
    const heads=values(wire,'head_type').map(inventory);
    return bank.size && heads.length ? [{family,key,position,markers,bank,heads}] : [];
  });
}

export function directHead(noun,binding) {
  return binding.heads.find(bank=>bank.has(noun))?.get(noun);
}

export function nominalSelectorLines(selector,owner='r1',phase='selector') {
  if (!selector) return [];
  const {key,value,words,marker}=selector, quote=JSON.stringify;
  return ['@'+owner+'.subject.property w.request.constraint request=$'+owner+' on=attribute attribute='+quote(key)+
    ' value='+quote(value)+' operator=eq phase='+phase+
    (phase==='result' || value!==words ? ' words='+quote(words) : '')+
    (marker ? ' key_words='+quote(marker) : '')];
}

// The entire noun phrase must decompose into a known noun, a declared marker
// (where required), and one unambiguous value of the selector.
export function nominalSelectors(bindings,start,end,phrase,span,resolveHead=directHead) {
  const matches=[];
  for (const binding of bindings) {
    for (let middle=start+1;middle<end;middle++) {
      const before=binding.position==='before';
      const variants=before ? [''] : binding.markers;
      for (const marker of variants) {
        const afterMarker=middle+(marker ? marker.split(' ').length : 0);
        if (afterMarker>=end || marker && phrase(middle,afterMarker)!==marker) continue;
        const [headStart,headEnd]=before ? [middle,end] : [start,middle];
        const [valueStart,valueEnd]=before ? [start,middle] : [afterMarker,end];
        const value=binding.bank.get(phrase(valueStart,valueEnd));
        if (!value) continue;
        const noun=phrase(headStart,headEnd);
        // A preceding source can supply a more specific kind than a later alias.
        const names=resolveHead(noun,binding);
        if (names?.size!==1) continue;
        matches.push({sort:[...names][0],sortWords:span(headStart,headEnd),
          selector:{key:binding.key,value,words:span(valueStart,valueEnd),
            marker:marker ? span(middle,afterMarker) : undefined}});
      }
    }
  }
  return matches;
}

export function ellipticalNominals(text,ts,worlds,politeness) {
  if (ts.length<2 || ts.length>14 || ts.some(([term])=>term==='?')) return [];
  const chars=Array.from(text);
  const phrase=(start,end)=>ts.slice(start,end).map(([term])=>term).join(' ');
  const span=(start,end)=>chars.slice(ts[start][2],ts[end-1][3]).join('');
  let start=0, end=ts.length;
  while (['.','!'].includes(ts[end-1]?.[0])) end--;
  const fillers=[];
  for (let width=Math.min(end-2,5);width>0;width--) {
    if (!politeness.has(phrase(0,width))) continue;
    fillers.push(span(0,width));
    start=width+Number(ts[width]?.[0]===',');
    break;
  }
  for (let width=Math.min(end-start-2,5);width>0;width--) {
    if (!politeness.has(phrase(end-width,end))) continue;
    fillers.push(span(end-width,end));
    end-=width;
    end-=Number(ts[end-1]?.[0]===',');
    break;
  }
  const determiner=worlds.determiners[ts[start]?.[0]];
  if (determiner && determiner!=='indefinite' || !determiner && !fillers.length) return [];
  start+=Number(Boolean(determiner));
  const quote=JSON.stringify;
  return worlds.nominalSelectorRules.flatMap(binding=>{
    if (!worlds.literalGrammar.licenses(binding.family,'make')) return [];
    return nominalSelectors([binding],start,end,phrase,span).map(({sort,sortWords,selector})=>{
      const sop=[
        '@r1 w.request.request act=make mood=do words='+quote(text),
        '@r1.t w.request.target request=$r1 family='+quote(binding.family)+' mode=new sort='+quote(sort)+
          ' sort_words='+quote(sortWords)+(determiner ? ' determiner='+determiner : ''),
        ...nominalSelectorLines(selector,'r1','result'),
        ...fillers.map((f,i)=>'@f'+(i+1)+' w.request.filler text='+quote(f)),
      ].join('\n');
      return {sop,source:'elliptical-nominal',status:'matched',nominalWords:[sortWords,selector.words]};
    });
  });
}
