import assert from 'node:assert/strict';
import test from 'node:test';
import { createOpenPairLearner, openPairReadings } from '../src/open-pairs.mjs';
import { evidenceInText } from '../src/grounding.mjs';
import { tokens } from '../src/lexicon.mjs';
import { quotedSpans } from '../src/literal-roles.mjs';
import { parse, validate } from '../src/schema.mjs';
import { loadWorlds } from '../src/worlds.mjs';

const worlds = loadWorlds();
const chart = '@r w.request.request act=make mood=do predicate=make\n' +
  '@t w.request.target request=$r family=chart mode=new';
const rename = '@r w.request.request act=change mood=do predicate=rename\n' +
  '@t w.request.target request=$r family=node mode=existing';
const attribute = (id,key,value,phase='result') =>
  '@'+id+' w.request.constraint request=$r on=attribute attribute='+key+
  ' value='+JSON.stringify(value)+' operator=eq phase='+phase;
const unread = text => '@u w.request.unread request=$r text='+JSON.stringify(text);
const witnesses = [['orders','region'], ['sales','month'], ['claim cost','policy type'], ['revenue','department']];

function train(annotations) {
  const learner = createOpenPairLearner(worlds);
  for (const {text,sop} of annotations) {
    const [request,target,...constraints] = parse(sop);
    learner.observe(text,request,target,constraints);
  }
  return learner.finish();
}

const rows = witnesses.map(([left,right]) => ({
  text:'make a bar chart of '+left+' grouped by '+right,
  sop:[chart,attribute('a','chart.measure',left),attribute('b','chart.dimension',right)].join('\n'),
}));
const renames = witnesses.map(([left,right]) => ({
  text:'rename '+left+' to '+right,
  sop:[rename+' name='+JSON.stringify(left),attribute('a','node.label',right)].join('\n'),
}));
const read = (text,sop,forms) => openPairReadings(text,tokens(text),quotedSpans(text),{sop},forms,worlds);
const learned = train([...rows,...renames]);

test('learns open text roles and connector from independent varying examples', () => {
  const prefix = 'make a bar chart of ';
  const [answer] = read(prefix+'Tickets GROUPED BY market tier — only approved tickets',
    [chart,unread('of Tickets GROUPED BY market tier — only approved tickets')].join('\n'),learned);
  assert.match(answer.sop,/attribute=chart\.measure value="Tickets" words="Tickets"/u);
  assert.match(answer.sop,/attribute=chart\.dimension value="market tier" words="market tier"/u);
  assert.match(answer.sop,/only approved tickets/u);
  assert.ok(validate(answer.sop,worlds));
  assert.ok(evidenceInText(prefix+'Tickets GROUPED BY market tier — only approved tickets',answer.sop,worlds));
  assert.deepEqual(train(Array(10).fill(rows[0])),{});
  assert.deepEqual(train([...rows,{
    text:rows[0].text,sop:[chart,attribute('a','chart.yLabel','orders'),attribute('b','chart.xLabel','region')].join('\n'),
  }]),{});
});

test('binds a written selector and quoted replacement without reinterpreting quoted separators', () => {
  const text = 'rename "Partners to Contact" to "New — Notes"';
  const [answer] = read(text,[rename,unread('"Partners to Contact" to "New — Notes"')].join('\n'),learned);
  assert.match(answer.sop,/fill=written name="Partners to Contact"/u);
  assert.match(answer.sop,/attribute=node\.label value="New — Notes"/u);
  assert.ok(validate(answer.sop,worlds));
  assert.ok(evidenceInText(text,answer.sop,worlds));
});

test('declines no-evidence, incompatible, negated and ambiguous spans', () => {
  const prefix = 'make a bar chart of ';
  assert.deepEqual(read(prefix+'tickets grouped by market with a legend',chart,learned),[]);
  assert.deepEqual(read(prefix+'tickets grouped by market as a pie chart',chart,learned),[]);
  assert.deepEqual(read(prefix+'how the tickets are distributed grouped by market',chart,learned),[]);
  assert.deepEqual(read(prefix+'tickets grouped by market should be horizontal',chart,learned),[]);
  assert.deepEqual(read(prefix+'a grouped by -market',chart,learned),[]);
  assert.deepEqual(read(prefix+'tickets grouped by market grouped by client',chart,learned),[]);
  assert.deepEqual(read(prefix+'tickets grouped by market',chart.replace('family=chart','family=node'),learned),[]);
  assert.deepEqual(read('do not '+prefix+'tickets grouped by market',chart,learned),[]);
  assert.deepEqual(read(prefix+'tickets grouped by market',
    [chart,attribute('a','chart.measure','sales')].join('\n'),learned),[]);
});
