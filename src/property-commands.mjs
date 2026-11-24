import { serialize } from '../.cache/knowledge/tools/sopworld/sopworld.mjs';
import { literalRanges } from './evidence.mjs';
import { tokens } from './lexicon.mjs';

const kinds=['w.request.request','w.request.target','w.request.constraint','w.request.lookup'];
const decode=v=>v?.startsWith('"') ? JSON.parse(v) : v;
const field=(w,k)=>decode(w?.attrs[k]?.[0]);
const normalize=text=>tokens(text).map(t=>t[0]).join(' ');
const endMark=/[.!]+$/u;

function stablePacket(wires,request) {
  const names=new Map([[request.id,'r']]);
  for (const w of wires) if (w!==request) names.set(w.id,w.type===kinds[1] ? 'target' : w.type===kinds[2] ? 'effect' : 'lookup'+names.size);
  const local=wires.filter(w=>w!==request).map(w=>({id:names.get(w.id),type:w.type,attrs:
    Object.fromEntries(Object.entries(w.attrs).map(([k,vs])=>[k,vs.map(v=>v.startsWith('$') ? '$'+names.get(v.slice(1)) : v)]))}));
  if (local.some(w=>Object.values(w.attrs).flat().includes('$undefined'))) return;
  return serialize(local).trim();
}

