import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, symlink, rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import QaReadGuard from './read-guard.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('native Read accepts own artifacts and rejects traversal and output symlink escapes', async () => {
  const base = path.join(root, '.codex-temp/local-web-qa');
  await mkdir(base, {recursive: true});
  const output = await mkdtemp(path.join(base, 'unit-read-'));
  const elsewhere = await mkdtemp(path.join(os.tmpdir(), 'qa-private-'));
  try {
    const image = path.join(output, 'screen.png');
    const secret = path.join(elsewhere, 'private.txt');
    await writeFile(image, 'own image');
    await writeFile(secret, 'fixture, not real credentials');
    await symlink(secret, path.join(output, 'image-link.png'));
    const plugin = await QaReadGuard({directory: root}, {outputDirectory: output});
    const before = filePath => plugin['tool.execute.before']({tool: 'read'}, {args: {filePath}});
    await before(image);
    await before(path.relative(root, image));
    await assert.rejects(before(secret), /cannot leave/);
    await assert.rejects(before(path.join(output, 'image-link.png')), /cannot leave/);
    await assert.rejects(before(path.join(output, '..', '..', '..', 'AGENTS.md')), /cannot leave/);
    for (const url of ['javascript:alert(1)', 'data:text/html,hidden', 'file:///etc/passwd', 'https://external.example/']) {
      await assert.rejects(plugin['tool.execute.before']({tool: 'browser_browser_navigate'}, {args: {url}}), /owned HTTPS/);
    }
    await plugin['tool.execute.before']({tool: 'browser_browser_navigate'}, {args: {url: 'https://metravel.by/app'}});
    await assert.rejects(before(path.join(output, 'missing')), /unavailable/);
    await assert.rejects(QaReadGuard({directory: root}, {outputDirectory: elsewhere}), /Invalid QA/);
    await plugin['tool.execute.before']({tool: 'browser_browser_snapshot'}, {args: {}});
  } finally {
    await rm(output, {recursive: true, force: true});
    await rm(elsewhere, {recursive: true, force: true});
  }
});
