import { tokens } from './lexicon.mjs';
import { politeBody } from './trailing-discourse.mjs';

const decode=value=>value?.startsWith('"') ? JSON.parse(value) : value;
const values=(wire,key)=>(wire.attrs[key] ?? []).map(decode);
const one=(wire,key)=>values(wire,key)[0];
const form=text=>tokens(text).map(([key])=>key).join(' ');
const quote=JSON.stringify;

// A reader binding selects a native frame with a closed, role-free body and
// maps its result to the current request act bank.
export function compileClosedRequests(facts,acts) {
  const frames=new Map(facts('w.lang.en.frame').map(frame=>[one(frame,'name'),frame]));
  const parts=Map.groupBy(facts('w.lang.en.part'),part=>one(part,'frame'));
  const fixed=new Set(facts('w.lang.en.fixed').map(wire=>one(wire,'frame')));
  return facts('pro.reader.closed_request').flatMap(binding=>{
    const frame=one(binding,'frame'), act=one(binding,'act');
    if (!frames.has(frame) || frames.get(frame).attrs.role || fixed.has(frame) || !acts.has(act)) return [];
    const choices=new Map();
    for (const entry of values(binding,'word')) {
      const match=/^(\d+):(.+)$/u.exec(entry);
      if (!match) return [];
      const [,part,surface]=match;
      const accepted=choices.get(part) ?? new Set();
      accepted.add(form(surface));
      choices.set(part,accepted);
    }
    const ordered=(parts.get(frame) ?? []).slice().sort((a,b)=>Number(one(a,'at'))-Number(one(b,'at')));
    const pattern=[];
    for (const part of ordered) {
      const kind=one(part,'is'), optional=one(part,'optional')==='yes';
      if (kind==='lead' && optional) continue;
      if (kind==='det' && optional) { pattern.push({optional,determiner:true}); continue; }
      const variants=values(part,'word').map(form).filter(Boolean);
      if (kind!=='word' || !variants.length) return [];
      const number=one(part,'at');
      const accepted=choices.get(number);
      if (accepted && [...accepted].some(value=>!variants.includes(value))) return [];
      const forms=accepted ? variants.filter(value=>accepted.has(value)) : variants;
      choices.delete(number);
      if (!forms.length) return [];
      pattern.push({optional,forms:forms.map(value=>[value,value.split(' ').length])});
    }
    if (choices.size || !pattern.some(part=>!part.optional)) return [];
    return [{act,pattern,courtesy:one(binding,'courtesy')==='true'}];
  });
}

function atEnd(pattern,part,at,end,phrase,determiners) {
  if (part===pattern.length) return at===end;
  const item=pattern[part];
  if (item.optional && atEnd(pattern,part+1,at,end,phrase,determiners)) return true;
  if (at===end) return false;
  if (item.determiner) return Boolean(determiners[phrase(at,at+1)]) &&
    atEnd(pattern,part+1,at+1,end,phrase,determiners);
  return item.forms.some(([value,width])=>at+width<=end && phrase(at,at+width)===value &&
    atEnd(pattern,part+1,at+width,end,phrase,determiners));
}

export function closedRequestReadings(text,ts,worlds,politeness) {
  const body=politeBody(text,ts,politeness,1);
  if (!body) return [];
  const {start,end,fillers,phrase,span}=body;
  const readings=[];
  for (const {act,pattern,courtesy} of worlds.closedRequests) {
    if (courtesy && !fillers.length || !atEnd(pattern,0,start,end,phrase,worlds.determiners)) continue;
    const sop=[
      '@r w.request.request act='+quote(act)+' mood=do words='+quote(text)+' predicate='+quote(span(start,end)),
      ...fillers.map((words,i)=>'@f'+(i+1)+' w.request.filler text='+quote(words)),
    ].join('\n');
    readings.push({sop,source:'closed-request',status:'matched'});
  }
  return readings;
}
