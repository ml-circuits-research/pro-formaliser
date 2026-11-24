#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { spellcheck } from '../src/spell.mjs';

const args = process.argv.slice(2);
let json = false;
while (args.length && args[0].startsWith('-')) {
  const flag = args.shift();
  if (flag === '--') break;
  if (flag === '--json') {
    json = true;
  } else if (flag === '--help' || flag === '-h') {
    console.log('Usage: node bin/spell.mjs [--json] [--] "text" (reads stdin when text is omitted)');
    process.exit(0);
  } else {
    console.error(`Unknown option ${flag}`);
    process.exit(2);
  }
}

try {
  const input = args.length ? args.join(' ') : readFileSync(0, 'utf8');
  const result = spellcheck(input);
  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    process.stdout.write(result.text);
    if (!result.text.endsWith('\n') && process.stdout.isTTY) process.stdout.write('\n');
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
