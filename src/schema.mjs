import { readFileSync } from 'node:fs';
import { World, parse } from '../.cache/knowledge/tools/sopworld/sopworld.mjs';

export { parse };
const sources = new URL('../.cache/knowledge/docs/worlds/', import.meta.url);
const read = path => readFileSync(new URL(path, sources), 'utf8');
const library = Object.fromEntries(['k.named', 'k.actions', 'w.request'].map(id => [id, read(id + '/schema.sop')]));
const base = new World({library});
for (const id of ['std.acts', 'k.actions', 'w.request']) {
  const result = base.use(id);
  if (!result.ok) throw Error('Schema loading failed for ' + id + ': ' + JSON.stringify(result.violations));
}
base.tell(read('k.actions/shards/acts.sop'), {factsOnly:true});
base.closeType('k.actions.act');

export function validate(sop) {
  if (!sop.trim()) return false;
  try {
    return base.fork().tell(sop, {factsOnly:true}).ok;
  } catch {
    return false;
  }
}
