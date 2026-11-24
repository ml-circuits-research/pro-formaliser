import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createReader } from '../src/runtime.mjs';
import { parse } from '../src/schema.mjs';
import { alternateBodies, compileAlternations } from '../src/request-alternations.mjs';

function withFacts(grammar,forms) {
  const wires=parse([grammar,...forms.map(([from,to,mode],i)=>
    '@overlay.'+i+' w.lang.en.alternation mode='+mode+' from='+JSON.stringify(from)+' to='+JSON.stringify(to))].join('\n'));
  return compileAlternations(type=>wires.filter(w=>w.type===type));
}

const compile=(...forms)=>withFacts(`
@fixture.neg w.lang.en.neg text=not ending="n't"
@fixture.cond w.lang.en.joiner kind=condition text=if
`,forms);

test('declared overlay wrappers expose the unchanged source span and outer punctuation',()=>{
  const forms=compile(
    ['Captain, {order} if convenient','{order}','request'],
    ['Captain, {order} respectfully','{order}','request'],
    ['could you {order}','{order}','request'],
    ['kindly report what {subject}','what {subject}','question'],
  );
  for (const [input,body,mode] of [
    ['  CAPTAIN, Calibrate the Quartz Sensor respectfully?  ','Calibrate the Quartz Sensor','request'],
    ['Could you Set Width to 2.5?','Set Width to 2.5','request'],
    ['Could you Include "Stop; now?" in the Report.','Include "Stop; now?" in the Report.','request'],
    ['Kindly report WHAT Changed?','WHAT Changed?','question'],
  ]) {
    const [reading,...rest]=alternateBodies(input,forms);
    assert.equal(rest.length,0);
    assert.equal(reading.text,body,input);
    assert.equal(reading.mode,mode);
    assert.equal(input.slice(reading.start,reading.end),body);
    assert.equal(reading.prefix,input.slice(0,reading.start).trim());
    assert.equal(reading.suffix,input.slice(reading.end).trim());
  }
  assert.deepEqual(alternateBodies('Captain, Calibrate Quartz if convenient',forms),[]);
});

test('native negative and scope cue declarations veto removal of arbitrary lexical forms',()=>{
  const forms=withFacts(`
@fixture.neg w.lang.en.neg text=voidify
@fixture.cond w.lang.en.joiner kind=condition text="subject to"
@fixture.scope pro.reader.scope_cue kind=negatives text=debarred
`,[
    ['voidify {body}','{body}','request'],
    ['kindly {body} subject to approval','{body}','request'],
    ['debarred {body}','{body}','request'],
    ['kindly {body}','{body}','request'],
  ]);
  assert.equal(forms.length,1);
  assert.equal(alternateBodies('Kindly voidify the report',forms)[0].text,'voidify the report');
  assert.deepEqual(alternateBodies('Debarred Open the report',forms),[]);
});

test('does not erase semantic markers or reorder, recreate, or duplicate variables',()=>{
  const forms=compile(
    ['could you {action}','{action}','request'],
    ['do not {action}','{action}','request'],
    ['couldn’t you {action}','{action}','request'],
    ['same for {one}','{one}','ellipsis'],
    ['commend {one} around {two}','{two} around {one}','request'],
    ['consider {one} options','{one} options later','request'],
    ['repeat {one} {one}','{one}','request'],
    ['read {one} aloud','{two}','request'],
  );
  assert.deepEqual(alternateBodies('Could you not reopen the old panel?',forms).map(x=>x.text),
    ['not reopen the old panel']);
  for (const input of [
    'Do not reopen the old panel',
    'Couldn’t you reopen the old panel?',
    'Same for the old panel',
    'Commend this around that',
    'Consider the old panel options',
    'Repeat yes yes',
    'Read this aloud',
  ]) assert.deepEqual(alternateBodies(input,forms),[],input);
});