// Separate the grammatical lead from the written property and its owner.
// Heads must recur with different properties. The complete remaining body
// must independently support its own local circuit under different leads.
export function propertyCommandLearner(worlds) {
  const heads=new Map(), bodies=new Map(), namedEffects=new Map(), owners=new Map();
  const licensed=new Set(worlds.requestKeys.map(k=>JSON.stringify([k.family,k.name])));
  return {
    observe(text,wires) {
      const requests=wires.filter(w=>w.type===kinds[0]);
      for (const r of requests) {
        if (field(r,'act')!=='change' || ![undefined,'do'].includes(field(r,'mood')) ||
            Object.keys(r.attrs).some(k=>!['act','mood','words','predicate'].includes(k))) continue;
        const local=wires.filter(w=>field(w,'request')==='$'+r.id);
        const targets=local.filter(w=>w.type===kinds[1]), effects=local.filter(w=>w.type===kinds[2]);
        if (targets.length!==1 || effects.length!==1 || local.some(w=>!kinds.includes(w.type))) continue;
        const [t]=targets,[c]=effects, family=field(t,'family'),property=field(c,'attribute');
        if (field(t,'mode')!=='existing' || !licensed.has(JSON.stringify([family,property])) ||
            !['eq','delta','degree'].includes(field(c,'operator')) || field(c,'phase')!=='result' ||
            c.attrs.want || !c.attrs.key_words?.length || local.some(w=>w.type===kinds[3] && field(w,'from')!=='page')) continue;
        const scope=(field(r,'words') ?? (requests.length===1 ? text : '')).trim().replace(endMark,'').trimEnd();
        if (!scope || scope.length>240 || /[?!;“”"]/u.test(scope)) continue;
        const terms=[...c.attrs.key_words,...(c.attrs.words ?? c.attrs.value ?? [])].map(decode);
        if (terms.length<=c.attrs.key_words.length) continue;
        const spans=terms.map(v=>literalRanges(scope,v));
        if (spans.some(hits=>hits.length!==1)) continue;
        const cut=Math.min(...spans.map(hits=>hits[0][0]));
        const lead=scope.slice(0,cut).trim(), body=scope.slice(cut);
        const prefix=normalize(lead), predicate=field(r,'predicate');
        if (prefix.split(' ').length>9 || tokens(lead).some(([key])=>worlds.negatives.has(key) ||
            worlds.scopeGrammar.conditionals.has(key) || ['clause','contrast','sequence'].includes(worlds.joiners[key]))) continue;
        const verb=predicate ? literalRanges(lead,predicate) : [];
        if (predicate && verb.length!==1) continue;
        if (['name','description','ids','family_words','sort_words'].some(k=>t.attrs[k]?.some(v=>!literalRanges(body,decode(v)).length))) continue;
        const packet=stablePacket([r,...local],r);
        if (!packet) continue;
        const type=JSON.stringify([family,'change']);
        const headKey=JSON.stringify([prefix,type,normalize(predicate ?? '')]);
        const keys=heads.get(headKey) ?? new Set();
        heads.set(headKey,keys); keys.add(property);
        function record(table,key,meaning,witness) {
          const variants=table.get(key) ?? new Map();
          table.set(key,variants);
          const votes=variants.get(meaning) ?? new Set();
          variants.set(meaning,votes); votes.add(witness);
        }
        record(bodies,JSON.stringify([body,type]),packet,prefix);
        const description=field(t,'description'),ownerWord=field(t,'family_words');
        if (!description || !ownerWord || !literalRanges(description,ownerWord).length || !body.endsWith(description) ||
            Object.keys(t.attrs).some(k=>!['request','family','mode','fill','determiner','description','family_words'].includes(k))) continue;
        const pastEffect=Math.max(...spans.map(hits=>hits[0][1]));
        const rest=scope.slice(pastEffect,scope.length-description.length).trim();
        if (!rest || tokens(rest).length>3 || !worlds.lookup(normalize(rest)).some(([role])=>role==='marker')) continue;
        const effect=scope.slice(cut,pastEffect), suffix=scope.slice(pastEffect).trimStart();
        const lines=packet.split('\n'), targetLine=lines.find(l=>l.startsWith('@target '));
        const effectLines=lines.filter(l=>!l.startsWith('@target ')).join('\n');
        record(namedEffects,JSON.stringify([effect,type]),effectLines,normalize(scope));
        record(owners,JSON.stringify([suffix,type]),targetLine,property);

      }
    },
    finish() {
      const leads=Object.create(null);
      for (const [key,properties] of heads) {
        if (properties.size<2) continue;
        const [prefix,type,predicate]=JSON.parse(key);
        (leads[prefix] ??= []).push({type,predicate});
      }
      function supported(table) {
        const result=Object.create(null);
        for (const [key,variants] of table) {
          if (variants.size!==1) continue;
          const [[packet,votes]]=variants;
          if (votes.size<2) continue;
          const [body,type]=JSON.parse(key);
          (result[body] ??= []).push({type,packet});
        }
        return result;
      }
      return {leads,tails:supported(bodies),namedEffects:supported(namedEffects),owners:supported(owners)};
    }
  };
}

export function propertyCommandPacket(text,ts,grammar) {
  const result={heads:[],bodies:[],effects:[],owners:[]};
  if (!grammar || !ts.length || text.length>480) return result;
  const chars=Array.from(text.trimEnd().replace(endMark,'').trimEnd());
  for (let cut=0;cut<ts.length && cut<=9;cut++) {
    const prefix=ts.slice(0,cut), key=prefix.map(t=>t[0]).join(' ');
    const records=Object.hasOwn(grammar.leads,key) && grammar.leads[key];
    if (!records) continue;
    const body=chars.slice(ts[cut][2]).join('');
    if (grammar.namedEffects && grammar.owners) {
      for (let split=cut+1;split<ts.length;split++) {
        const effect=chars.slice(ts[cut][2],ts[split][2]).join('').trimEnd();
        if (!Object.hasOwn(grammar.namedEffects,effect)) continue;
        const owner=chars.slice(ts[split][2]).join('');
        if (!Object.hasOwn(grammar.owners,owner)) continue;
        for (const {type,packet} of grammar.namedEffects[effect]) result.effects.push([cut,split,type,packet]);
        for (const {type,packet} of grammar.owners[owner]) result.owners.push([split,type,packet]);
      }
    }
    if (!Object.hasOwn(grammar.tails,body) && !result.effects.some(([from])=>from===cut)) continue;
    for (const {type,predicate} of records) {
      const words=predicate.split(' ');
      const pos=predicate ? prefix.findIndex((_,i)=>words.every((w,j)=>prefix[i+j]?.[0]===w)) : -1;
      if (predicate && pos<0) continue;
      const verb=pos<0 ? '' : chars.slice(prefix[pos][2],prefix[pos+words.length-1][3]).join('');
      result.heads.push([cut,type,verb]);
    }
    for (const {type,packet} of (Object.hasOwn(grammar.tails,body) ? grammar.tails[body] : [])) result.bodies.push([cut,type,packet]);
  }
  return result;
}
