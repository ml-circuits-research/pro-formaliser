// Usage: node eval/sample-disagreements.mjs .cache/details.jsonl .cache/blind
// Give the reviewer the blind JSON only. Decode its verdicts with the key later.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { normalizeText } from '../src/corpus.mjs';

const [input,prefix] = process.argv.slice(2);
if (!input || !prefix) throw Error('Expected a benchmark details JSONL and output prefix');
const digest = (salt, text) => createHash('sha256').update(salt + '\0' + text).digest('hex');
const families = new Map();
for (const line of readFileSync(input,'utf8').trimEnd().split('\n')) {
  const row = JSON.parse(line);
  if (row.semanticWireMatch) continue;
  const text = normalizeText(row.text);
  if (!families.has(row.family)) families.set(row.family,new Map());
  const group = families.get(row.family);
  if (!group.has(text)) group.set(text,row);
}
const blind = [], key = [];
for (const [family,group] of [...families].sort()) {
  const ranked = [...group].sort(([a],[b]) => digest('audit-1',a).localeCompare(digest('audit-1',b)));
  for (const [,row] of ranked.slice(0,6)) {
    const id = blind.length+1;
    const aIsModel = (parseInt(digest('side-1',row.text).slice(0,2),16) % 2) === 0;
    const pair = [row.prediction.sop,row.sop];
    if (!aIsModel) pair.reverse();
    blind.push({id,text:row.text,A:pair[0],B:pair[1]});
    key.push({id,family,model:aIsModel?'A':'B',source:row.source,row:row.row});
  }
}
writeFileSync(prefix+'.json', JSON.stringify(blind,null,2));
writeFileSync(prefix+'-key.json', JSON.stringify(key,null,2));
