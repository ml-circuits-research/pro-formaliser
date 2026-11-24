// One normalized utterance contributes at most one vote. An ambiguous witness
// counts toward the denominator but cannot vote for either interpretation.
export function observeMeaning(witnesses,text,meaning,sort) {
  const key=text.normalize('NFKC').trim().toLowerCase().replace(/\s+/gu,' ');
  const prior=witnesses.get(key);
  if (!prior) witnesses.set(key,{semantics:meaning,sort});
  else if (prior.semantics!==meaning) prior.semantics=false;
}

export function supportedMeaning(witnesses,minimumSorts=0) {
  const senses=new Map();
  for (const {semantics,sort} of witnesses.values()) {
    if (!semantics) continue;
    const support=senses.get(semantics) ?? {count:0,sorts:new Set()};
    support.count++;
    if (sort) support.sorts.add(sort);
    senses.set(semantics,support);
  }
  for (const [meaning,{count,sorts}] of senses) {
    if (count<2 || sorts.size<minimumSorts) continue;
    if (count===witnesses.size || count>=40 && count/witnesses.size>=0.98) return meaning;
  }
}
