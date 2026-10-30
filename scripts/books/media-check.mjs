import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {validateBookMedia} from './media-validation.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = async file => JSON.parse(await readFile(path.join(root, file), 'utf8'));
const registry = await read('data/travelBooks/rights.json');
const books = await Promise.all(['by', 'pl'].map(country => read(`data/travelBooks/${country}/editorial.json`)));
const issues = await validateBookMedia(registry, books, {root});
if (issues.length) {
  process.stderr.write(issues.join('\n') + '\n');
  process.exitCode = 1;
} else {
  process.stdout.write(`MEDIA VERIFIED: ${registry.assets.length} images; 24 stops + 2 covers; rights, SHA-256, dimensions and 300 ppi contain.\n`);
}
