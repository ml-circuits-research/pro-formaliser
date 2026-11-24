import { execFileSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '../.cache/knowledge/tools/sopworld/sopworld.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const staged = join(root, 'sop-worlds');
const [ref = 'origin/main', official = join(root, '../sop-knowledge-worlds'), ...extra] = process.argv.slice(2);

if (ref === '--help' || extra.length) {
  console.log('Usage: node tools/staged-worlds.mjs [official-git-ref] [official-repository]');
  process.exit(extra.length ? 2 : 0);
}

function git(...args) {
  return execFileSync('git', ['-C', resolve(official), ...args], {
    encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
  });
}

function parseFile(path, source) {
  try {
    return parse(source);
  } catch (error) {
    throw new Error(`${path}: ${error.message}`, { cause: error });
  }
}

function signature({ type, pattern, legacy, attrs }) {
  const fields = Object.keys(attrs).sort().map(key => [key, attrs[key]]);
  // Preserve repeated values, including their order. A sequence of SOP
  // parts may have a different meaning when the same values are reordered.
  return JSON.stringify([type, Boolean(pattern), Boolean(legacy), fields]);
}

function add(index, key, value) {
  const matches = index.get(key) ?? [];
  matches.push(value);
  index.set(key, matches);
}

// Git returns a header, the requested blob bytes and a trailing newline.
async function visitBlobs(files, visit) {
  const child = spawn('git', ['-C', resolve(official), 'cat-file', '--batch'],
    { stdio: ['pipe', 'pipe', 'inherit'] });
  const closed = once(child, 'close');
  let inputError;
  child.stdin.on('error', error => { inputError = error; });
  child.stdin.end(files.map(({ hash }) => hash + '\n').join(''));

  let remaining = Buffer.alloc(0), index = 0, size;
  try {
    for await (const chunk of child.stdout) {
      remaining = remaining.length ? Buffer.concat([remaining, chunk]) : chunk;
      while (index < files.length) {
        if (size === undefined) {
          const newline = remaining.indexOf(10);
          if (newline < 0) break;
          const [hash, type, length] = remaining.toString('ascii', 0, newline).split(' ');
          if (hash !== files[index].hash || type !== 'blob' || !/^\d+$/u.test(length)) {
            throw Error(`Unexpected git blob response for ${files[index].path}`);
          }
          size = Number(length);
          remaining = remaining.subarray(newline + 1);
        }
        if (remaining.length <= size) break;
        if (remaining[size] !== 10) throw Error(`Missing git blob delimiter for ${files[index].path}`);
        visit(files[index++].path, remaining.toString('utf8', 0, size));
        remaining = remaining.subarray(size + 1);
        size = undefined;
      }
    }
    const [status] = await closed;
    if (inputError && inputError.code !== 'EPIPE') throw inputError;
    if (status !== 0 || index !== files.length || remaining.length) {
      throw Error(`Read ${index} of ${files.length} official SOP blobs (git exit ${status})`);
    }
  } catch (error) {
    child.kill();
    throw error;
  }
}

const drafts = readdirSync(staged, { recursive: true, withFileTypes: true })
  .filter(entry => entry.isFile() && entry.name.endsWith('.sop'))
  .map(entry => join(entry.parentPath, entry.name)).sort()
  .flatMap(file => parseFile(relative(root, file), readFileSync(file, 'utf8'))
    .map(wire => ({ id: wire.id, type: wire.type, path: relative(root, file), content: signature(wire) })));
if (!drafts.length) throw Error('No staged SOP declarations found');

const commit = git('rev-parse', '--verify', '--end-of-options', ref + '^{commit}').trim();
const files = git('ls-tree', '-r', '-z', commit, '--', 'docs/worlds').split('\0').filter(Boolean)
  .map(entry => {
    const separator = entry.indexOf('\t');
    const [, type, hash] = entry.slice(0, separator).split(' ');
    return { type, hash, path: entry.slice(separator + 1) };
  }).filter(({ type, path }) => type === 'blob' && path.endsWith('.sop'));
if (!files.length) throw Error(`No official docs/worlds SOP files at ${ref}`);

const ids = new Set(drafts.map(({ id }) => id));
const contents = new Set(drafts.map(({ content }) => content));
const kinds = new Set(drafts.map(({ type }) => type));
const byId = new Map(), byContent = new Map();
await visitBlobs(files, (path, source) => {
  for (const wire of parseFile(path, source)) {
    if (!ids.has(wire.id) && !kinds.has(wire.type)) continue;
    const content = signature(wire);
    const match = { id: wire.id, path, content };
    if (ids.has(wire.id)) add(byId, wire.id, match);
    if (contents.has(content)) add(byContent, content, match);
  }
});

console.log(`Official ${ref} at ${commit} (${files.length} SOP files)`);
console.log('status\tstaged file\tid\tofficial matches');
const counts = new Map();
for (const { id, path, content } of drafts) {
  const officialId = byId.get(id) ?? [];
  const equivalent = (byContent.get(content) ?? []).filter(match => match.id !== id);
  const status = officialId.length ? officialId.every(match => match.content === content) ?
    'same-id' : 'id-conflict' : equivalent.length ? 'equivalent' : 'staged-only';
  counts.set(status, (counts.get(status) ?? 0) + 1);
  const locations = [...officialId, ...equivalent].map(match => match.path + ':@' + match.id);
  console.log([status, path, id, locations.join(', ')].join('\t'));
}
console.log([`Total ${drafts.length}`, ...[...counts].sort().map(([status, count]) => `${status} ${count}`)].join('\t'));
