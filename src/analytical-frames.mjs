import { str } from '../.cache/knowledge/tools/sopworld/sopworld.mjs';
import { tokens } from './lexicon.mjs';

const surface=text=>tokens(text).map(([key])=>key).join(' ');
const ownerId=(family,key,value,words)=>JSON.stringify([family,key,value,surface(words)]);

// Lower declarative analytical frames into the existing argument parser. The
// frame names the data roles and layouts, while the argument parser binds and
// validates the written spans and closed operator values.
export function analyticalArgumentFacts(facts) {
  const frames=[];
  const boundaries=new Map();
  const closedFields=new Set(facts('w.request.key').filter(({attrs})=>
    attrs.value?.length && str(attrs.head?.[0])?.split('+').some(head=>head==='class' || head==='candidate'))
    .map(({attrs})=>JSON.stringify(['tab','family','name'].map(key=>str(attrs[key]?.[0])))));
  for (const {attrs} of facts('pro.reader.analytical_boundary')) {
    const id=JSON.stringify(['tab','family'].map(key=>str(attrs[key]?.[0])));
    const accumulated=boundaries.get(id) ?? {open_boundary:[],numeric_modifier:[]};
    accumulated.open_boundary.push(...attrs.text ?? []);
    accumulated.numeric_modifier.push(...attrs.numeric_modifier ?? []);
    boundaries.set(id,accumulated);
  }
  for (const wire of facts('pro.reader.analytical_frame')) {
    const {attrs}=wire;
    const take=key=>attrs[key]?.[0];
    const [layout,ownerMarker,grouping,operation,measure]=
      ['layout','owner_marker','grouping','operation','measure'].map(take);
    if (![take('family'),take('tab'),take('owner_key'),take('owner_value')].every(Boolean) ||
        !attrs.prefix?.length || !attrs.owner?.length) continue;
    const scope=['tab','family'].map(key=>str(take(key)));
    const isClosedField=field=>field.startsWith('=') || field==='$predicate' || closedFields.has(JSON.stringify([...scope,field]));
    const parts=layout==='ordered_fields' ? (attrs.pattern ?? []).flatMap(pattern=>{
      // Braces name typed catalog slots. The text between slots is one
      // authored connector. A closed value between open slots also separates
      // them, as in a threshold operator between a subject and its bound.
      const split=str(pattern).split(/\{(\$(?:owner|predicate)|=?[\p{L}][\p{L}\p{N}_-]*\.[\p{L}\p{N}_.-]+)\}/u);
      if (split.length<5 || split.some((item,i)=>i%2===0 &&
          (/[{}]/u.test(item) || i>0 && i<split.length-1 && !item.trim() &&
            !isClosedField(split[i-1]) && !isClosedField(split[i+1])))) return [];
      return [split.flatMap((item,i)=>{
        const part=item.trim();
        return part ? [i%2 ? part : JSON.stringify(part)] : [];
      })];
    }) : groupedParts(attrs,[layout,ownerMarker,grouping,operation,measure]);
    for (const [i,part] of parts.entries()) {
      const inherited=boundaries.get(JSON.stringify(scope));
      const bindsPredicate=part.includes('$predicate');
      // Reuse the authored command surfaces as a closed slot. The leading
      // literal indexes the packet while leaving the command at its written position.
      const predicateLead=part[part.indexOf('$predicate')-1];
      if (bindsPredicate && (!part[0].startsWith('"') || !predicateLead?.endsWith(',"'))) continue;
      frames.push({
        id:wire.id+'.argument.'+(i+1),
        type:'pro.reader.argument_sequence',
        attrs:Object.fromEntries([
          ...['tab','family','owner','owner_key','owner_value'].map(key=>[key,attrs[key]]),
          ['prefix',bindsPredicate ? part.slice(0,1) : attrs.prefix],
          ['predicate_surface',bindsPredicate ? attrs.prefix : []],
          ['act',['make']],['mode',['new']],['part',bindsPredicate ? part.slice(1) : part],
          ['tail',bindsPredicate ? [] : attrs.tail ?? []],
          ['scope_literal_slot',attrs.scope_literal_slot ?? []],['scope_literal',attrs.scope_literal ?? []],
          ['open_boundary',[...inherited?.open_boundary ?? [],...attrs.open_boundary ?? []]],
          ['numeric_modifier',inherited?.numeric_modifier ?? []]
        ])
      });
    }
  }
  return frames;
}

function groupedParts(attrs,[layout,ownerMarker,grouping,operation,measure]) {
  if (!ownerMarker || !grouping || !measure) return [];
  const owner=['$owner',ownerMarker];
  const groupMarkers=attrs.group_marker ?? [];
  const operationMarkers=attrs.operation_marker ?? [];
  const variants=operation ? [[operation],...operationMarkers.map(marker=>[operation,marker])] : [[]];
  if (operation) for (const lead of attrs.operation_lead ?? []) {
    variants.push([lead,operation],...operationMarkers.map(marker=>[lead,operation,marker]));
  }
  const parts=[];
  for (const variant of variants) for (const groupMarker of groupMarkers) {
    if (layout==='leading_owner') {
      parts.push([...owner,...variant,measure,groupMarker,grouping]);
    } else if (layout==='trailing_owner') {
      parts.push([...variant,measure,groupMarker,grouping,ownerMarker,'$owner']);
    }
  }
  if (layout==='leading_group' && operation) {
    for (const marker of operationMarkers) parts.push([...owner,grouping,operation,marker,measure]);
  }
  if (layout==='trailing_operation' && operation) {
    for (const marker of operationMarkers) for (const groupMarker of groupMarkers) {
      parts.push([...owner,measure,marker,operation,groupMarker,grouping]);
    }
  }
  return parts;
}

export function compileAnalyticalOwnerProperties(facts, requestKeys) {
  const index=new Map();
  for (const {attrs} of facts('pro.reader.analytical_owner_property')) {
    const get=key=>str(attrs[key]?.[0]);
    const [tab,family,ownerKey,ownerValue,key,value]=
      ['tab','family','owner_key','owner_value','key','value'].map(get);
    if (ownerKey===key || ![[ownerKey,ownerValue],[key,value]].every(([name,choice])=>
      requestKeys.some(row=>row.tab===tab && row.family===family && row.name===name && row.values.includes(choice)))) continue;
    for (const word of (attrs.text ?? []).map(str)) {
      const id=ownerId(family,ownerKey,ownerValue,word), fields=index.get(id) ?? new Map();
      const values=fields.get(key) ?? new Set();
      values.add(value);
      fields.set(key,values);
      index.set(id,fields);
    }
  }
  return index;
}

export function analyticalOwnerBindings(text,proof,worlds) {
  if (!proof.owned?.ownerKey || !worlds.analyticalOwnerProperties?.size) return [];
  const owner=proof.bindings.find(([key])=>key==='$owner');
  if (!owner) return [];
  const [, ,start,end]=owner, span=Array.from(text).slice(start,end).join('');
  const fields=worlds.analyticalOwnerProperties.get(ownerId(proof.family,
    proof.owned.ownerKey,proof.owned.ownerValue,span));
  return [...(fields ?? [])].flatMap(([key,values])=>values.size===1 &&
    !proof.bindings.some(([occupied])=>occupied===key) ? [[key,[...values][0],start,end]] : []);
}
