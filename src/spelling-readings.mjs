import { spellcheck } from './spell.mjs';

export async function spellingReadings(text,propose) {
  const spelling=spellcheck(text);
  const original=await propose(text);
  const corrected=spelling.changed ? await propose(spelling.text) : undefined;
  const candidates=corrected?.candidates.map(candidate=>({
    ...candidate,spellingReading:'corrected',spellingReadings:['corrected'],
  })) ?? [];
  const positions=new Map(candidates.map(({sop},i)=>[sop,i]));
  for (const candidate of original.candidates) {
    const reading={...candidate,spellingReading:'original',spellingReadings:['original']};
    const position=positions.get(candidate.sop);
    if (position===undefined) candidates.push(reading);
    else candidates[position]={...reading,spellingReadings:['original','corrected']};
  }
  return {original:text,spelling,candidates,candidateCount:candidates.length,
    multipleInterpretations:candidates.length>1,...(!candidates.length ? {unread:text} : {})};
}
