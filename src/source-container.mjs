import { literalRanges } from './evidence.mjs';
import { tokens } from './lexicon.mjs';
import { quotedSpans } from './literal-roles.mjs';
import { parse } from './schema.mjs';
import { serialize } from '../.cache/knowledge/tools/sopworld/sopworld.mjs';

const type=name=>'w.request.'+name;
const decode=raw=>raw?.startsWith('"') ? JSON.parse(raw) : raw;
const fields=(wire,key)=>(wire?.attrs[key] ?? []).map(decode);
const get=(wire,key)=>fields(wire,key)[0];
const normalized=text=>tokens(text).map(([key])=>key).join(' ');
const boundary=new Set([',',';','.','!','?','—','–']);

export function compileSourceContainers(facts) {
  const aliases=facts('pro.reader.source_container').flatMap(wire=>{
    const tab=get(wire,'tab'),family=get(wire,'family');
    return tab && family ? fields(wire,'text').map(label=>({tab,family,label:normalized(label)})) : [];
  });
  const markers=new Map();
  for (const wire of facts('k.actions.role')) {
    if (get(wire,'name')!=='source' || !['place','group','thing'].includes(get(wire,'holds'))) continue;
    const act=get(wire,'act');
    if (!markers.has(act)) markers.set(act,new Set());
    for (const marker of fields(wire,'marker')) markers.get(act).add(normalized(marker));
  }
  return {aliases,markers,surfaces:new Set([...markers.values()].flatMap(items=>[...items]))};
}

export function sourceContainerMatch(text,worlds) {
  const inventory=worlds.sourceContainers;
  if (!inventory?.aliases.length) return [];
  const ts=tokens(text), chars=Array.from(text);
  const offset=[0];
  for (const char of chars) offset.push(offset.at(-1)+char.length);
  const quotes=quotedSpans(text);
  const form=(start,end)=>ts.slice(start,end).map(([key])=>key).join(' ');
  const matches=[];
  for (const marker of inventory.surfaces) {
    const size=marker.split(' ').length;
    for (let i=0;i+size+1<ts.length;i++) {
      const det=i+size;
      if (worlds.determiners[ts[det][0]]!=='definite' || form(i,det)!==marker) continue;
      for (const entry of inventory.aliases) {
        const end=det+1+entry.label.split(' ').length;
        if (end>ts.length || form(det+1,end)!==entry.label) continue;
        const following=ts[end]?.[0];
        if (following && !boundary.has(following) && !worlds.joiners[following] &&
            !worlds.scopeGrammar.negatives.has(following)) continue;
        const from=ts[i][2],to=ts[end-1][3];
        if (quotes.some(q=>q.start<to && q.end>from)) continue;
        matches.push({...entry,marker,from:offset[from],to:offset[to],
          written:text.slice(offset[ts[det][2]],offset[to])});
      }
    }
  }
  return matches;
}

export function sourceContainerReading(text,candidate,worlds,matches=sourceContainerMatch(text,worlds)) {
  if (!matches.length || !candidate.sop?.includes(' w.request.unread ')) return;
  const wires=parse(candidate.sop);
  const requests=wires.filter(w=>w.type===type('request'));
  const members=Map.groupBy(wires,w=>get(w,'request'));
  const ids=new Set(wires.map(w=>w.id)), accepted=new Map();
  let next=0;
  for (const request of requests) {
    const act=get(request,'act'),mode=get(request,'mood');
    const scope=get(request,'words') ?? (requests.length===1 ? text : undefined);
    const bounds=scope && literalRanges(text,scope,next)[0];
    if (!bounds) continue;
    next=bounds[1];
    if (request.attrs.polarity || ![undefined,'do','propose'].includes(mode) ||
        !worlds.sourceContainers.markers.has(act)) continue;
    const ref='$'+request.id;
    const local=members.get(ref) ?? [];
    const targets=local.filter(w=>w.type===type('target'));
    const [target]=targets;
    if (targets.length!==1 || get(target,'mode')!=='existing') continue;
    const family=get(target,'family'), tabs=worlds.familyTabs[family] ?? [];
    const sources=new Map();
    for (const wire of local) {
      if (wire.type!==type('unread')) continue;
      const written=get(wire,'text');
      const raw=written?.replace(/[.!]$/u,'').trimEnd();
      const hit=literalRanges(text,raw,...bounds);
      if (hit.length!==1) continue;
      const [[from,to]]=hit;
      for (const source of matches) {
        if (source.from!==from || source.to!==to || source.family===family || !tabs.includes(source.tab) ||
            !worlds.familyTabs[source.family]?.includes(source.tab) ||
            !worlds.sourceContainers.markers.get(act).has(source.marker)) continue;
        sources.set(JSON.stringify([wire.id,source.family]),{...source,wire,start:from});
      }
    }
    if (sources.size!==1) continue;
    const [source]=sources.values();
    const head=get(target,'sort_words') ?? get(target,'family_words') ?? get(target,'sort') ??
      get(target,'description') ?? get(target,'name');
    // The container follows an independently written target or a bound
    // direct pronoun. It cannot supply the affected target itself.
    const before=text.slice(bounds[0],source.start);
    if (head ? !literalRanges(before,head).length :
        !(get(request,'refers')==='thing' && tokens(before).some(([key])=>worlds.isReference(key)))) continue;
    if (local.some(w=>w.type===type('constraint') && ['words','value'].some(key=>fields(w,key).some(value=>
      literalRanges(get(source.wire,'text'),value).length)))) continue;
    function id(key) {
      const base=request.id+'.'+key;
      let result=base;
      for (let n=2;ids.has(result);n++) result=base+n;
      ids.add(result);
      return result;
    }
    const targetId=id('sourceContainer');
    accepted.set(source.wire,[
      {id:targetId,type:type('target'),attrs:{request:[ref],family:[source.family],mode:['existing'],
        determiner:['definite'],fill:['context'],family_words:[JSON.stringify(source.written)]}},
      {id:id('sourceContainerLookup'),type:type('lookup'),attrs:{
        request:[ref],target:['$'+targetId],key:['thing'],from:['page']}},
    ]);
    if (!request.attrs.words) {
      accepted.set(request,[{...request,attrs:{...request.attrs,words:[JSON.stringify(scope)]}}]);
    }
  }
  if (!accepted.size) return;
  const revised=wires.flatMap(wire=>accepted.get(wire) ?? [wire]);
  return {sop:serialize(revised).trimEnd(),source:'source-container',
    status:revised.some(w=>w.type===type('unread')) ? 'partial' : 'matched'};
}
