import fs from 'fs';
import os from 'os';
import path from 'path';
import { makeTempDir, removeDir } from './cli-test-utils';

const { spawnSyncWithStdin, execFileSyncWithStdin } = require('../../scripts/lib/runSyncWithStdin');
const readStdin = ['-e', 'process.stdout.write(require("fs").readFileSync(0))'];

describe('file-backed synchronous stdin (#2844)', () => {
  let root: string;
  beforeEach(() => {
    root = makeTempDir('metravel-sync-stdin-test-');
    jest.spyOn(os, 'tmpdir').mockReturnValue(root);
  });
  afterEach(() => {
    jest.restoreAllMocks();
    removeDir(root);
  });

  const expectClean = () => expect(fs.readdirSync(root)).toEqual([]);

  it('delivers 200 KB byte for byte through both adapters, including binary bytes', () => {
    const input = Buffer.alloc(200_000);
    for (let i = 0; i < input.length; i++) input[i] = i % 256;
    const result = spawnSyncWithStdin(process.execPath, readStdin, { input, timeout: 5000 });
    expect(result.status).toBe(0);
    expect(result.stdout.equals(input)).toBe(true);
    expect(execFileSyncWithStdin(process.execPath, readStdin, { input, timeout: 5000 }).equals(input)).toBe(true);
    expectClean();
  });

  it('preserves string encoding, empty stdin and EOF without the input option', () => {
    expect(execFileSyncWithStdin(process.execPath, readStdin, { input: 'жé', encoding: 'utf8' })).toBe('жé');
    expect(execFileSyncWithStdin(process.execPath, readStdin, { input: 'é', encoding: 'latin1' })).toBe('é');
    expect(execFileSyncWithStdin(process.execPath, readStdin, { input: '', encoding: 'utf8' })).toBe('');
    expect(spawnSyncWithStdin(process.execPath, readStdin, { encoding: 'utf8' }).stdout).toBe('');
    expectClean();
  });

  it('keeps stdout/stderr, cwd, env, stdio and extra file descriptors', () => {
    const output = path.join(root, 'output');
    const fd = fs.openSync(output, 'w');
    try {
      const source = 'process.stdout.write(process.cwd()+":"+process.env.STDIN_FIXTURE); process.stderr.write("summary"); require("fs").writeSync(3,"extra");';
      const result = spawnSyncWithStdin(process.execPath, ['-e', source], {
        input: 'data', cwd: root, env: { ...process.env, STDIN_FIXTURE: 'ok' },
        encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe', fd],
      });
      expect(result.status).toBe(0);
      expect(result.stdout).toBe(`${fs.realpathSync(root)}:ok`);
      expect(result.stderr).toBe('summary');
      expect(fs.readFileSync(output, 'utf8')).toBe('extra');
      expect(spawnSyncWithStdin(process.execPath, readStdin, { input: 'x', stdio: 'ignore' }).stdout).toBeNull();
    } finally { fs.closeSync(fd); fs.unlinkSync(output); }
    expectClean();
  });

  it('keeps spawn failure results and exec exceptions, cleaning all temporary files', () => {
    const args = ['-e', 'process.stderr.write("failed"); process.exit(7)'];
    expect(spawnSyncWithStdin(process.execPath, args, { input: 'x', encoding: 'utf8' })).toMatchObject({ status: 7, stderr: 'failed' });
    expect(() => execFileSyncWithStdin(process.execPath, args, { input: 'x', stdio: ['pipe', 'pipe', 'ignore'] })).toThrow();
    const missing = '/nonexistent/metravel-2844';
    expect(spawnSyncWithStdin(missing, [], { input: 'x' }).error.code).toBe('ENOENT');
    expect(() => execFileSyncWithStdin(missing, [], { input: 'x' })).toThrow(/ENOENT/);
    expectClean();
  });

  it('forwards default exec stderr on success and preserves captured errors', () => {
    const write = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
    expect(execFileSyncWithStdin(process.execPath, ['-e', 'process.stderr.write("progress"); process.stdout.write("done")'], {
      input: 'x', encoding: 'utf8',
    })).toBe('done');
    expect(write).toHaveBeenLastCalledWith('progress');
    let failure: { message: string; status: number; stderr: string; stdout: string } | undefined;
    try {
      execFileSyncWithStdin(process.execPath, ['-e', 'process.stderr.write("failed"); process.stdout.write("partial"); process.exit(7)'], {
        input: 'x', encoding: 'utf8',
      });
    } catch (error) { failure = error as typeof failure; }
    expect(failure).toMatchObject({ status: 7, stderr: 'failed', stdout: 'partial' });
    expect(failure?.message).toMatch(/Command failed: .*\nfailed$/);
    expect(write).toHaveBeenLastCalledWith('failed');
    expectClean();
  });

  it('cleans up after timeout and a failure while preparing input', () => {
    const args = ['-e', 'process.on("SIGTERM",()=>{}); setInterval(()=>{},1000)'];
    const options = { input: 'x', timeout: 200, killSignal: 'SIGKILL' };
    expect(spawnSyncWithStdin(process.execPath, args, options).error.code).toBe('ETIMEDOUT');
    expect(() => execFileSyncWithStdin(process.execPath, args, options)).toThrow(/ETIMEDOUT/);
    expect(() => spawnSyncWithStdin(process.execPath, [], { input: {} })).toThrow();
    expectClean();
  });
});
