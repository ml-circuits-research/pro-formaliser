import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const prolog = fileURLToPath(new URL('../tools/swipl', import.meta.url));
const program = fileURLToPath(new URL('../prolog/language_frames.pl', import.meta.url));

function proofs(query) {
  const goal = 'use_module(library(http/json)),json_read_dict(user_input,Q),frame_proofs(Q,P),json_write_dict(current_output,P)';
  const result = spawnSync(prolog, ['-q', '-f', 'none', '-s', program, '-g', goal, '-t', 'halt'],
    { input: JSON.stringify(query), encoding: 'utf8', timeout: 5000 });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

const part = (kind, value, optional = false) => [kind, value, optional];
const role = (name, start, end) => ({ role: name, range: [start, end] });

test('matches whole frames in declared order with optional and multi-token lexical events', () => {
  const placement = [
    part('lead', 'please', true), part('verb', 'place'), part('det', 'definite', true),
    part('role', 'thing'), part('word', 'next to'), part('role', 'place'),
  ];
  const frames = [
    { name: 'missing word', act: 'place', parts: placement.map(p => p[1] === 'next to' ? part('word', 'beside') : p) },
    { name: 'primary', act: 'place', parts: placement },
    { name: 'other reading', act: 'change', parts: placement },
    { name: 'cannot stop after predicate', act: 'place', parts: [part('verb', 'place')] },
  ];
  const events = [
    [7, 8, 'word', 'outside input'],
    [4, 6, 'word', 'next to'],
    [2, 3, 'det', 'definite'],
    [1, 2, 'verb', 'place'],
    [0, 1, 'lead', 'please'],
    [4, 6, 'word', 'next to'],
  ];
  assert.deepEqual(proofs({ frames, events, length: 7 }), [
    { frame: 'primary', act: 'place', predicate: [1, 2], roles: [role('thing', 3, 4), role('place', 6, 7)] },
    { frame: 'other reading', act: 'change', predicate: [1, 2], roles: [role('thing', 3, 4), role('place', 6, 7)] },
  ]);

  const withoutOptionals = [[0, 1, 'verb', 'place'], [2, 4, 'word', 'next to']];
  assert.deepEqual(proofs({ frames: [frames[1]], events: withoutOptionals, length: 5 }), [
    { frame: 'primary', act: 'place', predicate: [0, 1], roles: [role('thing', 1, 2), role('place', 4, 5)] },
  ]);
  assert.deepEqual(proofs({ frames: [frames[1]], events: withoutOptionals, length: 4 }), []);
});

test('binds a later verb after a nonempty role and rejects a proof with no predicate', () => {
  const frames = [
    { name: 'later verb', act: 'change', parts: [part('role', 'thing'), part('verb', 'change', true), part('role', 'value')] },
    { name: 'no predicate', act: 'change', parts: [part('role', 'thing')] },
  ];
  const events = [[1, 2, 'verb', 'change'], [2, 3, 'verb', 'change']];
  assert.deepEqual(proofs({ frames, events, length: 4 }), [
    { frame: 'later verb', act: 'change', predicate: [2, 3], roles: [role('thing', 0, 2), role('value', 3, 4)] },
  ]);
});

test('selects one proof even with many overlapping role splits', () => {
  const frame = { name: 'many roles', act: 'make', parts: [
    part('verb', 'make'), ...Array.from({ length: 25 }, (_, index) => part('role', 'role-' + index, index > 0)),
  ] };
  assert.deepEqual(proofs({ frames: [frame], events: [[0, 1, 'verb', 'make']], length: 35 }), [
    { frame: 'many roles', act: 'make', predicate: [0, 1], roles: [role('role-0', 1, 35)] },
  ]);
});
