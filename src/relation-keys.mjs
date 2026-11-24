import { parse, serialize } from '../.cache/knowledge/tools/sopworld/sopworld.mjs';

const requestConstraint = 'w.request.constraint';
const requestTarget = 'w.request.target';
const requestLookup = 'w.request.lookup';
const decode = value => value?.startsWith('"') ? JSON.parse(value) : value;
const one = (wire, name) => wire.attrs[name]?.[0];
const atom = value => /^[\p{L}_][\p{L}\p{N}_.-]*$/u.test(value) ? value : JSON.stringify(value);

function readSpatialWires(sop) {
  if (!sop.includes(' relation=')) return null;
  let wires;
  try { wires = parse(sop); } catch { return null; }
  const intermediates = wires.filter(wire => wire.type === requestConstraint &&
    one(wire, 'on') === 'place' && one(wire, 'operator') === 'relation' &&
    wire.attrs.relation && wire.attrs.value?.length === 1 && wire.attrs.words && !wire.attrs.attribute);
  return intermediates.length ? { wires, intermediates } : null;
}

function unusedId(usedIds, stem) {
  let id = stem, suffix = 2;
  while (usedIds.has(id)) id = stem + '.' + suffix++;
  usedIds.add(id);
  return id;
}

export function createRelationKeyResolver(worlds) {
  const pairs = new Map(), keysByFamilyTab = new Map();
  const group = ({ family, tab }) => JSON.stringify([family, tab]);
  for (const key of worlds.requestKeys) {
    const familyKeys = keysByFamilyTab.get(group(key)) ?? [];
    familyKeys.push(key);
    keysByFamilyTab.set(group(key), familyKeys);
  }
  function addPair(key, anchor) {
    for (const value of key.values) {
      const families = pairs.get(value) ?? new Map();
      const matches = families.get(key.family) ?? new Map();
      matches.set(JSON.stringify([key.name, anchor.name]), { relation: key.name, anchor: anchor.name });
      families.set(key.family, matches);
      pairs.set(value, families);
    }
  }
  const explicitGroups = new Set();
  for (const binding of worlds.spatialBindings ?? []) {
    const signature = group(binding);
    explicitGroups.add(signature);
    const keys = keysByFamilyTab.get(signature) ?? [];
    const relations = keys.filter(key => key.name === binding.relationKey && key.head === 'class');
    const anchors = keys.filter(key => key.name === binding.anchorKey &&
      key.head === 'fill+span' && !key.values.length);
    if (relations.length === 1 && anchors.length === 1) addPair(relations[0], anchors[0]);
  }
  // Pinned worlds predate explicit bindings. Their class bank is distinct
  // from candidate keys such as node.relation, which can mean a semantic association.
  for (const [signature, keys] of keysByFamilyTab) {
    if (explicitGroups.has(signature)) continue;
    const anchors = keys.filter(key =>
      key.name === key.family + '.anchor' && key.head === 'fill+span' && !key.values.length);
    if (anchors.length !== 1) continue;
    for (const key of keys) {
      if (key.head === 'class' && [key.family + '.relation', key.family + '.position'].includes(key.name)) {
        addPair(key, anchors[0]);
      }
    }
  }

  function resolveWires(wires, intermediates) {
    const usedIds = new Set(wires.map(wire => wire.id));
    const replacements = new Map(), lookupTargets = new Map();
    for (const wire of intermediates) {
      const request = one(wire, 'request');
      const families = new Set(wires.filter(target => target.type === requestTarget &&
        one(target, 'request') === request).map(target => decode(one(target, 'family'))));
      const value = decode(one(wire, 'relation'));
      const anchor = decode(one(wire, 'value'));
      const words = decode(one(wire, 'words'));
      const marker = words.endsWith(anchor) ? words.slice(0, -anchor.length).trimEnd() : '';
      const keys = families.size === 1 ? pairs.get(value)?.get([...families][0]) : undefined;
      if (keys?.size !== 1 || !marker) {
        replacements.set(wire.id, [{
          id: wire.id, type: 'w.request.unread',
          attrs: { request: [request], text: [JSON.stringify(words)], note: ['"unresolved spatial relation"'] },
        }]);
        lookupTargets.set('$' + wire.id, null);
        continue;
      }
      const [pair] = keys.values();
      const anchorId = unusedId(usedIds, wire.id + '.anchor');
      const attrs = { ...wire.attrs, attribute: [atom(pair.relation)], value: [atom(value)] };
      delete attrs.relation;
      if (marker === value) delete attrs.words;
      else attrs.words = [JSON.stringify(marker)];
      replacements.set(wire.id, [
        { ...wire, attrs },
        { id: anchorId, type: requestConstraint, attrs: {
          request: [request], on: ['place'], attribute: [atom(pair.anchor)],
          value: [atom(anchor)], operator: ['relation'], phase: ['selector'],
        } },
      ]);
      lookupTargets.set('$' + wire.id, '$' + anchorId);
    }

    const resolved = wires.flatMap(wire => {
      if (replacements.has(wire.id)) return replacements.get(wire.id);
      const constraint = one(wire, 'constraint');
      if (wire.type !== requestLookup || !lookupTargets.has(constraint)) return [wire];
      const target = lookupTargets.get(constraint);
      return target ? [{ ...wire, attrs: { ...wire.attrs, constraint: [target] } }] : [];
    });
    return serialize(resolved).trimEnd();
  }

  function resolveRelationKeys(sop) {
    const spatial = readSpatialWires(sop);
    return spatial ? resolveWires(spatial.wires, spatial.intermediates) : sop;
  }

  resolveRelationKeys.targetlessAlternatives = function (sop) {
    const spatial = readSpatialWires(sop);
    if (!spatial) return [];
    const { wires, intermediates } = spatial;
    const requests = wires.filter(wire => wire.type === 'w.request.request');
    if (requests.length !== 1 || one(requests[0], 'refers') !== 'thing' ||
        wires.some(wire => wire.type === requestTarget)) return [];
    const [request] = requests;
    const relations = new Set(intermediates.map(wire => decode(one(wire, 'relation'))));
    const first = pairs.get(relations.values().next().value);
    if (!first) return [];

    const usedIds = new Set(wires.map(wire => wire.id));
    const targetId = unusedId(usedIds, request.id + '.context_target');
    const lookupId = unusedId(usedIds, request.id + '.context_lookup');
    const reference = '$' + request.id;
    return [...first.keys()].sort().filter(family =>
      [...relations].every(value => pairs.get(value)?.get(family)?.size === 1)
    ).map(family => resolveWires([
      request,
      { id: targetId, type: requestTarget, attrs: {
        request: [reference], family: [atom(family)], mode: ['existing'], fill: ['context'],
      } },
      { id: lookupId, type: requestLookup, attrs: {
        request: [reference], target: ['$' + targetId], key: ['thing'], from: ['any'],
      } },
      ...wires.filter(wire => wire !== request),
    ], intermediates));
  };

  return resolveRelationKeys;
}
