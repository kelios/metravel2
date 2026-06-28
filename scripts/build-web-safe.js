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

function hasPlatformFlag(args = []) {
  return args.some((arg, index) => {
    if (arg === '-p' || arg === '--platform') return true
    if (typeof arg === 'string' && arg.startsWith('--platform=')) return true
    if (typeof arg === 'string' && arg.startsWith('-p=')) return true
    return index > 0 && (args[index - 1] === '-p' || args[index - 1] === '--platform')
  })
}

function getExpoExportArgs(argv = process.argv.slice(2), resolvedOutputDir = outputDir) {
  const passthroughArgs = getPassthroughArgs(argv)
  const platformArgs = hasPlatformFlag(passthroughArgs) ? [] : ['-p', 'web']
  return [...platformArgs, ...passthroughArgs, '--output-dir', resolvedOutputDir]
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

// Signature = sorted "name:size" list of every .js chunk currently on disk.
// Returns null if entry-*.js is missing or any chunk is 0 bytes.
// Used to detect when Metro has stopped writing new files (stable signature
// across consecutive polls), so we don't SIGTERM expo while a late chunk is
// still flushing — that ships a 0-byte chunk and produces "ReferenceError:
// __d is not defined → white screen" on prod.
function getJsBundleSignature(buildDir) {
  const webDir = path.join(buildDir, '_expo', 'static', 'js', 'web');
  try {
    const files = fs.readdirSync(webDir).filter((file) => file.endsWith('.js'));
    if (!files.some((file) => file.startsWith('entry-'))) return null;
    const sorted = [...files].sort();
    const parts = [];
    for (const file of sorted) {
      const stat = fs.statSync(path.join(webDir, file));
      if (stat.size === 0) return null;
      parts.push(`${file}:${stat.size}`);
    }
    return parts.join('|');
  } catch {
    return null;
  }
}

function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function main() {
  // Share the cross-session build mutex with build-web-prod.js. When this
  // wrapper is spawned BY the prod build (which already holds the lock),
  // MT_BUILD_LOCK_OWNED=1 is inherited and acquireBuildLock() is a no-op.
  const { acquireBuildLock, registerBuildLockCleanup } = require('./build-lock');
  registerBuildLockCleanup();
  acquireBuildLock();

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
  let lastSignature = null;
  let stableTicks = 0;
  // 4 consecutive identical signatures (~1s of stability at 250ms poll) before
  // we trust that Metro has actually stopped writing. A single stable poll is
  // not enough: Metro writes split chunks in parallel, and a new chunk file
  // can appear *after* the first ready-detected tick. Without this debounce,
  // the SIGTERM grace period (500ms) races chunk creation and ships a 0-byte
  // file → "ReferenceError: __d is not defined" → white screen on prod.
  const REQUIRED_STABLE_TICKS = 4;

  const readinessTimer = setInterval(() => {
    if (exportReady) return;

    const candidateIndex = path.join(outputDir, 'index.html');
    const signature = fileExists(candidateIndex)
      ? getJsBundleSignature(outputDir)
      : null;

    if (!signature) {
      lastSignature = null;
      stableTicks = 0;
      return;
    }

    if (signature === lastSignature) {
      stableTicks += 1;
    } else {
      lastSignature = signature;
      stableTicks = 1;
    }

    if (stableTicks < REQUIRED_STABLE_TICKS) return;

    // Re-verify right before committing — a chunk could have appeared on this
    // very tick after the readdir snapshot was taken.
    const finalSignature = getJsBundleSignature(outputDir);
    if (finalSignature !== lastSignature) {
      lastSignature = finalSignature;
      stableTicks = finalSignature ? 1 : 0;
      return;
    }

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
  hasPlatformFlag,
  hasClearFlag,
  main,
};

if (require.main === module) {
  main();
}
