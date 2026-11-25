import assert from 'node:assert/strict';
import test from 'node:test';
import { loadWorlds } from '../src/worlds.mjs';
import { namedTargetReading } from '../src/target-names.mjs';
import { evidenceInText } from '../src/grounding.mjs';
import { parse } from '../src/schema.mjs';

const worlds=loadWorlds();
function bind(text, unread) {
  return namedTargetReading(text,{source:'lexicon',sop:[
    '@r w.request.request act=change predicate=reverse',
    '@t w.request.target request=$r mode=existing family=link sort=connection',
    '@u w.request.unread request=$r text='+JSON.stringify(unread),
  ].join('\n')},worlds);
}
test('binds a written name adjacent to its noun before lookup',()=>{
  for (const [text,name] of [['reverse connection z19','z19'],['reverse the Harbor West connection','Harbor West']]) {
    const proposal=bind(text,name);
    assert.ok(proposal.sop.includes('name='+JSON.stringify(name)));
    assert.ok(evidenceInText(text,proposal.sop,worlds));
  }
  assert.equal(bind('reverse connection later','later'),undefined);
  assert.equal(bind('reverse connection to Harbor West','Harbor West'),undefined);
});

const decoded = (wire, key) => JSON.parse(wire.attrs[key][0]);

function lexicon(predicate, unread, description) {
  const sop = [
    '@r w.request.request act=change predicate=' + JSON.stringify(predicate),
    '@r.t w.request.target request=$r family=drawn mode=existing fill=description sort=block' +
      (description ? ' description=' + JSON.stringify(description) : ''),
    ...unread.map((text, index) => '@r.u' + index + ' w.request.unread request=$r text=' + JSON.stringify(text)),
  ].join('\n');
  return {source: 'lexicon', sop, status: 'partial'};
}

test('replaces a generic description and preserves an existing qualified one', () => {
  const text = 'Move the Mercedes block.';
  const proposal = namedTargetReading(text, lexicon('Move', ['the Mercedes'], 'the block'), worlds);
  const target = parse(proposal.sop).find(w => w.type === 'w.request.target');
  assert.equal(decoded(target, 'name'), 'Mercedes');
  assert.equal(target.attrs.description, undefined);
  assert.equal(namedTargetReading(text, lexicon('Move', ['the Mercedes'], 'the Mercedes block'), worlds),
    undefined);
});

const tests = [
  {
    text: 'the Mercedes block same column as the HP block, one row below the BMW block',
    predicate: 'same',
    unread: ['the Mercedes', 'as the HP block,', 'below the BMW block'],
    description: 'the Mercedes block',
  },
  {
    text: 'could you slide block 19 between the first and second blocks, one space down of the centre',
    predicate: 'could',
    unread: ['you slide', '19', 'the first and second blocks, one space', 'of the centre'],
    description: 'block 19',
  },
];

for (const {text, predicate, unread, description} of tests) {
  test('qualifies the typed target as ' + description, () => {
    const candidate = lexicon(predicate, unread);
    const repaired = namedTargetReading(text, candidate, worlds);
    assert.ok(repaired);
    const wires = parse(repaired.sop);
    const target = wires.find(w => w.type === 'w.request.target');
    assert.equal(decoded(target, 'description'), description);
    assert.equal(target.attrs.name, undefined);
    assert.equal(target.attrs.ids, undefined);
    assert.deepEqual(wires.filter(w => w.type === 'w.request.unread').map(w => decoded(w, 'text')),
      unread.filter(span => !description.includes(span)));
    assert.equal(parse(candidate.sop).find(w => w.type === 'w.request.target').attrs.description, undefined);
  });
}

test('requires a unique written qualifier and a spatial boundary for bare numbers', () => {
  assert.equal(namedTargetReading('Move the Mercedes block near the BMW block.',
    lexicon('Move', ['the Mercedes', 'the BMW']), worlds), undefined);
  assert.equal(namedTargetReading('Move the block 19 pixels left.',
    lexicon('Move', ['19', 'pixels left']), worlds), undefined);
  assert.equal(namedTargetReading('Move the spare block left.',
    lexicon('Move', ['the spare', 'left']), worlds), undefined);
  assert.equal(namedTargetReading('Move the block near the BMW block.',
    lexicon('Move', ['near', 'the BMW']), worlds), undefined);
});
