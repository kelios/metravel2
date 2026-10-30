import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Downloads the exact print masters recorded by B1. Some are Wikimedia's
// standard 1920px renditions; sourceOriginalUrl identifies the camera original.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const registry = JSON.parse(await readFile(path.join(root, 'data/travelBooks/rights.json'), 'utf8'));
const cache = path.join(root, '.codex-temp/books-media/masters');
await mkdir(cache, {recursive: true});
for (const asset of registry.assets) {
  const source = asset.original;
  const dest = path.join(cache, `${asset.id}${path.extname(asset.localPath)}`);
  let bytes;
  try { bytes = await readFile(dest); } catch { /* Not cached yet. */ }
  if (!bytes || createHash('sha256').update(bytes).digest('hex') !== source.sha256) {
    // Existing checked-in cover art is already the exact master; reuse it.
    const local = await readFile(path.join(root, asset.localPath));
    if (createHash('sha256').update(local).digest('hex') === source.sha256) bytes = local;
    else {
      const url = new URL(source.url);
      if (url.protocol !== 'https:' || url.hostname !== 'upload.wikimedia.org') throw new Error(`${asset.id}: untrusted source host`);
      const response = await fetch(url, {headers: {'User-Agent': 'MeTravelBook/1.0'}, signal: AbortSignal.timeout(60000)});
      if (!response.ok) throw new Error(`${asset.id}: HTTP ${response.status}; retry later, do not substitute another revision`);
      bytes = Buffer.from(await response.arrayBuffer());
    }
    if (createHash('sha256').update(bytes).digest('hex') !== source.sha256 || bytes.length !== source.bytes) throw new Error(`${asset.id}: master hash/bytes mismatch; source changed`);
    await writeFile(dest, bytes);
  }
  process.stdout.write(`${asset.id}: verified master\n`);
}
