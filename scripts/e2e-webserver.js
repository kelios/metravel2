#!/usr/bin/env node

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.join(__dirname, '..');
const distIndex = path.join(rootDir, 'dist', 'index.html');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForFile(filePath, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      if (fs.existsSync(filePath)) return;
    } catch {
      // ignore and keep polling
    }
    await sleep(500);
  }
  throw new Error(`Timed out waiting for ${filePath} (${timeoutMs}ms)`);
}

function killProcessTree(child) {
  if (!child || child.killed) return;
  try {
    child.kill('SIGTERM');
  } catch {
    // ignore
  }
  setTimeout(() => {
    try {
      if (!child.killed) child.kill('SIGKILL');
    } catch {
      // ignore
    }
  }, 5000).unref();
}

async function main() {
  const buildTimeoutMs = Number(process.env.E2E_BUILD_TIMEOUT_MS || '540000'); // 9 minutes

  // Build web export.
  // Expo export sometimes doesn't exit cleanly even after writing to dist, which can block Playwright webServer.
  // We treat the build as "done" once dist/index.html exists, then terminate the build process.
  const build = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build:web'], {
    cwd: rootDir,
    stdio: 'inherit',
    env: process.env,
  });

  try {
    await waitForFile(distIndex, buildTimeoutMs);
  } finally {
    killProcessTree(build);
  }

  // Serve the built export.
  const server = spawn(process.execPath, [path.join(__dirname, 'serve-web-build.js')], {
    cwd: rootDir,
    stdio: 'inherit',
    env: process.env,
  });

  const shutdown = () => {
    killProcessTree(server);
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  server.on('exit', (code) => process.exit(typeof code === 'number' ? code : 0));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

