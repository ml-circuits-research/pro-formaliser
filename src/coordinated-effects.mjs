import {parse,serialize} from '../.cache/knowledge/tools/sopworld/sopworld.mjs';
import {tokens} from './lexicon.mjs';

const atom=value=>/^[\p{L}_][\p{L}\p{M}\p{N}_.-]*$/u.test(value) ? value : JSON.stringify(value);
const value=(wire,key)=>{
  const raw=wire.attrs[key]?.[0];
  return raw?.startsWith('"') ? JSON.parse(raw) : raw;
};
const nominal=/^\p{Lu}[\p{L}\p{M}\p{N}_]*$/u;

// Emit chart edges for the words actually present. A property value is typed
// by its own catalog field; the grammar can never borrow it for another family.
export function coordinatedPacket(ts,worlds,learned={}) {
  const end=ts.length-Number(['.','?','!'].includes(ts.at(-1)?.[0]));
  const keys=ts.slice(0,end).map(t=>t[0]);
  if (!worlds.effectFrames?.length || !keys.some(k=>worlds.joiners[k]==='coordination')) return;
  const events=[],seen=new Set();
  function add(start,stop,role,family='',key='',val='') {
    const event=[start,stop,role,family,key,val], id=JSON.stringify(event);
    if (!seen.has(id)) {seen.add(id);events.push(event);}
  }
  for (let i=0;i<end;i++) {
    if (worlds.joiners[keys[i]]==='coordination') {
      add(i,i+1,'join');
      if (i>=2 && i+2<end && keys[i-1]==='-' && keys[i+1]==='-' &&
          ts.slice(i-2,i+2).every((t,j)=>t[3]===ts[i-1+j]?.[2])) add(i-1,i+2,'join');
    }
    for (let j=i+1;j<=Math.min(i+8,end);j++) {
      const term=keys.slice(i,j).join(' ');
      const senses=worlds.lookup(term);
      const entries=[...senses,...(Object.hasOwn(learned,term) ? learned[term] : [])];
      for (const [role,act,family,mode,sort,count] of entries) {
        if (role==='target' && act==='change' && mode==='existing' && (!count || sort===term && worlds.literalGrammar.licenses(family,act))) {
          for (let start=i;start>=0 && start>=i-4;start--) {
            const determiner=worlds.determiners[keys[start]], offset=start+Number(Boolean(determiner));
            if (determiner && !['definite','demonstrative','possessive'].includes(determiner) ||
                offset>i || !ts.slice(offset,i).every(t=>nominal.test(t[1]))) continue;
            add(start,j,'owner',family);
          }
        }
      }
      const verbal=entries.some(([kind,act,mood])=>kind==='act' && act==='change' && (!mood || mood==='do'));
      for (const [role,act,family,body] of entries) {
        if (role!=='constraint' || !['*','change'].includes(act)) continue;
        const [w]=parse('@p w.request.constraint '+body);
        const key=value(w,'attribute'),val=value(w,'value');
        if (value(w,'operator')!=='eq' || value(w,'phase')!=='result' || value(w,'on')!=='attribute' ||
            w.attrs.want || w.attrs.value?.length!==1 || !worlds.effectBanks.get(family)?.get(key)?.has(val)) continue;
        add(i,j,'effect',family,key,val);
        if (verbal) add(i,j,'verbal_effect',family,key,val);
      }
    }
  }
  if (!events.some(e=>e[2]==='owner') || !events.some(e=>e[2]==='effect')) return;
  return {keys,events,frames:worlds.effectFrames};
}

export function effectGrammar(facts,keys) {
  const effectFrames=facts('pro.reader.coordinated_effects').map(w=>
    (w.attrs.part ?? []).map(s=>s.startsWith('"') ? JSON.parse(s) : s))
    .filter(p=>p.length<=10 && p.filter(s=>s==='owner').length===1 && p.filter(s=>['effect','verbal_effect'].includes(s)).length===2 &&
      p.filter(s=>s==='join').length===1)
    .map(parts=>parts.map(p=>['owner','effect','verbal_effect','join'].includes(p) ? p : tokens(p).map(t=>t[0])));
  const effectBanks=new Map();
  for (const k of keys.filter(k=>k.values.length)) {
    const bank=effectBanks.get(k.family) ?? new Map();
    const values=bank.get(k.name) ?? new Set();
    k.values.forEach(v=>values.add(v)); bank.set(k.name,values);effectBanks.set(k.family,bank);
  }
  return {effectBanks,effectFrames};
}

export function effectReading(text,ts,{family,owner,effects}) {
  const chars=Array.from(text), span=([from,to])=>chars.slice(ts[from][2],ts[to-1][3]).join('');
  const target=span(owner);
  const wires=[{id:'r',type:'w.request.request',attrs:{act:['change'],mood:['do'],words:[JSON.stringify(text)]}},
    {id:'target',type:'w.request.target',attrs:{request:['$r'],family:[atom(family)],mode:['existing'],fill:['description'],description:[JSON.stringify(target)]}}];
  for (const [i,[from,to,key,val]] of effects.entries()) wires.push({id:'effect'+i,type:'w.request.constraint',
    attrs:{request:['$r'],on:['attribute'],attribute:[atom(key)],value:[atom(val)],words:[JSON.stringify(span([from,to]))],operator:['eq'],phase:['result']}});
  return {sop:serialize(wires),source:'coordinated-effects',status:'matched'};
}
