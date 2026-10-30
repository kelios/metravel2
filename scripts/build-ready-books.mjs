#!/usr/bin/env node
import path from 'node:path';
import {renderReadyBooks} from './books/render-ready-book.mjs';

let output = '.codex-temp/books-production/output';
let python = process.env.READY_BOOKS_PYTHON || '.codex-temp/books-production/venv/bin/python';
let check = false;
const args = process.argv.slice(2);
for (let index = 0; index < args.length; index++) {
  const arg = args[index];
  if (arg === '--check') check = true;
  else if (arg === '--output' || arg === '--python') {
    const value = args[++index];
    if (!value || value.startsWith('--')) throw new Error(`${arg} requires a value`);
    if (arg === '--output') output = value;
    else python = value;
  } else throw new Error(`Unknown option: ${arg}`);
}
// Production packages are staged locally; publishing immutable editions belongs to C1.
if (!path.resolve(output).startsWith(path.resolve('.codex-temp') + path.sep)) throw new Error('Output must be in ignored .codex-temp/');
try {console.log(JSON.stringify(await renderReadyBooks({output, python, check})));}
catch (error) {console.error(error.message); process.exitCode = 1;}
