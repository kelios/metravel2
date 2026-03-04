#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const distIndex = path.join(rootDir, 'dist', 'index.html');

function hasEntryBundle() {
  const webDir = path.join(rootDir, 'dist', '_expo', 'static', 'js', 'web');
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

// Prevent stale dist artifacts from making the readiness check pass immediately.
try {
  fs.rmSync(distIndex, { force: true });
} catch {
  // no-op
}

const child = spawn(
  process.execPath,
  ['./node_modules/expo/bin/cli', 'export', '-p', 'web'],
  {
    cwd: rootDir,
    stdio: 'inherit',
    env: { ...process.env, CI: '1' },
  }
);

let exportReady = false;
let terminatedByUs = false;

const readinessTimer = setInterval(() => {
  if (exportReady) return;

  if (fileExists(distIndex) && hasEntryBundle()) {
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
  console.error('[build-web-safe] Failed to start expo export:', error);
  process.exit(1);
});

child.on('exit', (code) => {
  clearInterval(readinessTimer);

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
