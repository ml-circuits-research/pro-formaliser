import { catalogIssues } from '../src/catalog.mjs';
import { evidenceInText } from '../src/grounding.mjs';
import { parse, validate } from '../src/schema.mjs';

export function checkCircuit(text, sop, worlds) {
  const nativeValid = validate(sop, worlds);
  if (!nativeValid) return { nativeValid, errors: ['native_schema'] };
  const wires = parse(sop);
  const errors = catalogIssues(wires, worlds).map(issue => issue.code);
  if (!evidenceInText(text, sop, worlds)) errors.push('source_evidence');
  if (wires.some(wire=>wire.type==='w.request.lookup' &&
      wire.attrs.from?.some(from=>from==='previous' || from==='"previous"'))) errors.push('history_reference');
  return { nativeValid, errors: [...new Set(errors)] };
}
