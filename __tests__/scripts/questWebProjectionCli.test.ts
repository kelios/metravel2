const path = require('node:path');
const { Readable, Writable } = require('node:stream');
const { buildQuestWebProjection } = require('@/scripts/lib/questWebProjection');
const { runProjectionCli } = require('@/scripts/lib/questWebProjectionCli');
const { loadSsgCatalogs } = require('@/i18n/babel-inline-plugin');
import { makeTempDir, removeDir, runCli, writeTextFile } from './cli-test-utils';
import { questPrivateSnapshot } from '../fixtures/questPublicProjection';

const catalogs = loadSsgCatalogs(path.resolve(__dirname, '../..')).catalogs;

// The backend writes Python canonical JSON: sorted keys at every level.
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical((value as Record<string, unknown>)[key])]));
  }
  return value;
}

async function project(input: string) {
  let stdout = '', stderr = '';
  const sink = (write: (text: string) => void) => new Writable({ write(chunk: Buffer, _encoding: string, done: () => void) { write(chunk.toString()); done(); } });
  const ok = await runProjectionCli(catalogs, { input: Readable.from([Buffer.from(input)]),
    output: sink((text) => { stdout += text; }), error: sink((text) => { stderr += text; }) });
  return { ok, stdout, stderr };
}

describe('quest web builder CLI', () => {
  afterEach(() => { process.exitCode = 0; });

  it('streams output byte-identical to the whole-corpus projection while loading one locale at a time', async () => {
    const source = questPrivateSnapshot();
    const expected = JSON.stringify(buildQuestWebProjection(source, catalogs)) + '\n';
    for (const input of [JSON.stringify(canonical(source)), JSON.stringify(source, null, 2)]) {
      const result = await project(input);
      expect(result).toEqual({ ok: true, stdout: expected, stderr: '' });
    }
  });

  it('reads a regular-file stdin by position with the same bytes', () => {
    const source = questPrivateSnapshot();
    const expected = JSON.stringify(buildQuestWebProjection(source, catalogs)) + '\n';
    const directory = makeTempDir('quest-web-cli-');
    try {
      const input = path.join(directory, 'input.json');
      writeTextFile(input, JSON.stringify(canonical(source)));
      const result = runCli('/bin/sh', ['-c', `exec "$0" scripts/build-quest-web-projection.js < "$1"`, process.execPath, input]);
      expect(result.status).toBe(0);
      expect(result.stdout).toBe(expected);
    } finally {
      removeDir(directory);
    }
  });

  it.each([
    ['truncated', (text: string) => text.slice(0, -1)],
    ['trailing data', (text: string) => `${text}{}`],
    ['malformed locale bundle', (text: string) => text.replace('"be":{', '"be":{,')],
    ['missing RU bundles', (text: string) => text.replace('"ru":{', '"xx":{')],
    ['malformed value of a repeated key', (text: string) => `{"zz":tru,"zz":1,${text.slice(1)}`],
  ])('fails closed without echoing a %s snapshot', async (_label, corrupt) => {
    const result = await project(corrupt(JSON.stringify(canonical(questPrivateSnapshot()))));
    expect(result.ok).toBe(false);
    expect(result.stderr).toBe('Quest public projection rejected the private snapshot\n');
    expect(process.exitCode).toBe(1);
  });
});
