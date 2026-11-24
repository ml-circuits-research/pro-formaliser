import { tokens } from './lexicon.mjs';

const initial = /^\p{Lu}$/u;
const title = /^\p{Lu}[\p{L}\p{M}_]*$/u;
const code = /^(\p{L}+)[0-9]+$/u;
const atom = /^[\p{L}_][\p{L}\p{M}\p{N}_.-]*$/u;
const quote = JSON.stringify;
const keysOf = text => tokens(text).map(t=>t[0]);

function licensedFrame(frame,worlds) {
  const {tab,family,key,act,mode,phase}=frame;
  return atom.test(act) && atom.test(family) && atom.test(key) &&
    ((mode==='new' && phase==='result') || (mode==='existing' && phase==='selector')) &&
    worlds.requestKeys.some(row=>row.tab===tab && row.family===family && row.name===key &&
      !row.values.length && row.head.split('+').some(type=>type==='candidate' || type==='span'));
}

export function memberActionPackets(text,ts,quotes,worlds) {
  if (!worlds.memberActions?.length || !ts.length || ts.length>48) return [];
  const chars=Array.from(text);
  const keys=ts.map(([key])=>key);
  const phrase=(start,end)=>keys.slice(start,end).join(' ');
  const span=(start,end)=>chars.slice(ts[start][2],ts[end-1][3]).join('');
  const overlaps=(start,end)=>quotes.some(q=>q.start<ts[end-1][3] && q.end>ts[start][2]);
  const restricted=keys.some((key,i)=>{
    if (overlaps(i,i+1)) return false;
    if (worlds.negatives.has(key)) return true;
    return [1,2,3,4].some(n=>{
      if (i+n>keys.length || overlaps(i,i+n)) return false;
      const surface=phrase(i,i+n);
      return worlds.scopeGrammar.negatives.has(surface) || worlds.scopeGrammar.conditionals.has(surface);
    });
  });
  if (restricted) return [];
  const end=['.','!','?'].includes(keys.at(-1)) && !overlaps(ts.length-1,ts.length) ? ts.length-1 : ts.length;
  const packets=[];
  for (const frame of worlds.memberActions) {
    if (!licensedFrame(frame,worlds)) continue;
    const separators=(frame.separators ?? []).map(keysOf).filter(parts=>parts.length);
    if (!separators.length) continue;
    const suffixes=(frame.suffixes ?? []).map(keysOf).filter(parts=>parts.length);
    const typedCodes=new Set((worlds.instanceBindings ?? []).filter(({family})=>
      worlds.familyTabs[family]?.includes(frame.tab)).map(({prefix})=>prefix));
    const excluded=new Set([...separators,...suffixes].flat());
    const packetTokens=(start,stop)=>{
      const list=[];
      for (let i=start;i<stop;i++) {
        const [key,raw,a]=ts[i];
        const quoted=quotes.find(q=>q.start===a);
        if (quoted) {
          const last=ts.findIndex(([, , ,end])=>end===quoted.end);
          if (last<i || last>=stop || !/[\p{L}\p{N}]/u.test(quoted.value)) return;
          list.push([key,quoted.value,'solo']);
          i=last;
          continue;
        }
        if (overlaps(i,i+1)) return;
        const typed=typedCodes.has(code.exec(key)?.[1]);
        const label=title.test(raw) && (initial.test(raw) || !worlds.evidenceVocabulary.grammar.has(key));
        const declaredAct=worlds.lookup(key).some(([role])=>role==='act');
        const kind=excluded.has(key) ? '' : typed ? 'solo' : label ? declaredAct ? 'solo' : 'word' : '';
        const gap=i===start ? '' : chars.slice(ts[i-1][3],a).join('');
        // Preserve the submitted whitespace inside a multiword written label.
        list.push([key,raw,kind,gap]);
      }
      return list;
    };
    for (let start=0;start<Math.min(12,end);start++) {
      const lead=keys.slice(0,start).filter(key=>key!==',').join(' ');
      if (start && (overlaps(0,start) || !worlds.fillerPhrases.has(lead) && !worlds.literalGrammar.leads.has(lead))) continue;
      if (keys.at(-1)==='?' && !worlds.literalGrammar.leads.has(lead)) continue;
      for (let stop=start+1;stop<Math.min(start+9,end);stop++) {
        if (overlaps(start,stop) || !worlds.lookup(phrase(start,stop)).some(([role,act,mood])=>
          role==='act' && act===frame.act && (!mood || mood==='do'))) continue;
        const input=packetTokens(stop,end);
        if (!input) continue;
        packets.push({family:frame.family,act:frame.act,mode:frame.mode,key:frame.key,phase:frame.phase,
          predicate:span(start,stop),separators,suffixes,input});
      }
    }
  }
  return packets;
}

export function memberActionReadings(text,proofs,worlds) {
  const alternatives=new Map();
  for (const proof of proofs ?? []) {
    const {family,act,mode,key,phase,predicate,members}=proof;
    if (!predicate || !Array.isArray(members) || members.length<2 || members.length>8 ||
        !worlds.memberActions?.some(frame=>frame.family===family && frame.act===act &&
          frame.mode===mode && frame.key===key && frame.phase===phase && licensedFrame(frame,worlds))) continue;
    const sop=[
      '@r1 w.request.request act='+quote(act)+' mood=do predicate='+quote(predicate)+' words='+quote(text),
      '@r1.t w.request.target request=$r1 family='+quote(family)+' mode='+mode+
        (mode==='new' ? ' determiner=indefinite' : ' determiner=definite fill=written ids='+members.map(quote).join(' ids=')),
      ...members.map((value,i)=>'@r1.m'+(i+1)+' w.request.constraint request=$r1 on=attribute attribute='+quote(key)+
        ' value='+quote(value)+' operator=eq phase='+phase)
    ].join('\n');
    alternatives.set(sop,{sop,source:'member-action'});
  }
  return [...alternatives.values()];
}
