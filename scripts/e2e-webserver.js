#!/usr/bin/env node

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.join(__dirname, '..');
const distIndex = path.join(rootDir, 'dist', 'index.html');
const distJsDir = path.join(rootDir, 'dist', '_expo', 'static', 'js', 'web');
const envPath = path.join(rootDir, '.env');
const e2ePublicFlagLine = 'EXPO_PUBLIC_E2E=true';

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

async function waitForEntryBundle(timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      if (fs.existsSync(distJsDir)) {
        const files = fs.readdirSync(distJsDir);
        const entry = files.find((f) => f.startsWith('entry-') && f.endsWith('.js'));
        if (entry) return;
      }
    } catch {
      // ignore and keep polling
    }
    await sleep(500);
  }
  throw new Error(`Timed out waiting for entry bundle in ${distJsDir} (${timeoutMs}ms)`);
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

  // Ensure EXPO_PUBLIC_E2E is present for the Expo env loader (it only prints/exports vars from .env files).
  // We patch .env temporarily for the build and restore it afterwards.
  let originalEnvFile = null;
  try {
    if (fs.existsSync(envPath)) {
      originalEnvFile = fs.readFileSync(envPath, 'utf8');
    } else {
      originalEnvFile = '';
    }

    if (!originalEnvFile.includes('EXPO_PUBLIC_E2E=')) {
      const next = `${originalEnvFile.trimEnd()}\n${e2ePublicFlagLine}\n`;
      fs.writeFileSync(envPath, next, 'utf8');
    }
  } catch (e) {
    console.error('[e2e-webserver] Failed to patch .env for E2E:', e);
  }

  // Force a rebuild even if a previous `dist/index.html` exists.
  // Otherwise the "waitForFile" completes immediately and we terminate the build before it applies env changes.
  try {
    if (fs.existsSync(distIndex)) {
      fs.unlinkSync(distIndex);
    }
  } catch (e) {
    console.error('[e2e-webserver] Failed to remove dist/index.html before E2E build:', e);
  }

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
    await waitForEntryBundle(buildTimeoutMs);
    await sleep(500);
  } finally {
    killProcessTree(build);
    try {
      if (originalEnvFile != null) {
        fs.writeFileSync(envPath, originalEnvFile, 'utf8');
      }
    } catch (e) {
      console.error('[e2e-webserver] Failed to restore .env after E2E build:', e);
    }
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
