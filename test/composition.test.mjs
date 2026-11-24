import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { clausePrefixes, composeParts, coordinationActs, createPreservation, sequenceParts } from '../src/composition.mjs';
import { tokens } from '../src/lexicon.mjs';
import { parse, validate } from '../src/schema.mjs';
import { loadWorlds } from '../src/worlds.mjs';

const joiners = {and:'coordination',then:'sequence',also:'addition',but:'contrast',',':'list-or-clause',';':'clause'};
const acts = new Set(['move','remove','paint','create','leave','switch off']);
const split = (text, options) => sequenceParts(text,tokens(text),joiners,{isAct:phrase=>acts.has(phrase),...options});

test('opens a coordinated clause only for a separately attested predicate', () => {
  assert.deepEqual(split('move the box and remove the circle'), ['move the box','remove the circle']);
  assert.deepEqual(split('move the box and the circle'), []);
  assert.deepEqual(split('paint red and blue and create a circle'), ['paint red and blue','create a circle']);
  assert.deepEqual(split('move the box and switch off the page grid'), ['move the box','switch off the page grid']);
});

test('coalesces adjacent connectors and preserves quoted or possessive content', () => {
  assert.deepEqual(split('move the box, and then remove the circle'), ['move the box','remove the circle']);
  assert.deepEqual(split('create “Time and remove the past” and move Alex’s box'), ['create “Time and remove the past”','move Alex’s box']);
  assert.deepEqual(split('create "An \\"and remove\\" label" and move the box'), ['create "An \\"and remove\\" label"','move the box']);
  assert.deepEqual(split('paint the circle; move the box'), ['paint the circle','move the box']);
});

test('keeps bracketed list items together across commas and semicolons', () => {
  assert.deepEqual(split('create [red, move the box; remove the circle], then paint the list'),
    ['create [red, move the box; remove the circle]','paint the list']);
  assert.deepEqual(split('create [red; remove the circle'), ['create [red','remove the circle']);
});

const worlds = {
  requestKeys:[
    {name:'node.keep',family:'node',head:'class',values:['place','all']},
    {name:'drawn.keep',family:'drawn',head:'class',values:['all']},
  ],
  preservationBindings:[
    {family:'node',attribute:'node.keep',concept:'retain'},
    {family:'drawn',attribute:'drawn.keep',concept:'retain'},
  ],
  determiners:{the:'definite'},
  joiners,
  lookup(term) {
    if (term === 'triangle') return [['target','make','node','new','triangle']];
    if (term === 'flower') return [['target','make','drawn','new','flower']];
    return [];
  },
};
const example = (text,predicate,value,target,act='change') => ({
  text,
  sop: '@r w.request.request act='+act+' mood=do predicate='+predicate+'\n'+
    '@t w.request.target request=$r family=node mode=existing description='+JSON.stringify(target)+'\n'+
    '@c w.request.constraint request=$r on=attribute attribute=node.keep value='+value+
    ' operator=eq phase=result words='+JSON.stringify(text),
});
const preserved = createPreservation([
  example('leave the square where it is','leave','place','the square','place'),
  example('the square must stay as it is','stay','all','the square'),
  example('preserve the square untouched','preserve','all','the square'),
],worlds);

test('transfers attested preservation to a grounded target and declared property value', () => {
  const [pos] = preserved.readings('Leave the triangle where it is.');
  assert.ok(validate(pos.sop));
  assert.match(pos.sop, /act=place mood=do predicate="Leave"/u);
  assert.match(pos.sop, /attribute=node.keep value=place operator=eq phase=result/);
  const [all] = preserved.readings('the flower must stay as it is');
  assert.ok(validate(all.sop));
  assert.match(all.sop, /predicate="stay"/u);
  assert.match(all.sop, /attribute=drawn.keep value=all/);
  assert.match(preserved.readings('preserve the flower untouched')[0].sop, /description="the flower"/);
  assert.deepEqual(preserved.readings('leave the flower where it is'),[]);
  assert.deepEqual(preserved.readings('preserve the triangle on the counter'),[]);
  assert.deepEqual(preserved.readings('leave the triangle where it is?'),[]);
});

test('a separate preservation clause composes with the action and retains its own target', () => {
  const text = 'move the box but the flower must stay as it is';
  const parts = split(text,{isPreservation:preserved.recognises});
  assert.deepEqual(parts,['move the box','the flower must stay as it is']);
  const first = {sop:'@r w.request.request act=place mood=do predicate=move\n'+
    '@t w.request.target request=$r family=node mode=existing description="the box"'};
  const sop = composeParts(parts,[first,preserved.readings(parts[1])[0]]);
  assert.ok(validate(sop));
  assert.deepEqual(parse(sop).filter(w=>w.type==='w.request.request').map(w=>w.attrs.predicate[0]),['move','"stay"']);
  assert.match(sop,/request=\$s2.preserve on=attribute attribute=drawn.keep value=all/);
  assert.deepEqual(split('move the box but the flower is on the table',{isPreservation:preserved.recognises}),[]);
});


