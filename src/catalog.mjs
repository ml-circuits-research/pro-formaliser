// The request catalog is evaluated separately from native SOP type validity.
// With no tab, any loaded domain can license the reading.
const indexes=new WeakMap();
const value=v=>v?.startsWith('"') ? JSON.parse(v) : v;
function keyIndex(worlds) {
  if (!indexes.has(worlds)) {
    const index=new Map();
    for (const key of worlds.requestKeys) {
      if (!index.has(key.name)) index.set(key.name,[]);
      index.get(key.name).push({tab:key.tab,family:key.family,values:new Set(key.values.map(s=>s.toLowerCase()))});
    }
    indexes.set(worlds,index);
  }
  return indexes.get(worlds);
}

export function catalogIssues(wires,worlds,tab) {
  const issues=[],index=keyIndex(worlds);
  for (const {id,type,attrs} of wires) {
    if (type==='w.request.target') {
      const family=value(attrs.family?.[0]);
      const tabs=Object.hasOwn(worlds.familyTabs,family) ? worlds.familyTabs[family] : [];
      if (!tabs.length || (tab && !tabs.includes(tab))) issues.push({wire:id,slot:'family',value:family,code:'unlicensed_family'});
    }
    if (type!=='w.request.constraint') continue;
    const name=value(attrs.attribute?.[0]);
    const declarations=(index.get(name) ?? []).filter(k=>!tab || tab===k.tab);
    if (!declarations.length) {
      issues.push({wire:id,slot:'attribute',value:name??null,code:'unlicensed_key'});
      continue;
    }
    const open=value(attrs.open_value?.[0])==='true';
    if (value(attrs.phase?.[0])==='result' && (open || !attrs.value?.length) &&
        declarations.every(key=>worlds.ownedEffects?.closedChoices?.has(JSON.stringify([key.family,name])))) {
      issues.push({wire:id,slot:'value',value:value(attrs.value?.[0]) ?? null,attribute:name,code:'unresolved_finite_choice'});
      continue;
    }
    if (open) continue;
    for (const item of attrs.value ?? []) {
      const v=value(item);
      if (!declarations.some(k=>!k.values.size || k.values.has(v.toLowerCase())))
        issues.push({wire:id,slot:'value',value:v,attribute:name,code:'outside_value_bank'});
    }
  }
  return issues;
}
