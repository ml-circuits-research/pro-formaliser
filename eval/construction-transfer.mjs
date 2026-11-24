// Paired construction transfer probes. Both variants use the same obligations.
import { fileURLToPath } from 'node:url';
import { loadCorpus, normalizeText } from '../src/corpus.mjs';
import { createReader } from '../src/runtime.mjs';
import { loadWorlds } from '../src/worlds.mjs';
import { parse, validate } from '../src/schema.mjs';
import { evidenceInText } from '../src/grounding.mjs';

const pairs = [
  ['threshold-1','threshold',
    'Draw a bar chart of donations by province, only provinces above 740.',
    'For provinces above 740 only, draw a bar chart of donations by province.',
    {shape:'bar', measure:'donations', dimension:'province', scope:'provinces', operator:'gt', threshold:'740'}],
  ['threshold-2','threshold',
    'Build a line graph of renewals by quarter, only quarters at most 215.',
    'For quarters at most 215 only, build a line graph of renewals by quarter.',
    {shape:'line', measure:'renewals', dimension:'quarter', scope:'quarters', operator:'le', threshold:'215'}],
  ['threshold-3','threshold',
    'Show me a column chart of parcels by depot, only depots at least 91.',
    'For depots at least 91 only, show me a column chart of parcels by depot.',
    {shape:'bar', orientation:'vertical', measure:'parcels', dimension:'depot', scope:'depots', operator:'ge', threshold:'91'}],
  ['proximity-1','proximity',
    'Move it immediately right of the barn.',
    'Immediately right of the barn, move it.',
    {reference:'it', direction:'right_of', landmark:'the barn'}],
  ['proximity-2','proximity',
    'Place them just below the window.',
    'Just below the window, place them.',
    {reference:'them', direction:'below', landmark:'the window'}],
  ['proximity-3','proximity',
    'Push it immediately above the diamond.',
    'Immediately above the diamond, push it.',
    {reference:'it', direction:'above', landmark:'the diamond'}],
  ['exception-1','exception',
    'Delete all circles except the purple ones.',
    'Except for the purple circles, delete all circles.',
    {act:'remove', sort:'circle', attribute:'colour', value:'purple'}],
  ['exception-2','exception',
    'Remove every single tree but keep the ones above the bridge.',
    'Keep the trees above the bridge and remove all the other trees.',
    {act:'remove', sort:'tree', attribute:'position', value:'above', landmark:'the bridge'}],
  ['exception-3','exception',
    'Copy all nodes except the yellow ones.',
    'Except for the yellow nodes, copy all nodes.',
    {act:'copy', family:'node', attribute:'colour', value:'yellow'}],
  ['members-1','members',
    'Bold blocks “Archive Notes”, 7, and Appendix.',
    'For blocks “Archive Notes”, 7, and Appendix, apply bold.',
    {act:'change', family:'block', ids:['Archive Notes','7','Appendix'], mark:'bold'}],
  ['members-2','members',
    'Select nodes n17, n29, and n41.',
    'Nodes n17, n29, and n41 should be selected.',
    {act:'pick', family:'node', ids:['n17','n29','n41']}],
  ['members-3','members',
    'Select objects o12 and o27.',
    'Objects o12 and o27 are the ones to select.',
    {act:'pick', family:'drawn', ids:['o12','o27']}],
];

const namespace='w.request.';
const decode=raw=>raw?.startsWith('"') ? JSON.parse(raw) : raw;
const all=(wire,key)=>(wire.attrs[key] ?? []).map(decode);
const one=(wire,key)=>all(wire,key)[0];
const literal=parts=>JSON.stringify(parts);
const wireTypes=new Set(['request','target','constraint','lookup','filler','unread'].map(kind=>namespace+kind));

function matches(conditions,expected) {
  const signature=([key,value,phase,operator='eq',want='yes'])=>literal([key,value,phase,operator,want]);
  const actual=conditions.map(wire=>['attribute','value','phase','operator','want'].map(key=>one(wire,key)));
  return literal(actual.map(signature).sort())===literal(expected.map(signature).sort());
}