test('learned noun and adjective senses do not open a coordination on their own', () => {
  const isAct = coordinationActs(worlds, {
    move:[['act','place','do',25]],
    triangle:[['act','make','do',1],['target','make','node','new','triangle',28]],
    red:[['act','change','do',1],['target','make','node','new','red',3]],
    remove:[['act','remove','do',23]],
  });
  assert.deepEqual(split('move the square and triangle',{isAct}),[]);
  assert.deepEqual(split('paint blue and red',{isAct}),[]);
  assert.deepEqual(split('move the square and remove the triangle',{isAct}),['move the square','remove the triangle']);
});

test('stative WordNet facts support maintain and preserve only inside attested retention frames', () => {
  const { stativeVerbAliases } = loadWorlds();
  const readings = createPreservation([
    example('keep the square as it is','keep','all','the square'),
  ],{...worlds,stativeVerbAliases},{remove:[['act','remove','do',23]]});
  for (const verb of ['Maintain','Preserve']) {
    const [answer] = readings.readings(verb+' the triangle as it is');
    assert.ok(validate(answer.sop));
    assert.equal(JSON.parse(parse(answer.sop)[0].attrs.predicate[0]),verb);
  }
  assert.deepEqual(readings.readings('delete the triangle as it is'),[]);
  assert.deepEqual(readings.readings('maintain the triangle on the left'),[]);
  assert.deepEqual(readings.readings('maintain the triangle and remove it as it is'),[]);
});

test('a declared custom preservation key requires matching family, value bank and training evidence', t => {
  const cache = fileURLToPath(new URL('../.cache/',import.meta.url));
  const directory = mkdtempSync(join(cache,'preservation-test-'));
  t.after(()=>rmSync(directory,{recursive:true,force:true}));
  const file = join(directory,'overlay.sop');
  writeFileSync(file,`
@instrument.target pro.reader.target family=instrument sort=fluxometer text=fluxometer act=change mode=existing
@fixture.target pro.reader.target family=fixture sort=bracket text=bracket act=change mode=existing
@instrument.baseline w.request.key tab=workbench family=instrument name=instrument.baseline head=class value="angular registration" value=stability
@fixture.baseline w.request.key tab=workbench family=fixture name=fixture.baseline head=class value="angular registration"
@instrument.preservation pro.reader.preservation family=instrument attribute=instrument.baseline
@fixture.preservation pro.reader.preservation family=fixture attribute=fixture.baseline
`);
  const world = loadWorlds({paths:[file]});
  assert.ok(world.preservationBindings.some(binding=>binding.family==='instrument' &&
    binding.attribute==='instrument.baseline'));
  const training = [
    example('keep the spectrometer in registration','keep','"angular registration"','the spectrometer'),
    example('keep the spectrometer in sync','keep','sync','the spectrometer'),
  ].map(row=>({...row,sop:row.sop.replace('family=node','family=instrument')
    .replace('attribute=node.keep','attribute=instrument.baseline')}));
  const request = 'keep the fluxometer in registration';
  const policy = createPreservation(training,world);
  const [answer] = policy.readings(request);
  assert.ok(validate(answer.sop,world));
  const constraint = parse(answer.sop).find(wire=>wire.type==='w.request.constraint');
  assert.deepEqual(constraint.attrs.attribute,['instrument.baseline']);
  assert.deepEqual(constraint.attrs.value,['"angular registration"']);
  assert.deepEqual(policy.readings('keep the bracket in registration'),[]);
  assert.deepEqual(policy.readings('keep the fluxometer in sync'),[]);
  assert.deepEqual(policy.readings('keep the fluxometer stable'),[]);
  assert.deepEqual(createPreservation([],world).readings(request),[]);
  assert.deepEqual(createPreservation(training,{...world,preservationBindings:[]}).readings(request),[]);
  const shared = {...world,preservationBindings:world.preservationBindings.map(binding =>
    ['instrument','fixture'].includes(binding.family) ? {...binding,concept:'registration'} : binding)};
  const [other] = createPreservation(training,shared).readings('keep the bracket in registration');
  assert.equal(parse(other.sop).find(wire=>wire.type==='w.request.constraint').attrs.attribute[0],'fixture.baseline');
});

test('weak connectors require independent positive predicates, even with noisy learned hits', () => {
  const real = loadWorlds();
  const learned = {
    please:[['act','change','do',47]],
    the:[['act','change','do',168]],
    with:[['act','change','do',58]],
    grab:[['act','pick','do',75]],
    render:[['act','make','do',330]],
    leave:[['act','change','do',744]],
    'forward arrows':[['constraint','change','link','on=attribute attribute=link.arrow value=forward',3]],
  };
  const options = {isAct:coordinationActs(real,learned),prefixes:clausePrefixes(['please','could you'])};
  assert.deepEqual(split('Please, replace Explanation with Detail',options),[]);
  assert.deepEqual(split('render the Intro link solid, yellow, with a Main label and forward arrows',options),[]);
  assert.deepEqual(split('grab the house and the circle and leave the third one',options),[
    'grab the house and the circle','leave the third one',
  ]);
  assert.deepEqual(split('Please, move the house and could you erase the circle',options),[
    'Please, move the house','could you erase the circle',
  ]);
  assert.deepEqual(split('save and undo',options),['save','undo']);
});
