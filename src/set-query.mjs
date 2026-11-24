import { consumeUnread } from './nominal-evidence.mjs';
import { tokens } from './lexicon.mjs';
import { parse } from './schema.mjs';
import { serialize } from '../.cache/knowledge/tools/sopworld/sopworld.mjs';

const value=(wire,key)=>{
  const raw=wire.attrs[key]?.[0];
  return raw?.startsWith('"') ? JSON.parse(raw) : raw;
};
const keyOf=items=>items.map(([key])=>key).join(' ');
const quotation=JSON.stringify;
const nominal=/^[\p{L}\p{M}\p{N}_]+$/u;

export function* postfixSetQuestions(text, ts, worlds, hits, quotes) {
  if (quotes.length || ts.at(-1)?.[0]!=='?' || ts.length<3) return;
  const words=Array.from(text);
  for (let end=1;end<ts.length-1;end++) {
    const head=keyOf(ts.slice(end,-1));
    const question=worlds.scopeGrammar.questions.get(head);
    if (question?.type!=='count' || !worlds.lookup(head).some(([role,act])=>role==='act' && act==='ask')) continue;
    const start=worlds.determiners[ts[0][0]]==='definite' ? 1 : 0;
    if (start>=end || !ts.slice(start,end).every(([key])=>nominal.test(key))) continue;
    const left=ts[start][2], right=ts[end-1][3];
    const name=words.slice(left,right).join('');
    const predicate=words.slice(ts[end][2],ts.at(-2)[3]).join('');
    for (const [a,b,[role,act,family,mode,sort]] of hits) {
      if (a!==left || b!==right || role!=='target' || mode!=='existing' || !['ask','place','change'].includes(act)) continue;
      yield {source:'set-query',status:'partial',sop:[
        '@r1 w.request.request act=ask mood=ask question=count predicate='+quotation(predicate),
        '@r1.t w.request.target request=$r1 family='+quotation(family)+' mode=existing fill=all '+
          (sort ? 'sort='+quotation(sort)+' sort_words=' : 'family_words=')+quotation(name),
      ].join('\n')};
    }
  }
}

export function universalTargetReading(text, ts, worlds, candidate, quotes, requiresResult=false) {
  if (!worlds.scopeGrammar.universals.size) return;
  const wires=parse(candidate.sop);
  const requests=wires.filter(w=>w.type==='w.request.request');
  const targets=wires.filter(w=>w.type==='w.request.target');
  if (requests.length!==1 || targets.length!==1) return;
  const [request]=requests, [target]=targets;
  if (requiresResult && !wires.some(w=>w.type==='w.request.constraint' && value(w,'request')==='$'+request.id &&
      value(w,'phase')==='result' && w.attrs.attribute && w.attrs.value && !w.attrs.want)) return;
  if (value(target,'mode')!=='existing' || ['name','description','ids','thing','count','ordinal','quantity','quantifier','count_words']
      .some(key=>target.attrs[key])) return;
  const head=value(target,'sort_words') ?? value(target,'family_words') ?? value(target,'sort');
  if (!head) return;
  const headKey=keyOf(tokens(head));
  const length=tokens(head).length;
  const starts=ts.flatMap((_,i)=>keyOf(ts.slice(i,i+length))===headKey ? [i] : []);
  if (starts.length!==1) return;
  const [index]=starts;
  for (const form of worlds.scopeGrammar.universals) {
    const before=form.split(' ').length;
    const preceding=ts[index-1]?.[0];
    const numeric=worlds.nominalNumbers.get(preceding) ??
      (/^\d{1,8}$/u.test(preceding ?? '') ? {kind:'cardinal',value:preceding} : undefined);
    const counted=numeric?.kind==='cardinal' && worlds.scopeGrammar.countedUniversals.has(form);
    const end=counted ? index-1 : index;
    const start=end-before;
    if (start<0 || keyOf(ts.slice(start,end))!==form || worlds.negatives.has(ts[start-1]?.[0])) continue;
    const from=ts[start][2], to=ts[index+length-1][3];
    if (quotes.some(q=>q.start<to && q.end>from)) continue;
    const chars=Array.from(text);
    const surface=chars.slice(from,to).join('');
    const clause=value(request,'words');
    if (clause && !clause.includes(surface)) continue;
    // The quantifier supplies target scope. A competing property selector
    // grounded only in that same occurrence must not restrict the selected set.
    const scoped=wires.filter(w=>{
      if (w.type!=='w.request.constraint' || w.attrs.key_words || value(w,'phase')!=='selector') return true;
      const evidence=value(w,'words') ?? value(w,'value');
      if (!evidence) return true;
      const terms=tokens(evidence).map(t=>t[0]);
      const positions=ts.flatMap((_,i)=>terms.every((key,j)=>ts[i+j]?.[0]===key) ? [i] : []);
      return positions.length!==1 || positions[0]<start || positions[0]+terms.length>index;
    });
    const revised=consumeUnread(scoped,text,chars.slice(0,from).join('').length,chars.slice(0,ts[index][2]).join('').length);
    target.attrs={...target.attrs,fill:['all'],quantifier:['all'],count_words:[quotation(surface)],...(counted ? {count:[String(numeric.value)]} : {})};
    delete target.attrs.determiner;
    return {sop:serialize(revised).trimEnd(),source:'universal-target',status:candidate.status};
  }
}
