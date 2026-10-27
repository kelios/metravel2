/** @jest-environment node */
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { makeTempDir, runNodeCli } = require('./cli-test-utils');
import { questPrivateSnapshot } from '../fixtures/questPublicProjection';

it('packages a standalone pinned builder with its catalogue and bounded stdin/stdout receipt', async () => {
  const directory = makeTempDir('quest-web-builder-', { root: path.resolve(__dirname, '../../.codex-temp/jest') });
  try {
    const packaged = runNodeCli([path.resolve(__dirname, '../../scripts/package-quest-web-builder.js'), '--output-dir', directory], {}, { timeoutMs: 20000 });
    expect(packaged.status).toBe(0);
    const receipt = JSON.parse(fs.readFileSync(path.join(directory, '.quest-web-builder.json'), 'utf8'));
    const file = path.join(directory, 'quest-web-builder.cjs');
    expect(receipt).toEqual({ schema_version: 2,
      sha256: createHash('sha256').update(fs.readFileSync(file)).digest('hex'),
      max_input_bytes: 67108864, max_output_bytes: 33554432 });
    expect(JSON.parse(fs.readFileSync(path.join(directory, '.quest-web-builder.json'), 'utf8'))).toEqual(receipt);
    const result = runNodeCli([file], {}, { cwd: directory, input: JSON.stringify(questPrivateSnapshot()), timeoutMs: 20000 });
    expect(result.status).toBe(0);
    const projection = JSON.parse(result.stdout);
    expect(projection.pages.filter((entry: { kind: string }) => entry.kind === 'detail')).toHaveLength(5);
    expect(result.stdout).not.toMatch(/"(?:task|hint|answer_pattern|progress)"/);
    const invalid = runNodeCli([file, '--typo'], {}, { cwd: directory, timeoutMs: 20000 });
    expect(invalid.status).toBe(2);
    expect(invalid.stdout).toBe('');
    const malformed = runNodeCli([file], {}, { cwd: directory, input: '{"PRIVATE":"unterminated', timeoutMs: 20000 });
    expect(malformed.status).toBe(1);
    expect(malformed.stdout).toBe('');
    expect(malformed.stderr).not.toContain('PRIVATE');
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
}, 30000);
