import { observeMeaning, supportedMeaning } from './training-evidence.mjs';

export function predicateModeLearner() {
  const evidence=new Map(), actions=new Map();
  return {
    observe(text,family,act,predicate,mode) {
      if (!predicate || !family || !act || !text.includes(predicate)) return;
      const word=predicate.toLowerCase(),key=JSON.stringify([word,act,family]);
      const familyKey=JSON.stringify([word,family]);
      const actionSupport=actions.get(familyKey) ?? new Map();
      actions.set(familyKey,actionSupport);
      observeMeaning(actionSupport,text,act);
      const witnesses=evidence.get(key) ?? new Map();
      evidence.set(key,witnesses);
      observeMeaning(witnesses,text,mode ?? false);
    },
    finish() {
      const entries=[];
      for (const [key,witnesses] of evidence) {
        const [surface,act,family]=JSON.parse(key);
        const explicit=new Map([...witnesses].filter(([,w])=>w.semantics));
        // For a literal operation name, omission in a coarse annotation does
        // not contradict that operation. Other names need agreement across
        // all occurrences, including unqualified uses of the same predicate.
        const literal=supportedMeaning(explicit);
        const dominantAct=supportedMeaning(actions.get(JSON.stringify([surface,family])));
        const mode=literal===surface ? literal : dominantAct===act ? supportedMeaning(witnesses) : undefined;
        if (mode) entries.push([key,mode]);
      }
      return Object.fromEntries(entries);
    }
  };
}
