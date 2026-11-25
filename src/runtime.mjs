import { catalogIssues } from './catalog.mjs';
import { evidenceReport, originalEvidence } from './evidence.mjs';
import { parse } from './schema.mjs';
import { loadWorlds } from './worlds.mjs';
import { createEstimator } from './estimate.mjs';
import { createFormaliser } from './formaliser.mjs';
import { spellingReadings } from './spelling-readings.mjs';
export { createFormaliser } from './formaliser.mjs';

export function createReader(model, worlds = loadWorlds(),options) {
  const formaliser = createFormaliser(model,worlds,options);
  const estimator = createEstimator(worlds);
  const generate=(text,spell)=>spell ? spellingReadings(text,t=>formaliser.formalise(t)) : formaliser.formalise(text);
  const source=(text,candidate,spelling)=>candidate.spellingReading==='corrected' ? spelling.text : text;
  function withEvidence(text,candidate,spelling) {
    const wires = candidate.sop ? parse(candidate.sop) : [];
    const report=evidenceReport(source(text,candidate,spelling),wires,worlds.evidenceVocabulary);
    const corrections=candidate.spellingReading==='corrected' ? spelling.corrections : [];
    return {...candidate,evidence:spelling ? originalEvidence(report,text,corrections) : report,
      catalog:{issues:catalogIssues(wires,worlds)}};
  }
  return {
    async propose(text,{evidence=false,spell=false}={}) {
      const result=await generate(text,spell);
      if (!evidence) return result;
      return {...result,candidates:result.candidates.map(c=>withEvidence(text,c,result.spelling))};
    },
    async formalise(text,{rank=false,evidence=false,spell=false} = {}) {
      const {candidates,candidateCount,multipleInterpretations,original,spelling}=await generate(text,spell);
      const [first,...alternatives] = candidates;
      const metadata={candidateCount,multipleInterpretations,...(spell ? {original,spelling} : {})};
      const result = {...(first ?? {status:'unresolved',sop:'',unread:text}),alternatives,...metadata};
      const report = r=>{
        if (!evidence) return r;
        const annotate=c=>withEvidence(text,c,spelling);
        return {...annotate(r),...(spell ? {alternatives:r.alternatives.map(annotate)} : {})};
      };
      if (!rank) return report(result);
      const estimation = await estimator.estimate(candidates,undefined,spell
        ? {utterances:candidates.map(c=>source(text,c,spelling))} : {utterance:text});
      if (estimation.selectedIndex === null) return report({...result,estimation});
      const orderedIndices=[...estimation.ranking.map(r=>r.index),...estimation.invalidIndices];
      const [best,...rest] = orderedIndices.map(index=>({...candidates[index],generatorIndex:index}));
      return report({...best,status:best.status ?? (best.source==='lexicon' || best.unread ? 'partial' : 'matched'),
        alternatives:rest,...metadata,estimation});
    },
    async close() { await Promise.all([formaliser.close(),estimator.close()]); }
  };
}
