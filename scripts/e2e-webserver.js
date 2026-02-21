#!/usr/bin/env node

const { spawn } = require('node:child_process');
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const rootDir = path.join(__dirname, '..');
if (Object.prototype.hasOwnProperty.call(process.env, 'NO_COLOR')) {
  delete process.env.NO_COLOR;
}
if (Object.prototype.hasOwnProperty.call(process.env, 'FORCE_COLOR')) {
  delete process.env.FORCE_COLOR;
}
const distIndex = path.join(rootDir, 'dist', 'index.html');
const distJsDir = path.join(rootDir, 'dist', '_expo', 'static', 'js', 'web');
const distMetaPath = path.join(rootDir, 'dist', '.e2e-build-meta.json');
const envPath = path.join(rootDir, '.env');
const e2ePublicFlagLine = 'EXPO_PUBLIC_E2E=true';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readJsonIfExists(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function writeJson(filePath, data) {
  try {
    fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  } catch {
    // ignore
  }
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

function hasEntryBundleSync() {
  try {
    if (!fs.existsSync(distJsDir)) return false;
    const files = fs.readdirSync(distJsDir);
    return !!files.find((f) => f.startsWith('entry-') && f.endsWith('.js'));
  } catch {
    return false;
  }
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

function sanitizedEnv(baseEnv) {
  const nextEnv = { ...baseEnv };
  if (Object.prototype.hasOwnProperty.call(nextEnv, 'NO_COLOR')) {
    delete nextEnv.NO_COLOR;
  }
  if (Object.prototype.hasOwnProperty.call(nextEnv, 'FORCE_COLOR')) {
    delete nextEnv.FORCE_COLOR;
  }
  return nextEnv;
}

function getGitBuildStamp(cwd) {
  const result = {
    head: null,
    statusHash: null,
  };

  try {
    const head = String(execSync('git rev-parse HEAD', { cwd, stdio: ['ignore', 'pipe', 'ignore'] }) || '')
      .trim();
    result.head = head || null;
  } catch {
    // ignore (no git)
  }

  try {
    const status = String(execSync('git status --porcelain', { cwd, stdio: ['ignore', 'pipe', 'ignore'] }) || '');
    const hash = crypto.createHash('sha1').update(status).digest('hex');
    result.statusHash = hash;
  } catch {
    // ignore (no git)
  }

  return result;
}

async function main() {
  const buildTimeoutMs = Number(process.env.E2E_BUILD_TIMEOUT_MS || '540000'); // 9 minutes
  const e2eWebPort = Number(process.env.E2E_WEB_PORT || '8085');
  const e2eApiBase = `http://127.0.0.1:${e2eWebPort}`;
  const forceRebuild = String(process.env.E2E_FORCE_REBUILD || '') === '1';

  process.env.EXPO_PUBLIC_E2E = 'true';
  process.env.EXPO_PUBLIC_IS_LOCAL_API = 'false';
  process.env.EXPO_PUBLIC_API_URL = e2eApiBase;

  const buildMeta = {
    expoPublic: {
      EXPO_PUBLIC_E2E: 'true',
      EXPO_PUBLIC_IS_LOCAL_API: 'false',
      EXPO_PUBLIC_API_URL: e2eApiBase,
    },
    git: getGitBuildStamp(rootDir),
    node: process.version,
    createdAt: new Date().toISOString(),
  };

  const existingMeta = readJsonIfExists(distMetaPath);
  const canReuseBuild =
    !forceRebuild &&
    fs.existsSync(distIndex) &&
    hasEntryBundleSync() &&
    existingMeta &&
    existingMeta.expoPublic &&
    existingMeta.expoPublic.EXPO_PUBLIC_E2E === buildMeta.expoPublic.EXPO_PUBLIC_E2E &&
    existingMeta.expoPublic.EXPO_PUBLIC_IS_LOCAL_API === buildMeta.expoPublic.EXPO_PUBLIC_IS_LOCAL_API &&
    existingMeta.expoPublic.EXPO_PUBLIC_API_URL === buildMeta.expoPublic.EXPO_PUBLIC_API_URL &&
    // Prevent stale dist reuse when local source changes.
    // If git info is missing (e.g. CI tarball), fallback to old env-only behavior.
    (!buildMeta.git?.head ||
      !buildMeta.git?.statusHash ||
      (existingMeta.git &&
        existingMeta.git.head === buildMeta.git.head &&
        existingMeta.git.statusHash === buildMeta.git.statusHash));

  if (canReuseBuild) {
    console.log('[e2e-webserver] Reusing existing dist build');
  } else {
    console.log(`[e2e-webserver] Building web export (force=${forceRebuild ? '1' : '0'})`);
  }

  // Ensure EXPO_PUBLIC_E2E is present for the Expo env loader (it only prints/exports vars from .env files).
  // We patch .env temporarily for the build and restore it afterwards.
  let originalEnvFile = null;
  if (!canReuseBuild) {
    try {
      if (fs.existsSync(envPath)) {
        originalEnvFile = fs.readFileSync(envPath, 'utf8');
      } else {
        originalEnvFile = '';
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
      env: sanitizedEnv(process.env),
    });

    try {
      await waitForFile(distIndex, buildTimeoutMs);
      await waitForEntryBundle(buildTimeoutMs);
      await sleep(500);
      writeJson(distMetaPath, buildMeta);
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
  }

  // Serve the built export.
  const server = spawn(process.execPath, [path.join(__dirname, 'serve-web-build.js')], {
    cwd: rootDir,
    stdio: 'inherit',
    env: sanitizedEnv(process.env),
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
