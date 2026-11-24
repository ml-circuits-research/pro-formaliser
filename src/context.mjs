// Estimate how strongly a word supports an interpretation from labelled requests.
// Features score already grounded hypotheses. They cannot introduce a wire.
export function contextLearner() {
  const documents = new Map(), words = new Map();
  let requests = 0;
  return {
    observe(surface, labels) {
      const terms = new Set(surface.toLowerCase().match(/[\p{L}]{2,}/gu));
      requests++;
      for (const label of labels) documents.set(label,(documents.get(label) ?? 0)+1);
      for (const term of terms) {
        const stat = words.get(term) ?? {total:0, labels:new Map()};
        stat.total++;
        for (const label of labels) stat.labels.set(label,(stat.labels.get(label) ?? 0)+1);
        words.set(term,stat);
      }
    },
    finish() {
      const weights = Object.create(null);
      for (const [term,{total,labels}] of words) {
        if (total < 4) continue;
        for (const [label,n] of labels) {
          if (n < 3) continue;
          const prior = documents.get(label)/requests;
          const lift = Math.log((n + 8*prior)/((total+8)*prior));
          if (lift > 0.3) (weights[term] ??= []).push([label,Math.min(3,lift)]);
        }
      }
      return weights;
    }
  };
}

export function contextScores(text, weights) {
  const evidence = new Map();
  for (const term of new Set(text.toLowerCase().match(/[\p{L}]{2,}/gu))) {
    if (!Object.hasOwn(weights,term)) continue;
    for (const [label,weight] of weights[term]) {
      const list = evidence.get(label) ?? [];
      list.push(weight);
      evidence.set(label,list);
    }
  }
  return Object.fromEntries([...evidence].map(([k,v]) => [k,v.sort((a,b)=>b-a).slice(0,4).reduce((a,b)=>a+b,0)]));
}
