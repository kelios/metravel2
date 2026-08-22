const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const { makeTempDir, removeDir } = require('./cli-test-utils');

const {
  assertE2EArtifactConfig,
  buildEnvFileContent,
  createSignalInterruption,
  killProcessTree,
  signalExitCode,
  waitForProcessExit,
  withTemporaryEnvOverrides,
} = require('../../scripts/e2e-webserver');

describe('e2e webserver build lifecycle', () => {
  it('waits for the export process to exit before serving the build', async () => {
    const child = new EventEmitter() as EventEmitter & {
      exitCode: number | null;
      signalCode: NodeJS.Signals | null;
    };
    child.exitCode = null;
    child.signalCode = null;

    const exitPromise = waitForProcessExit(child, 1000);
    child.exitCode = 0;
    child.emit('exit', 0, null);

    await expect(exitPromise).resolves.toBe(true);
  });

  it('returns false when the export process exceeds the grace period', async () => {
    const child = new EventEmitter() as EventEmitter & {
      exitCode: number | null;
      signalCode: NodeJS.Signals | null;
    };
    child.exitCode = null;
    child.signalCode = null;

    await expect(waitForProcessExit(child, 1)).resolves.toBe(false);
  });

  it('accepts a process that already exited', async () => {
    await expect(
      waitForProcessExit({ exitCode: 0, signalCode: null }, 1000),
    ).resolves.toBe(true);
  });

  it('escalates to SIGKILL when a process stays alive after SIGTERM', () => {
    jest.useFakeTimers();
    const child = {
      exitCode: null,
      signalCode: null,
      killed: false,
      kill: jest.fn(function (this: { killed: boolean }) {
        this.killed = true;
      }),
    };

    try {
      killProcessTree(child);
      expect(child.kill).toHaveBeenCalledWith('SIGTERM');
      jest.advanceTimersByTime(5000);
      expect(child.kill).toHaveBeenCalledWith('SIGKILL');
    } finally {
      jest.useRealTimers();
    }
  });

  it('turns SIGTERM into a catchable interruption so env restoration can finish', async () => {
    const targetProcess = new EventEmitter();
    const interruption = createSignalInterruption(targetProcess);
    const tempDir = makeTempDir('metravel-e2e-env-');
    const envPath = path.join(tempDir, '.env');
    const original = Buffer.from('ORIGINAL=value\r\nEXPO_PUBLIC_E2E=false\r\n', 'utf8');
    fs.writeFileSync(envPath, original);

    try {
      const action = withTemporaryEnvOverrides(
        envPath,
        { EXPO_PUBLIC_E2E: 'true' },
        async () => interruption.promise
      );
      targetProcess.emit('SIGTERM');

      await expect(action).rejects.toThrow('Interrupted by SIGTERM');
      expect(fs.readFileSync(envPath)).toEqual(original);
      expect(interruption.signal).toBe('SIGTERM');
      expect(signalExitCode(interruption.signal)).toBe(143);
    } finally {
      interruption.dispose();
      removeDir(tempDir);
    }
  });

  it('replaces stale E2E values instead of preserving them', () => {
    const result = buildEnvFileContent(
      '# EXPO_PUBLIC_E2E=false\nEXPO_PUBLIC_E2E=false\nEXPO_PUBLIC_API_URL=https://metravel.by\n',
      {
        EXPO_PUBLIC_E2E: 'true',
        EXPO_PUBLIC_IS_LOCAL_API: 'false',
        EXPO_PUBLIC_API_URL: 'http://127.0.0.1:8085',
      }
    );

    expect(result).toContain('# EXPO_PUBLIC_E2E=false');
    expect(result).not.toContain('\nEXPO_PUBLIC_E2E=false\n');
    expect(result.match(/^EXPO_PUBLIC_E2E=/gm)).toHaveLength(1);
    expect(result).toContain('EXPO_PUBLIC_E2E=true');
    expect(result).toContain('EXPO_PUBLIC_API_URL=http://127.0.0.1:8085');
  });

  it('restores the exact env file after a forced build failure', async () => {
    const tempDir = makeTempDir('metravel-e2e-env-');
    const envPath = path.join(tempDir, '.env');
    const original = Buffer.from('ORIGINAL=value\r\nEXPO_PUBLIC_E2E=false\r\n', 'utf8');
    fs.writeFileSync(envPath, original);

    try {
      await expect(
        withTemporaryEnvOverrides(envPath, { EXPO_PUBLIC_E2E: 'true' }, async () => {
          expect(fs.readFileSync(envPath, 'utf8')).toContain('EXPO_PUBLIC_E2E=true');
          throw new Error('forced build failure');
        })
      ).rejects.toThrow('forced build failure');
      expect(fs.readFileSync(envPath)).toEqual(original);
    } finally {
      removeDir(tempDir);
    }
  });

  it('restores the exact env file after a successful build action', async () => {
    const tempDir = makeTempDir('metravel-e2e-env-');
    const envPath = path.join(tempDir, '.env');
    const original = Buffer.from('ORIGINAL=value\nEXPO_PUBLIC_E2E=false\n', 'utf8');
    fs.writeFileSync(envPath, original);

    try {
      await withTemporaryEnvOverrides(envPath, { EXPO_PUBLIC_E2E: 'true' }, async () => {
        expect(fs.readFileSync(envPath, 'utf8')).toContain('EXPO_PUBLIC_E2E=true');
      });
      expect(fs.readFileSync(envPath)).toEqual(original);
    } finally {
      removeDir(tempDir);
    }
  });

  it('removes a temporary env file that did not exist before the build', async () => {
    const tempDir = makeTempDir('metravel-e2e-env-');
    const envPath = path.join(tempDir, '.env');

    try {
      await withTemporaryEnvOverrides(envPath, { EXPO_PUBLIC_E2E: 'true' }, async () => {
        expect(fs.existsSync(envPath)).toBe(true);
      });
      expect(fs.existsSync(envPath)).toBe(false);
    } finally {
      removeDir(tempDir);
    }
  });

  it('fails closed when artifact metadata or bundled API config is stale', () => {
    const tempDir = makeTempDir('metravel-e2e-artifact-');
    const jsDirectory = path.join(tempDir, 'js');
    const metaPath = path.join(tempDir, 'meta.json');
    fs.mkdirSync(jsDirectory);
    fs.writeFileSync(
      path.join(jsDirectory, 'entry.js'),
      'const e="true"===String("false").toLowerCase(); resolve({isE2E:e}); const api="https://metravel.by/user/google-login/";'
    );
    fs.writeFileSync(
      metaPath,
      JSON.stringify({
        expoPublic: {
          EXPO_PUBLIC_E2E: 'true',
          EXPO_PUBLIC_IS_LOCAL_API: 'false',
          EXPO_PUBLIC_API_URL: 'http://127.0.0.1:8085',
        },
      })
    );

    try {
      expect(() =>
        assertE2EArtifactConfig({
          expectedApiBase: 'http://127.0.0.1:8085',
          jsDirectory,
          metaPath,
        })
      ).toThrow('does not contain the configured API base and E2E mode');

      fs.writeFileSync(
        path.join(jsDirectory, 'entry.js'),
        'const e="true"===String("true").toLowerCase(); resolve({isE2E:e}); const api="http://127.0.0.1:8085/api/user/google-login/";'
      );
      expect(() =>
        assertE2EArtifactConfig({
          expectedApiBase: 'http://127.0.0.1:8085',
          jsDirectory,
          metaPath,
        })
      ).not.toThrow();

      fs.writeFileSync(
        path.join(jsDirectory, 'entry.js'),
        'const e="true"===String("true").toLowerCase(); resolve({isE2E:e}); const api="http://127.0.0.1:8085";'
      );
      fs.writeFileSync(
        path.join(jsDirectory, 'auth.js'),
        'const googleLoginPath="/user/google-login/";'
      );
      expect(() =>
        assertE2EArtifactConfig({
          expectedApiBase: 'http://127.0.0.1:8085',
          jsDirectory,
          metaPath,
        })
      ).not.toThrow();

      fs.writeFileSync(
        path.join(jsDirectory, 'entry.js'),
        'const e="true"===String("false").toLowerCase(); resolve({isE2E:e}); const api="http://127.0.0.1:8085";'
      );
      expect(() =>
        assertE2EArtifactConfig({
          expectedApiBase: 'http://127.0.0.1:8085',
          jsDirectory,
          metaPath,
        })
      ).toThrow('does not contain the configured API base and E2E mode');

      fs.writeFileSync(
        path.join(jsDirectory, 'entry.js'),
        'const e="true"===String("true").toLowerCase(); resolve({isE2E:e}); const api="https://metravel.by";'
      );
      expect(() =>
        assertE2EArtifactConfig({
          expectedApiBase: 'http://127.0.0.1:8085',
          jsDirectory,
          metaPath,
        })
      ).toThrow('does not contain the configured API base and E2E mode');

      fs.writeFileSync(
        path.join(jsDirectory, 'entry.js'),
        'const e="true"===String("true").toLowerCase(); resolve({isE2E:e}); const api="http://127.0.0.1:8085";'
      );

      fs.writeFileSync(
        path.join(jsDirectory, 'stale-auth.js'),
        'const e="true"===String("").toLowerCase(); resolve({isE2E:e}); const api="https://metravel.by/user/google-login/";'
      );
      expect(() =>
        assertE2EArtifactConfig({
          expectedApiBase: 'http://127.0.0.1:8085',
          jsDirectory,
          metaPath,
        })
      ).toThrow('does not contain the configured API base and E2E mode');

      fs.writeFileSync(
        path.join(jsDirectory, 'stale-auth.js'),
        'const api="//metravel.by/user/google-login/";'
      );
      expect(() =>
        assertE2EArtifactConfig({
          expectedApiBase: 'http://127.0.0.1:8085',
          jsDirectory,
          metaPath,
        })
      ).toThrow('does not contain the configured API base and E2E mode');
    } finally {
      removeDir(tempDir);
    }
  });
});
