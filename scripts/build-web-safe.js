#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

function getArgValue(flag, fallback = '') {
  const index = process.argv.indexOf(flag);
  if (index >= 0 && index + 1 < process.argv.length) {
    return String(process.argv[index + 1] || '').trim();
  }
  return fallback;
}

const outputDirArg = getArgValue('--output-dir', 'dist');
const outputDir = path.resolve(rootDir, outputDirArg);
const outputIndex = path.join(outputDir, 'index.html');
function getPassthroughArgs(argv = process.argv.slice(2)) {
  return argv.filter((arg, index, args) => {
    if (arg === '--output-dir') return false;
    if (index > 0 && args[index - 1] === '--output-dir') return false;
    return true;
  });
}

function getExpoExportArgs(argv = process.argv.slice(2), resolvedOutputDir = outputDir) {
  return [...getPassthroughArgs(argv), '--output-dir', resolvedOutputDir];
}

function hasClearFlag(args) {
  return args.includes('-c') || args.includes('--clear');
}

function createIsolatedExpoTempDir(projectRoot, now = Date.now(), pid = process.pid) {
  const tempRoot = path.join(projectRoot, '.tmp', 'expo-export');
  const dirName = `run-${now}-${pid}`;
  const tempDir = path.join(tempRoot, dirName);
  fs.mkdirSync(tempDir, { recursive: true });
  return tempDir;
}

function hasEntryBundle(buildDir) {
  const webDir = path.join(buildDir, '_expo', 'static', 'js', 'web');
  try {
    const files = fs.readdirSync(webDir);
    return files.some((file) => file.startsWith('entry-') && file.endsWith('.js'));
  } catch {
    return false;
  }
}

function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function resolveReadyDir() {
  const candidates = [outputDir];

  return (
    candidates.find((candidateDir) => {
      const candidateIndex = path.join(candidateDir, 'index.html');
      return fileExists(candidateIndex) && hasEntryBundle(candidateDir);
    }) || null
  );
}

function main() {
  const passthroughArgs = getPassthroughArgs();
  const expoExportArgs = getExpoExportArgs(process.argv.slice(2), outputDir);

  // Prevent stale dist artifacts from making the readiness check pass immediately.
  try {
    fs.rmSync(outputIndex, { force: true });
  } catch {
    // no-op
  }

  const isolatedExpoTempDir = hasClearFlag(passthroughArgs)
    ? createIsolatedExpoTempDir(rootDir)
    : null;

  const cleanupIsolatedExpoTempDir = () => {
    if (!isolatedExpoTempDir) return;
    try {
      fs.rmSync(isolatedExpoTempDir, { recursive: true, force: true });
    } catch {
      // no-op
    }
  };

  const child = spawn(
    process.execPath,
    ['./node_modules/expo/bin/cli', 'export', ...expoExportArgs],
    {
      cwd: rootDir,
      stdio: 'inherit',
      env: {
        ...process.env,
        CI: '1',
        EXPO_NO_INTERACTIVE: process.env.EXPO_NO_INTERACTIVE || '1',
        ...(isolatedExpoTempDir
          ? {
              TMPDIR: isolatedExpoTempDir,
              TMP: isolatedExpoTempDir,
              TEMP: isolatedExpoTempDir,
            }
          : null),
      },
    }
  );

  let exportReady = false;
  let terminatedByUs = false;
  let readyDir = null;

  const readinessTimer = setInterval(() => {
    if (exportReady) return;

    readyDir = resolveReadyDir();

    if (readyDir) {
      exportReady = true;

      // Expo export can hang after writing artifacts; stop it once export is ready.
      setTimeout(() => {
        if (child.exitCode == null) {
          terminatedByUs = true;
          child.kill('SIGTERM');

          setTimeout(() => {
            if (child.exitCode == null) {
              child.kill('SIGKILL');
            }
          }, 2000);
        }
      }, 500);
    }
  }, 250);

  child.on('error', (error) => {
    clearInterval(readinessTimer);
    cleanupIsolatedExpoTempDir();
    console.error('[build-web-safe] Failed to start expo export:', error);
    process.exit(1);
  });

  child.on('exit', (code) => {
    clearInterval(readinessTimer);
    cleanupIsolatedExpoTempDir();

    if (code === 0) {
      process.exit(0);
      return;
    }

    if (terminatedByUs && exportReady) {
      process.exit(0);
      return;
    }

    process.exit(typeof code === 'number' ? code : 1);
  });
}

module.exports = {
  createIsolatedExpoTempDir,
  getExpoExportArgs,
  getPassthroughArgs,
  hasClearFlag,
  main,
};

if (require.main === module) {
  main();
}
