#!/usr/bin/env node

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.join(__dirname, '..');
const distIndex = path.join(rootDir, 'dist', 'index.html');
const distJsDir = path.join(rootDir, 'dist', '_expo', 'static', 'js', 'web');
const envPath = path.join(rootDir, '.env');
const e2ePublicFlagLine = 'EXPO_PUBLIC_E2E=true';
const e2eLocalApiFlagLine = 'EXPO_PUBLIC_IS_LOCAL_API=false';

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
  const e2eWebPort = Number(process.env.E2E_WEB_PORT || '8085');
  const e2eApiBase = `http://127.0.0.1:${e2eWebPort}`;

  process.env.EXPO_PUBLIC_E2E = 'true';
  process.env.EXPO_PUBLIC_IS_LOCAL_API = 'false';
  process.env.EXPO_PUBLIC_API_URL = e2eApiBase;

  // Ensure EXPO_PUBLIC_E2E is present for the Expo env loader (it only prints/exports vars from .env files).
  // We patch .env temporarily for the build and restore it afterwards.
  let originalEnvFile = null;
  let originalApiUrl = null;
  try {
    if (fs.existsSync(envPath)) {
      originalEnvFile = fs.readFileSync(envPath, 'utf8');
    } else {
      originalEnvFile = '';
    }

    const apiMatch = originalEnvFile.match(/^\s*EXPO_PUBLIC_API_URL\s*=\s*(.+)\s*$/m);
    if (apiMatch && apiMatch[1]) {
      originalApiUrl = apiMatch[1].replace(/^['"]|['"]$/g, '').trim();
    }

    let envLines = originalEnvFile.split(/\r?\n/);
    const isKeyLine = (line, key) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return false;
      const normalized = trimmed.replace(/\s+/g, '');
      return normalized.startsWith(`${key}=`);
    };
    const setEnvLine = (key, value) => {
      const nextLine = `${key}=${value}`;
      envLines = envLines.filter((line) => !isKeyLine(line, key));
      envLines.push(nextLine);
    };

    if (!originalEnvFile.includes('EXPO_PUBLIC_E2E=')) {
      envLines.push(e2ePublicFlagLine);
    }

    setEnvLine('EXPO_PUBLIC_IS_LOCAL_API', 'false');
    setEnvLine('EXPO_PUBLIC_API_URL', e2eApiBase);

    const next = `${envLines.filter(Boolean).join('\n')}\n`;
    fs.writeFileSync(envPath, next, 'utf8');
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
