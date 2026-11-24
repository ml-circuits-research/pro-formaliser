import { readFileSync } from 'node:fs';
import { World, parse } from '../.cache/knowledge/tools/sopworld/sopworld.mjs';

export { parse };
const sources = new URL('../.cache/knowledge/docs/worlds/', import.meta.url);
const read = path => readFileSync(new URL(path, sources), 'utf8');
const library = Object.fromEntries(['k.named', 'k.actions', 'w.request'].map(id => [id, read(id + '/schema.sop')]));
const schema = new World({library});
for (const id of ['std.acts', 'k.actions', 'w.request']) {
  const result = schema.use(id);
  if (!result.ok) throw Error('Schema loading failed for ' + id + ': ' + JSON.stringify(result.violations));
}

function bindActs(acts) {
  const base = schema.fork();
  const result = base.tell(acts, {factsOnly:true});
  if (!result.ok) throw Error('Invalid act facts: ' + JSON.stringify(result.violations));
  base.closeType('k.actions.act');
  return base;
}

const defaultActs = parse(read('k.actions/shards/acts.sop')).filter(wire => wire.type === 'k.actions.act');
const base = bindActs(defaultActs);
const validators = new WeakMap();

function validator(worlds) {
  if (!worlds) return base;
  if (!validators.has(worlds)) validators.set(worlds, bindActs(worlds.acts));
  return validators.get(worlds);
}

export function validate(sop, worlds) {
  if (!sop.trim()) return false;
  const base = validator(worlds);
  try {
    return base.fork().tell(sop, {factsOnly:true}).ok;
  } catch {
    return false;
  }
}
