#!/usr/bin/env node
import path from 'node:path';
import {renderReadyBooks} from './books/render-ready-book.mjs';

let output;
let python = process.env.READY_BOOKS_PYTHON || '.codex-temp/books-production/venv/bin/python';
let check = false;
let registryPath = '.codex-temp/books-next/media-registry.json';
let sourcesRoot = 'data/travelBooks';
let style = 'watercolor';
const args = process.argv.slice(2);
for (let index = 0; index < args.length; index++) {
  const arg = args[index];
  if (arg === '--check') check = true;
  else if (['--output', '--python', '--registry', '--sources-root', '--style'].includes(arg)) {
    const value = args[++index];
    if (!value || value.startsWith('--')) throw new Error(`${arg} requires a value`);
    if (arg === '--output') output = value;
    else if (arg === '--python') python = value;
    else if (arg === '--registry') registryPath = value;
    else if (arg === '--style') style = value;
    else sourcesRoot = value;
  } else throw new Error(`Unknown option: ${arg}`);
}
if (!['watercolor', 'photo'].includes(style)) throw new Error('Supported styles: watercolor, photo');
output ??= style === 'photo' ? '.codex-temp/books-photo/production' : '.codex-temp/books-next/production';
// Production packages are staged locally; publishing immutable editions belongs to C1.
if (!path.resolve(output).startsWith(path.resolve('.codex-temp') + path.sep)) throw new Error('Output must be in ignored .codex-temp/');
try {console.log(JSON.stringify(await renderReadyBooks({output, python, check, registryPath, sourcesRoot, style})));}
catch (error) {console.error(error.message); process.exitCode = 1;}
