import { readFileSync } from 'node:fs';
import { World, parse } from '../.cache/knowledge/tools/sopworld/sopworld.mjs';

const worldsRoot = new URL('../.cache/knowledge/docs/worlds/', import.meta.url);

export function probeSchema({ type, slot, extension, witness, alternatives }, worlds) {
  const declarations = parse(extension);
  if (declarations.length !== 1 || declarations[0].type !== 'core.slot' ||
      declarations[0].attrs.of?.[0] !== type || declarations[0].attrs.key?.[0] !== slot) {
    throw Error('Schema probe extension must add precisely the reviewed slot');
  }
  if (!Array.isArray(alternatives) || !alternatives.length ||
      alternatives.some(item => !item.rationale?.trim() || typeof item.nativeValid !== 'boolean')) {
    throw Error('Schema probe requires reviewed alternative encodings and expected native outcomes');
  }
  const library = Object.fromEntries(['k.named', 'k.actions', 'w.request'].map(id =>
    [id, readFileSync(new URL(id + '/schema.sop', worldsRoot), 'utf8')]));
  const base = new World({ library });
  for (const id of ['std.acts', 'k.actions', 'w.request']) {
    if (!base.use(id).ok) throw Error('Cannot load schema probe world ' + id);
  }
  if (!base.tell(worlds.acts, { factsOnly: true }).ok) throw Error('Cannot load acts for schema probe');
  base.closeType('k.actions.act');
  const declaration = base.schema(type);
  const closedSlot = declaration?.closed === true && !Object.hasOwn(declaration.keys, slot);
  const baseline = base.fork().tell(witness, { factsOnly: true });
  const ids = new Set(parse(witness).filter(wire => wire.type === type).map(wire => wire.id));
  const baselineRejected = !baseline.ok && (baseline.violations ?? []).some(v => ids.has(v.id) && v.key === slot);
  const expanded = base.fork();
  const extensionResult = expanded.tell(extension);
  const extendedAccepted = extensionResult.ok && expanded.tell(witness, { factsOnly: true }).ok;
  const alternativesChecked = alternatives.map(({ sop, rationale, nativeValid }) => ({
    rationale, expectedNativeValid: nativeValid, nativeValid: base.fork().tell(sop, { factsOnly: true }).ok,
  }));
  return { type, slot, closedSlot, baselineRejected, extendedAccepted, alternatives: alternativesChecked,
    alternativesConsistent: alternativesChecked.every(item => item.nativeValid === item.expectedNativeValid) };
}
