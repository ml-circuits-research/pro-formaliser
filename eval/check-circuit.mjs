import { catalogIssues } from '../src/catalog.mjs';
import { evidenceInText } from '../src/grounding.mjs';
import { parse, validate } from '../src/schema.mjs';

export function checkCircuit(text, sop, worlds) {
  const nativeValid = validate(sop, worlds);
  if (!nativeValid) return { nativeValid, errors: ['native_schema'] };
  const errors = catalogIssues(parse(sop), worlds).map(issue => issue.code);
  if (!evidenceInText(text, sop, worlds)) errors.push('source_evidence');
  return { nativeValid, errors: [...new Set(errors)] };
}
