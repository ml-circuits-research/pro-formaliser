// The reader façade preserves the existing API. Its two stages also run independently.
import { catalogIssues } from './catalog.mjs';
import { evidenceReport } from './evidence.mjs';
import { parse } from './schema.mjs';
import { loadWorlds } from './worlds.mjs';
import { createEstimator } from './estimate.mjs';
import { createFormaliser } from './formaliser.mjs';
export { createFormaliser } from './formaliser.mjs';

export function createReader(model, worlds = loadWorlds(),options) {
  const formaliser = createFormaliser(model,worlds,options);
  const estimator = createEstimator(worlds);
  function withEvidence(text, candidate, tab) {
    const wires = candidate.sop ? parse(candidate.sop) : [];
    return {...candidate,evidence:evidenceReport(text,wires,worlds.evidenceVocabulary),
      catalog:{tab:tab ?? null,issues:catalogIssues(wires,worlds,tab?.trim().toLowerCase())}};
  }
  return {
    async propose(text,{evidence=false}={}) {
      const result=await formaliser.formalise(text);
      if (!evidence) return result;
      return {...result,candidates:result.candidates.map(c=>withEvidence(text,c))};
    },
    async formalise(text,{tab,context,evidence=false} = {}) {
      const report = r=>evidence ? withEvidence(text,r,context?.tab ?? tab) : r;
      const {candidates,candidateCount,multipleInterpretations} = await formaliser.formalise(text);
      const [first,...alternatives] = candidates;
      const result = {...(first ?? {status:'unresolved',sop:'',unread:text}),alternatives,candidateCount,multipleInterpretations};
      if (context === undefined && tab === undefined) return report(result);
      if (context !== undefined && (!context || typeof context !== 'object' || Array.isArray(context))) throw Error('Expected a discussion context object');
      const estimation = await estimator.estimate(candidates,{tab,...context});
      if (estimation.selectedIndex === null) return report({...result,estimation});
      const [best,...rest] = estimation.ranking.map(r=>({...candidates[r.index],generatorIndex:r.index}));
      return report({...best,status:best.status ?? (best.source==='lexicon' || best.unread ? 'partial' : 'matched'),
        alternatives:rest,candidateCount,multipleInterpretations,estimation});
    },
    async close() { await Promise.all([formaliser.close(),estimator.close()]); }
  };
}
