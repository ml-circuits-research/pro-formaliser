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
  return {
    async formalise(text,{tab,context,evidence=false} = {}) {
      const report = r=>{
        if (!evidence) return r;
        const wires=r.sop ? parse(r.sop) : [];
        const activeTab=context?.tab ?? tab;
        return {...r,evidence:evidenceReport(text,wires,worlds.evidenceVocabulary),
          catalog:{tab:activeTab ?? null,issues:catalogIssues(wires,worlds,activeTab?.trim().toLowerCase())}};
      };
      const result = await formaliser.formalise(text);
      if (context === undefined && tab === undefined) return report(result);
      if (context !== undefined && (!context || typeof context !== 'object' || Array.isArray(context))) throw Error('Expected a discussion context object');
      const {alternatives,candidateCount,multipleInterpretations,...first} = result;
      const candidates = result.sop ? [first,...alternatives] : [];
      const estimation = await estimator.estimate(candidates,{tab,...context});
      if (estimation.selectedIndex === null) return report({...result,estimation});
      const [best,...rest] = estimation.ranking.map(r=>({...candidates[r.index],generatorIndex:r.index}));
      return report({...best,status:best.status ?? (best.source==='lexicon' || best.unread ? 'partial' : 'matched'),
        alternatives:rest,candidateCount,multipleInterpretations,estimation});
    },
    async close() { await Promise.all([formaliser.close(),estimator.close()]); }
  };
}
