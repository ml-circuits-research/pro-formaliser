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

export function nominalSelectorLines(selector,owner='r1') {
  if (!selector) return [];
  const {key,value,words,marker}=selector, quote=JSON.stringify;
  return ['@'+owner+'.subject.property w.request.constraint request=$'+owner+' on=attribute attribute='+quote(key)+
    ' value='+quote(value)+' operator=eq phase=selector'+
    (value!==words ? ' words='+quote(words) : '')+
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
