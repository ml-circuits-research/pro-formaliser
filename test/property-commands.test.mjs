import assert from 'node:assert/strict';
import test from 'node:test';
import {createFormaliser} from '../src/formaliser.mjs';
import {propertyCommandLearner} from '../src/property-commands.mjs';
import {loadWorlds} from '../src/worlds.mjs';
import {parse} from '../src/schema.mjs';

test('the normal Prolog reader joins a proven edit lead and a complete property phrase',async()=>{
  const worlds=loadWorlds(),learner=propertyCommandLearner(worlds);
  const teach=(lead,noun,key,word,owner)=>{
    const text=lead+' '+noun+' '+word+(owner ? ' on '+owner : '');
    learner.observe(text,parse([
      '@r w.request.request act=change mood=do predicate='+lead,
      '@t w.request.target request=$r family=chart mode=existing fill=context'+(owner ? ' description='+JSON.stringify(owner)+' family_words=chart' : ''),
      '@l w.request.lookup request=$r target=$t from=page key=thing',
      '@c w.request.constraint request=$r on=attribute attribute='+key+' key_words='+noun+' words='+word+' step=more operator=delta phase=result',
    ].join('\n')));
  };
  for(const verb of ['set','try']) teach(verb,'caps','chart.errorCap','thicker');
  teach('make','font','chart.fontSize','larger');
  teach('make','points','chart.markerSize','larger');
  teach('set','caps','chart.errorCap','thicker','Orchard chart');
  teach('try','caps','chart.errorCap','thicker','Winter chart');
  teach('make','font','chart.fontSize','larger','Market chart');
  teach('try','points','chart.markerSize','larger','Market chart');
  const r=createFormaliser({version:1,templates:[],examples:[],propertyCommands:learner.finish()},worlds);
  try {
    const reading=async text=>(await r.formalise(text)).candidates.find(c=>c.source==='property-command');
    assert.match((await reading('Make caps thicker.')).sop,/predicate="Make"/);
    const named=await reading('Make caps thicker on Market chart.');
    assert.match(named.sop,/description="Market chart"/);
    assert.match(named.sop,/attribute=chart.errorCap/);
    assert.doesNotMatch(named.sop,/Orchard|Winter/);
    assert.equal(await reading('Never make caps thicker.'),undefined);
    assert.equal(await reading('Make caps thicker on the second plot.'),undefined);
    assert.equal(await reading('Make points larger.'),undefined);
  } finally {await r.close();}
});
