import { referencesOf } from '../src/corpus.mjs';
import { parse } from '../src/schema.mjs';
import { checkCircuit } from './check-circuit.mjs';
import { intersectCount, signatures } from './signatures.mjs';

export function checkReferences(row, worlds) {
  return referencesOf(row).map(({column,sop})=>({
    column, ...checkCircuit(row.text,sop,worlds),
  }));
}

// Historical details contain only the primary cell and no validation results.
export function validReferencesOf(row) {
  const invalid = new Set(row.referenceChecks?.filter(check=>check.errors.length).map(check=>check.column));
  return referencesOf(row).filter(({column})=>!invalid.has(column));
}

const parseCircuit = sop => {
  try {
    return typeof sop==='string' ? parse(sop) : null;
  } catch {
    return null;
  }
};
const equal = (left,right) => JSON.stringify(left)===JSON.stringify(right);
const clean = sop => sop.trim().replaceAll('\r\n','\n');
const actMood = wires => wires.filter(wire=>wire.type==='w.request.request')
  .map(wire=>[wire.attrs.act,wire.attrs.mood]);

export function scoreReferences(row, prediction) {
  const wires = parseCircuit(prediction.sop);
  const predicted = signatures(wires ?? [],true);
  const full = signatures(wires ?? []);
  const acts = actMood(wires ?? []);
  const alternatives = (prediction.alternatives ?? [])
    .map(variant=>parseCircuit(variant.sop))
    .filter(Boolean)
    .map(variant=>JSON.stringify(signatures(variant,true)));
  let exact=false, fullWireMatch=false, semanticWireMatch=false, alternativeMatch=false, actMoodMatch=false;
  let closest;
  const goldSemanticKeys=[];
  for (const {column,sop} of validReferencesOf(row)) {
    const gold=parseCircuit(sop);
    if (!gold) continue;
    const expected=signatures(gold,true);
    const key=JSON.stringify(expected);
    const common=intersectCount(expected,predicted);
    goldSemanticKeys.push(key);
    exact ||= wires!==null && clean(prediction.sop)===clean(sop);
    fullWireMatch ||= wires!==null && equal(full,signatures(gold));
    semanticWireMatch ||= wires!==null && equal(predicted,expected);
    alternativeMatch ||= alternatives.includes(key);
    actMoodMatch ||= wires!==null && equal(acts,actMood(gold));
    const distance=predicted.length+expected.length-2*common;
    if (!closest || distance<closest.distance) closest={column,distance,common,length:expected.length};
  }
  return {
    goldSemanticKeys, closestReferenceColumn:closest?.column,
    parsed:wires!==null, parsedNonempty:Boolean(wires?.length),
    exact, fullWireMatch, semanticWireMatch, alternativeSemanticMatch:!semanticWireMatch && alternativeMatch, actMoodMatch,
    semanticGoldWires:closest?.length ?? 0,
    semanticPredictedWires:closest ? predicted.length : 0,
    semanticMatchedWires:closest?.common ?? 0,
  };
}