test('protects literal quotes, real clause boundaries, contractions and crossing wrapper matches',()=>{
  const forms=compile(
    ['could you {body}','{body}','request'],
    ["let's {body}",'{body}','request'],
    ['please {body}','{body}','request'],
    ['{body} please','{body}','request'],
    ['🧭 {body}','{body}','request'],
  );
  assert.equal(alternateBodies('Let’s Call the Y Axis Revenue',forms)[0].text,'Call the Y Axis Revenue');
  const unicode='🧭 Open François';
  assert.equal(alternateBodies(unicode,forms)[0].start,unicode.indexOf('Open'));
  for (const input of [
    'Let ’ s Call the Y Axis Revenue',
    'Could you "Delete these"',
    'Could you "Delete these',
    'Could you Check the note? Close the project.',
    'Could you Check the note; Close the project.',
    'Please Open the document please',
    'Could young Open the document?',
  ]) assert.deepEqual(alternateBodies(input,forms),[],input);
});

test('a narrower explicitly declared question can qualify a broader request wrapper',()=>{
  const forms=compile(
    ['I want to {body}','{body}','request'],
    ['I want to know which {choices}','which {choices}','question'],
  );
  const input='I want to know Which Sprint Changed?';
  assert.deepEqual(alternateBodies(input,forms).map(({text,mode})=>[text,mode]),
    [['Which Sprint Changed?','question']]);
  const conflict=compile(['Invite {body}','{body}','request'],['Invite {body}','{body}','question']);
  assert.deepEqual(alternateBodies('Invite Summarize the Report.',conflict),[]);
});

test('one exposed wrapper comma is trimmed while inner punctuation and indices stay exact',()=>{
  const forms=compile(
    ['{body} please','{body}','request'],
    ['kindly {body}','{body}','request'],
    ['report what {body}','what {body}','question'],
  );
  for (const [input,body] of [
    ['Draw a red, blue and yellow hat, please.','Draw a red, blue and yellow hat'],
    ['Kindly, Draw a blue hat?','Draw a blue hat'],
    ['Report, What changed?','What changed?'],
  ]) {
    const [reading]=alternateBodies(input,forms);
    assert.equal(reading.text,body,input);
    assert.equal(input.slice(reading.start,reading.end),body);
  }
  assert.deepEqual(alternateBodies('Kindly,, Draw a blue hat?',forms),[]);
});

test('the reader retains a licensed body reading with the complete request words',async t=>{
  const text='Narrow the circle';
  const model={version:1,templates:[],examples:[{text,count:1,sop:[
    '@r w.request.request act=change mood=do predicate=Narrow',
    '@t w.request.target request=$r family=node mode=existing sort=circle',
    '@c w.request.constraint request=$r on=size attribute=node.width words=Narrow operator=delta phase=result step=less',
  ].join('\n')}]};
  const reader=createReader(model);
  t.after(()=>reader.close());
  const input='Could you Narrow the circle?';
  const result=await reader.propose(input);
  const lifted=result.candidates.find(c=>c.source==='language-alternation' && c.sop.includes('attribute=node.width'));
  assert.ok(lifted);
  assert.ok(result.candidates.some(c=>c.source!=='language-alternation'));
  const request=parse(lifted.sop).find(w=>w.type==='w.request.request');
  assert.equal(JSON.parse(request.attrs.words[0]),input);
  assert.equal(request.attrs.predicate[0],'Narrow');
});

test('a native sequence lead requires a real opening boundary',()=>{
  const rules=withFacts('@seq w.lang.en.alternation family="sequence lead" from="next {body}" to="{body}"',[]);
  assert.deepEqual(alternateBodies('Next, add a lantern',rules).map(r=>[r.mode,r.text]),[['ordered','add a lantern']]);
  for (const input of ['next to the lantern','next week','name it "Next, add a lantern"'])
    assert.deepEqual(alternateBodies(input,rules),[]);
});
