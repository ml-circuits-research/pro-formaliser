import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { loadCorpus } from '../src/corpus.mjs';

function fixture(t, files) {
  const dataset = mkdtempSync(join(tmpdir(), 'pro-formaliser-corpus-'));
  t.after(() => rmSync(dataset, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', ['-C', dataset, ...args], { encoding: 'utf8' });
  git('init', '-q');
  for (const [source, csv] of Object.entries(files)) writeFileSync(join(dataset, source), csv);
  git('add', '--', ...Object.keys(files));
  git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid',
    '-c', 'commit.gpgsign=false', 'commit', '-qm', 'Example corpus');
  return { dataset, revision: git('rev-parse', 'HEAD').trim() };
}

test('loads legacy and numbered SOP cells on one row per text with source provenance', t => {
  const text = 'Draw a square, called "A"';
  const primary = '@r w.request.request act=create mood=do predicate=draw\n' +
    '@t w.request.target request=$r family=drawn sort=square name="A"';
  const alternative = primary.replace('family=drawn', 'family=node');
  const other = '@r w.request.request act=create mood=do predicate=create';
  const quote = value => '"' + value.replaceAll('"', '""') + '"';
  const options = fixture(t, {
    'legacy.csv': 'text,sop\r\nDraw a square,' + quote(primary) + '\r\n',
    'variants.csv': 'text,sop,sop1,sop2,sop3\r\n' +
      [quote(text), quote(primary), quote(alternative), '', quote(other)].join(',') + '\r\n' +
      ['Draw a box', '', '  ', quote(other), ''].join(','),
  });
  const { revision, rows } = loadCorpus(options);
  assert.equal(revision, options.revision);
  assert.deepEqual(rows, [
    { text: 'Draw a square', sop: primary, references: [{ column: 'sop', sop: primary }], source: 'legacy.csv', row: 2 },
    {
      text, sop: primary, source: 'variants.csv', row: 2,
      references: [
        { column: 'sop', sop: primary },
        { column: 'sop1', sop: alternative },
        { column: 'sop3', sop: other },
      ],
    },
    { text: 'Draw a box', sop: '', references: [{ column: 'sop2', sop: other }], source: 'variants.csv', row: 3 },
  ]);
});

test('reports malformed headers with the source record', async t => {
  for (const header of ['"text,sop"', 'text,sop,sop2', 'text,sop,sop1,sop1', 'text,sop,context']) {
    await t.test(header, t => {
      const options = fixture(t, { 'invalid.csv': header + '\n' });
      assert.throws(() => loadCorpus(options), /consecutive numbered SOP columns in invalid\.csv:1/u);
    });
  }
});

test('reports narrow and wide CSV records after a multiline circuit', async t => {
  for (const [row, width] of [['Draw a box,', 2], ['Draw a box,,,,', 5]]) {
    await t.test(String(width), t => {
      const options = fixture(t, {
        'invalid.csv': 'text,sop,sop1\nDraw a square,"line 1\nline 2",\n' + row,
      });
      assert.throws(() => loadCorpus(options), {
        message: 'Expected 3 CSV fields in invalid.csv:3, received ' + width,
      });
    });
  }
});
