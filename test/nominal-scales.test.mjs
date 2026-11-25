import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { evidenceInText } from '../src/grounding.mjs';
import { tokens } from '../src/lexicon.mjs';
import { quotedSpans } from '../src/literal-roles.mjs';
import { nominalScaleForms, nominalScaleReading } from '../src/nominal-scales.mjs';
import { nominalNumberReading } from '../src/nominal-number.mjs';
import { parse, validate } from '../src/schema.mjs';
import { loadWorlds } from '../src/worlds.mjs';

const base=loadWorlds();
function compile(wires,requestKeys=base.requestKeys) {
  const types=Object.groupBy(parse(wires),wire=>wire.type);
  return {...base,requestKeys,nominalScales:nominalScaleForms(type=>types[type] ?? [],requestKeys)};
}
const worldText=path=>readFileSync(new URL('../.cache/knowledge/docs/worlds/'+path,import.meta.url),'utf8');
const worlds=compile([
  worldText('k.values/shards/scales.sop'),
  worldText('w.lang.en/shards/hand-cues.sop'),
  '@size pro.reader.nominal_scale family=drawn attribute=drawn.size scale=size on=size',
].join('\n'));
const read=(text,sop,knowledge=worlds)=>nominalScaleReading(text,tokens(text),quotedSpans(text),{sop},knowledge);
const request=act=>'@r w.request.request act='+act+' mood=do predicate='+({make:'draw',remove:'remove'}[act] ?? act);
const target=(family,sort,mode)=>'@t w.request.target request=$r family='+family+' mode='+mode+' sort='+sort;
const constraint=(id,key,value,phase,words)=>'@'+id+' w.request.constraint request=$r on=attribute attribute='+key+
  ' value='+JSON.stringify(value)+' operator=eq phase='+phase+(words ? ' words='+JSON.stringify(words):'');
const unread=phrase=>'@u w.request.unread request=$r text='+JSON.stringify(phrase);

test('uses the declared qualitative bank and preserves different determiner and modifier roles',()=>{
  const forms=worlds.nominalScales.byFamily.get('drawn').forms;
  assert.equal([...forms.get('little').values()][0].value,'small');
  assert.equal([...forms.get('large').values()][0].value,'large');
  assert.equal([...forms.get('very large').values()][0].value,'huge');
  assert.equal(forms.has('mini'),false);
  assert.equal(forms.has('larger'),false);
  assert.equal(forms.has('medium - sized'),false);
  const colour=constraint('c','drawn.colour','brown','result');
  const grade=constraint('g','drawn.grade','a little','result');
  const sop=[request('make'),target('drawn','duck','new'),colour,grade,unread('a little brown')].join('\n');
  const text='draw a little brown duck';
  const reading=read(text,sop);
  assert.match(reading.sop,/on=size attribute=drawn\.size value=small words="little" operator=degree phase=result/u);
  assert.match(reading.sop,/attribute=drawn\.colour value="brown"/u);
  assert.doesNotMatch(reading.sop,/attribute=drawn\.grade/u);
  assert.ok(validate(reading.sop,worlds));
  assert.ok(evidenceInText(text,reading.sop,worlds));

  const guarded=sop+'\n@l w.request.lookup request=$r constraint=$g key=value from=page';
  assert.equal(read(text,guarded),undefined);
  assert.equal(read(text,sop.replace('phase=result\n@u','phase=selector\n@u')),undefined);
  assert.equal(read('draw a little brown duck if possible',sop),undefined);
});

test('grounds a selection and traverses an intact multiword colour',()=>{
  const base=[request('remove'),target('drawn','kite','existing'),
    constraint('c','drawn.colour','dark red','selector','dark red'),unread('Large')].join('\n');
  const text='remove the Large dark red kite';
  const reading=read(text,base);
  assert.match(reading.sop,/on=size attribute=drawn\.size value=large words="Large" operator=degree phase=selector/u);
  assert.ok(evidenceInText(text,reading.sop,worlds));
  assert.equal(read(text,base+'\n'+constraint('c2','drawn.colour','red','selector','red')),undefined);
  assert.equal(read('remove the "Large dark red kite"',base),undefined);
  assert.equal(read('remove the Larger dark red kite',base),undefined);
  assert.equal(read('remove the very little dark red kite',base),undefined);
  assert.equal(read('remove the little Large dark red kite',base),undefined);
  assert.equal(read('remove the Large dark red kite by the kite',base),undefined);
});

test('only projects scales authorized for their exact family and qualitative property',()=>{
  const bindings=`
@hardness k.values.scale name=hardness steps=2
@soft k.values.step scale=hardness name=soft rank=1
@hard k.values.step scale=hardness name=hard rank=2
@squishy core.word of=k.values.step.name means=soft text=squishy
@bridge pro.reader.nominal_scale family=stamp attribute=stamp.rigidity scale=hardness on=attribute
@wrong_family pro.reader.nominal_scale family=other attribute=stamp.unbound scale=hardness on=attribute
@wrong_type pro.reader.nominal_scale family=stamp attribute=stamp.mass scale=hardness on=attribute
`;
  const properties=[
    {family:'stamp',name:'stamp.rigidity',head:'class',values:['soft','hard']},
    {family:'stamp',name:'stamp.unbound',head:'class',values:[]},
    {family:'stamp',name:'stamp.mass',head:'number',values:[]},
  ];
  const knowledge=compile(bindings,properties);
  const sop=[request('make'),target('stamp','stamp','new'),unread('squishy')].join('\n');
  const [form]=[...knowledge.nominalScales.byFamily.get('stamp').forms.get('squishy').values()];
  assert.equal(form.attribute,'stamp.rigidity');
  const reading=read('draw a squishy stamp',sop,knowledge);
  assert.match(reading.sop,/attribute=stamp\.rigidity value=soft words="squishy"/u);
});

test('a count traverses the two grounded modifiers without swallowing their evidence',()=>{
  const text='draw three large brown baskets';
  const sop=[request('make'),target('drawn','baskets','new'),
    constraint('c','drawn.colour','brown','result'),unread('three large')].join('\n');
  const scaled=read(text,sop);
  const grounded=nominalNumberReading(text,scaled,worlds.nominalNumbers);
  assert.match(grounded.sop,/count=3 quantity="three" count_words="three"/u);
  assert.match(grounded.sop,/on=size attribute=drawn\.size value=large words="large"/u);
  assert.match(grounded.sop,/attribute=drawn\.colour value="brown"/u);
  assert.ok(evidenceInText(text,grounded.sop,worlds));
  const contested={sop:scaled.sop+'\n'+constraint('other','drawn.size','small','result','large')};
  assert.equal(nominalNumberReading(text,contested,worlds.nominalNumbers),undefined);
});

test('a compound property also licenses separate scale and value when both have their own senses',()=>{
  const sop=[request('make'),target('drawn','kite','new'),
    constraint('c','drawn.colour','medium blue','result')].join('\n');
  const text='draw a medium blue kite';
  const split=nominalScaleReading(text,tokens(text),[],{sop},worlds,{splitCompounds:true});
  assert.match(split.sop,/attribute=drawn.colour value=blue.*words="blue"/u);
  assert.match(split.sop,/attribute=drawn.size value=medium words="medium"/u);
  assert.equal(read('draw a medium unfamiliar kite',sop.replace('medium blue','medium unfamiliar')),undefined);
  const otherSize=read('draw a large medium blue kite',sop);
  assert.match(otherSize.sop,/attribute=drawn.colour value="medium blue"/u);
  assert.match(otherSize.sop,/attribute=drawn.size value=large/u);
});
