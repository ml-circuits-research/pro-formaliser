import assert from 'node:assert/strict';
import test from 'node:test';
import { clauseQualifiers } from '../src/clause-qualifiers.mjs';
import { evidenceInText } from '../src/grounding.mjs';
import { maskQuoted } from '../src/literal-roles.mjs';
import { requestScope } from '../src/request-scope.mjs';
import { parse, validate } from '../src/schema.mjs';
import { loadWorlds } from '../src/worlds.mjs';

const worlds=loadWorlds();
const key=(wire,name)=>wire.attrs[name]?.[0];
const qualify=(text,sop)=>clauseQualifiers(text,worlds,{},(scope,quotes)=>
  !requestScope(scope,maskQuoted(scope,quotes),worlds,[]).restricted)({sop});
const first=[
  '@make w.request.request act=make predicate=Create words="Create a bar chart"',
  '@chart w.request.target request=$make family=chart mode=new',
  '@type w.request.constraint request=$make on=attribute attribute=chart.type value=bar words="bar chart" operator=eq phase=result',
].join('\n');

test('grounds a fixed property on the owned clause after a declared conjunction',()=>{
  const text='Create a bar chart; and show the values on it';
  const second=[
    '@show w.request.request act=change predicate=show words="and show the values on it"',
    '@shown w.request.target request=$show family=chart mode=existing fill=context family_words=values',
    '@lookup w.request.lookup request=$show target=$shown key=thing from=page',
    '@other w.request.unread request=$show text="on it"',
  ].join('\n');
  const original=first+'\n'+second;
  const [base,...replacement]=parse(original);
  const alternative=qualify(text,original);
  const wires=parse(alternative.sop);
  assert.deepEqual(wires.filter(wire=>['make','chart','type','lookup','show','shown'].includes(wire.id)),
    [base,...replacement].filter(wire=>['make','chart','type','lookup','show','shown'].includes(wire.id)));
  const visibility=wires.find(wire=>key(wire,'attribute')==='chart.show_values');
  assert.equal(key(visibility,'request'),'$show');
  assert.equal(key(visibility,'value'),'show');
  assert.match(alternative.sop,/w\.request\.unread request=\$show text="on it"/u);
  assert.ok(validate(alternative.sop,worlds));
  assert.ok(evidenceInText(text,alternative.sop,worlds));
});

test('uses a preceding compatible scope to assemble an independent fixed property alternative',()=>{
  const text='Create a bar chart; show both grid lines';
  const second=[
    '@show w.request.request act=ask mood=ask predicate=show words="show both grid lines"',
    '@lines w.request.target request=$show family=drawn mode=existing fill=description sort=lines',
    '@grid w.request.constraint request=$show on=attribute attribute=drawn.arrangement value=grid operator=eq phase=selector',
    '@old w.request.unread request=$show text=both',
  ].join('\n');
  const original=first+'\n'+second;
  const candidate=qualify(text,original);
  const wires=parse(candidate.sop);
  const target=wires.find(wire=>wire.type==='w.request.target' && key(wire,'request')==='$show');
  const lookup=wires.find(wire=>wire.type==='w.request.lookup' && key(wire,'request')==='$show');
  assert.equal(key(target,'family'),'chart');
  assert.equal(key(lookup,'target'),'$'+target.id);
  assert.ok(wires.some(wire=>key(wire,'attribute')==='chart.grid' && key(wire,'value')==='show'));
  assert.match(candidate.sop,/w\.request\.unread request=\$show text="both"/u);
  assert.ok(validate(candidate.sop,worlds));
  assert.equal(qualify(text,original+'\n@dependent w.request.lookup request=$make target=$lines key=thing from=page'),undefined);
});

test('declines overlapping, guarded, and semantically independent selectors',()=>{
  const second=[
    '@show w.request.request act=change predicate=show words="and show the values if present"',
    '@shown w.request.target request=$show family=chart mode=existing fill=context',
  ].join('\n');
  assert.equal(qualify('Create a bar chart; and show the values if present',first+'\n'+second),undefined);
  const overlap=first.replace('Create a bar chart"','Create a bar chart; and show"');
  const ordinary=second.replace('the values if present','the values');
  assert.equal(qualify('Create a bar chart; and show the values',overlap+'\n'+ordinary),undefined);
  const wrong=ordinary.replace('family=chart mode=existing fill=context','family=node mode=existing fill=written name=values');
  assert.equal(qualify('Create a bar chart; and show the values',first+'\n'+wrong),undefined);
});