function complete(text,sop,kind,expected,worlds) {
  if (!sop || !validate(sop,worlds) || !evidenceInText(text,sop,worlds)) return false;
  const wires=parse(sop);
  const of=type=>wires.filter(wire=>wire.type===namespace+type);
  const [request]=of('request'), [target]=of('target');
  if (of('request').length!==1 || of('target').length!==1 || wires.some(wire=>!wireTypes.has(wire.type)) ||
      one(request,'polarity') || ['check','ask'].includes(one(request,'mood'))) return false;
  const owner='$'+request.id;
  const constraints=of('constraint');
  if ([target,...constraints].some(wire=>one(wire,'request')!==owner) ||
      constraints.some(wire=>all(wire,'value').length!==1)) return false;
  const act=one(request,'act'), family=one(target,'family'), mode=one(target,'mode');
  const qualifiedLookup=anchorKey=>{
    const landmark=constraints.find(wire=>one(wire,'attribute')===anchorKey);
    return landmark && of('lookup').some(wire=>one(wire,'constraint')==='$'+landmark.id && one(wire,'from')==='page');
  };
  if (kind==='threshold') {
    const values={type:expected.shape, measure:expected.measure, dimension:expected.dimension,
      filterScope:expected.scope, filterOperator:expected.operator, filterThreshold:expected.threshold};
    if (expected.orientation) values.orientation=expected.orientation;
    return act==='make' && family==='chart' && mode==='new' &&
      matches(constraints,Object.entries(values).map(([key,value])=>['chart.'+key,value,'result']));
  }
  if (kind==='proximity') {
    const relationKey={node:'node.position',drawn:'drawn.relation'}[family];
    const anchorKey=family+'.anchor';
    return act==='place' && mode==='existing' && one(target,'fill')==='context' && one(request,'refers')==='thing' &&
      relationKey && qualifiedLookup(anchorKey) && matches(constraints,[
        [relationKey,expected.direction,'result','relation'],[relationKey,'near','result','relation'],
        [anchorKey,expected.landmark,'selector','relation'],
      ]);
  }
  if (kind==='exception') {
    const spatial=Boolean(expected.landmark), anchorKey=family+'.anchor';
    const slot=spatial ? {node:'node.position',drawn:'drawn.relation'}[family] : family+'.colour';
    const excluded=[[slot,expected.value,'selector',spatial ? 'relation' : 'eq','no']];
    if (spatial) excluded.push([anchorKey,expected.landmark,'selector','relation']);
    return act===expected.act && mode==='existing' && (!expected.family || family===expected.family) &&
      (!expected.sort || one(target,'sort')===expected.sort) && one(target,'fill')==='all' && one(target,'quantifier')==='all' &&
      (!spatial || qualifiedLookup(anchorKey)) && matches(constraints,excluded);
  }
  const identityKey=family==='block' ? 'block.id' : family+'.ids';
  const members=expected.ids.map(value=>[identityKey,value,'selector']);
  if (expected.mark) members.push(['block.mark',expected.mark,'result']);
  const declared=all(target,'ids');
  return act===expected.act && family===expected.family && mode==='existing' &&
    (!declared.length || literal([...declared].sort())===literal([...expected.ids].sort())) &&
    matches(constraints,members);
}

const corpus = loadCorpus();
const probes = new Set(pairs.flatMap(([, , canonical, alternate]) => [canonical,alternate]).map(normalizeText));
const overlaps = Map.groupBy(corpus.rows.filter(row=>probes.has(normalizeText(row.text))),row=>normalizeText(row.text));
const chartOnly=process.argv.includes('--chart-only');
const worldPath=chartOnly ? '../sop-worlds/chart-predicate-pilot/' : '../sop-worlds/';
const worlds = loadWorlds({paths:[fileURLToPath(new URL(worldPath,import.meta.url))]});
const reader = createReader(undefined,worlds);
const details=process.argv.includes('--details');
const totals={};
try {
  console.log(JSON.stringify({worlds:chartOnly ? 'chart-predicate-pilot' : 'all-staged',
    dataset:corpus.revision, rows:corpus.rows.length, inputs:probes.size, overlaps:overlaps.size}));
  for (const [pair,mechanism,canonical,alternate,expected] of pairs) {
    for (const [wording,text] of [['canonical',canonical],['alternate',alternate]]) {
      const {candidates}=await reader.propose(text);
      const matched=candidates.filter(({sop})=>complete(text,sop,mechanism,expected,worlds));
      const count=totals[mechanism] ??= {canonical:0,alternate:0};
      count[wording]+=Number(matched.length>0);
      console.log(JSON.stringify({pair,mechanism,wording,text,expected,
        overlap:(overlaps.get(normalizeText(text)) ?? []).map(({source,row})=>({source,row})),
        proposals:candidates.length, passingSources:[...new Set(matched.map(({source})=>source))],
        ...(details ? {candidates:candidates.map(({source,sop})=>({source,sop}))} : {})}));
    }
  }
  console.log(JSON.stringify({totals}));
} finally {
  await reader.close();
}
