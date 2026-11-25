import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const DATASET = fileURLToPath(new URL('../../webmeet-dataset/', import.meta.url));
export const DATASET_REVISION = 'a85de79de826f983855aa2dafc6de7548978fbff';

export const referencesOf = row => row.references ??
  (typeof row.sop==='string' && row.sop.trim() ? [{column:'sop',sop:row.sop}] : []);

// Learners can observe each distinct circuit after the text has been assigned
// to a partition. Corpus rows and inference requests remain one per input.
export function* circuitObservations(rows) {
  for (const row of rows) {
    if (row.references===undefined) {
      yield row;
      continue;
    }
    for (const sop of new Set(row.references.map(ref=>ref.sop))) yield {...row,sop};
  }
}

function* csvRows(text, source) {
  let row = [], start = 0, quoted = false;
  let record = 1;
  const slice = end => {
    const field = text.slice(start, end);
    return field.startsWith('"') ? field.slice(1, -1).replaceAll('""', '"') : field;
  };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') i++;
      else if (char === '"') {
        quoted = false;
        const next = text[i + 1];
        if (next !== undefined && next !== ',' && next !== '\n' &&
            !(next === '\r' && text[i + 2] === '\n')) {
          throw new Error('Unexpected character after quoted CSV field in ' + source + ':' + record);
        }
      }
    } else if (char === '"' && i === start) {
      quoted = true;
    } else if (char === ',' || char === '\n') {
      row.push(slice(char === '\n' && text[i - 1] === '\r' ? i - 1 : i));
      start = i + 1;
      if (char === '\n') {
        yield row;
        row = [];
        record++;
      }
    }
  }
  if (quoted) throw new Error('Unterminated quoted CSV field in ' + source + ':' + record);
  if (start < text.length || row.length) yield [...row, slice(text.length)];
}

export function loadCorpus({ dataset = DATASET, revision = DATASET_REVISION } = {}) {
  const git = (...args) => execFileSync('git', ['-C', dataset, ...args], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const commit = git('rev-parse', '--verify', '--end-of-options', revision + '^{commit}').trim();
  const files = git('ls-tree', '-r', '-z', '--name-only', commit).split('\0').filter(path => path.endsWith('.csv'));
  if (files.length === 0) throw new Error('No WebMeet CSVs found at ' + commit);
  const rows = [];
  for (const source of files) {
    const cells = csvRows(git('show', commit + ':' + source), source);
    const header = cells.next().value ?? [];
    if (header[0] !== 'text' || header[1] !== 'sop' ||
        header.slice(2).some((column, index) => column !== 'sop' + (index + 1))) {
      throw new Error('Expected text,sop followed by consecutive numbered SOP columns in ' + source +
        ':1, received ' + JSON.stringify(header));
    }
    let row = 1;
    for (const fields of cells) {
      row++;
      const [text, sop] = fields;
      const location = source + ':' + row;
      if (fields.length !== header.length) {
        throw new Error('Expected ' + header.length + ' CSV fields in ' + location + ', received ' + fields.length);
      }
      if (!text.trim()) throw new Error('Empty text in CSV record ' + location);
      const references = [];
      for (let index = 1; index < fields.length; index++) {
        if (fields[index].trim()) references.push({ column: header[index], sop: fields[index] });
      }
      rows.push({ text, sop, references, source, row });
    }
  }
  return { revision: commit, rows };
}

export function normalizeText(text) {
  return text.normalize('NFKC').toLowerCase().trim().replace(/\s+/gu, ' ');
}

export function splitCorpus(rows, bucket = 0) {
  if (!Number.isInteger(bucket) || bucket < 0 || bucket >= 100) throw Error("Invalid holdout bucket");
  const groups = new Map();
  const training = [], heldOut = [];
  for (const row of rows) {
    const key = normalizeText(row.text);
    if (!groups.has(key)) {
      const hash = createHash('sha256').update(key).digest();
      groups.set(key, hash.readUInt32BE(0) % 100 === bucket ? heldOut : training);
    }
    groups.get(key).push(row);
  }
  return { training, heldOut };
}
