import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const DATASET = fileURLToPath(new URL('../../webmeet-dataset/', import.meta.url));
export const DATASET_REVISION = 'a85de79de826f983855aa2dafc6de7548978fbff';
const TABS = /^(avatar|calendar|diagram|document|drawing)\/[^/]+\.csv$/;

function* csvRows(text) {
  let row = [], start = 0, quoted = false;
  const slice = end => {
    const field = text.slice(start, end);
    return field.startsWith('"') ? field.slice(1, -1).replaceAll('""', '"') : field;
  };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') i++;
      else if (char === '"') quoted = false;
    } else if (char === '"' && i === start) {
      quoted = true;
    } else if (char === ',' || char === '\n') {
      row.push(slice(text[i - 1] === '\r' ? i - 1 : i));
      start = i + 1;
      if (char === '\n') {
        yield row;
        row = [];
      }
    }
  }
  if (quoted) throw new Error('Unterminated quoted CSV field');
  if (start < text.length || row.length) yield [...row, slice(text.length)];
}

export function loadCorpus({ dataset = DATASET, revision = DATASET_REVISION } = {}) {
  const git = (...args) => execFileSync('git', ['-C', dataset, ...args], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const commit = git('rev-parse', '--verify', '--end-of-options', revision + '^{commit}').trim();
  const files = git('ls-tree', '-r', '-z', '--name-only', commit).split('\0').filter(path => TABS.test(path));
  if (files.length === 0) throw new Error('No WebMeet CSVs found at ' + commit);
  const rows = [];
  for (const source of files) {
    const family = source.split('/')[0];
    const cells = csvRows(git('show', commit + ':' + source));
    if (cells.next().value?.join(',') !== 'text,sop') throw new Error('Expected text,sop header in ' + source);
    let row = 1;
    for (const fields of cells) {
      row++;
      const [text, sop] = fields;
      if (fields.length !== 2 || !text.trim()) throw new Error('Invalid CSV record ' + source + ':' + row);
      rows.push({ text, sop, family, tab: family, source, row });
    }
  }
  return { revision: commit, rows };
}

export function normalizeText(text) {
  return text.normalize('NFKC').toLowerCase().trim().replace(/\s+/gu, ' ');
}

export function splitCorpus(rows) {
  const groups = new Map();
  const training = [], heldOut = [];
  for (const row of rows) {
    const key = normalizeText(row.text);
    if (!groups.has(key)) {
      const hash = createHash('sha256').update(key).digest();
      groups.set(key, hash.readUInt32BE(0) % 100 === 0 ? heldOut : training);
    }
    groups.get(key).push(row);
  }
  return { training, heldOut };
}
