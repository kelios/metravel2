#!/usr/bin/env node

const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');

const rootDir = path.join(__dirname, '..');
if (Object.prototype.hasOwnProperty.call(process.env, 'NO_COLOR')) {
  delete process.env.NO_COLOR;
}
if (Object.prototype.hasOwnProperty.call(process.env, 'FORCE_COLOR')) {
  delete process.env.FORCE_COLOR;
}

const playwrightBin =
  process.platform === 'win32'
    ? path.join(rootDir, 'node_modules', '.bin', 'playwright.cmd')
    : path.join(rootDir, 'node_modules', '.bin', 'playwright');

function getNumberEnv(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const v = Number(raw);
  return Number.isFinite(v) ? v : fallback;
}

function hasAnyArg(args, names) {
  return args.some((a) => names.includes(a));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function runPlaywright(args) {
  return new Promise((resolve, reject) => {
    const childEnv = { ...process.env };
    if (Object.prototype.hasOwnProperty.call(childEnv, 'NO_COLOR')) {
      delete childEnv.NO_COLOR;
    }
    if (Object.prototype.hasOwnProperty.call(childEnv, 'FORCE_COLOR')) {
      delete childEnv.FORCE_COLOR;
    }

    const child = spawn(playwrightBin, args, {
      cwd: rootDir,
      stdio: 'inherit',
      env: childEnv,
    });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Playwright exited with code ${code}`));
    });
  });
}

function checkPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.on('error', () => resolve(false));
    server.listen(port, '127.0.0.1', () => {
      server.close(() => resolve(true));
    });
  });
}

async function findAvailablePort(startPort, maxAttempts = 50) {
  for (let offset = 0; offset < maxAttempts; offset += 1) {
    const candidate = startPort + offset;
    const free = await checkPortFree(candidate);
    if (free) return candidate;
  }
  return startPort;
}

async function main() {
  const forwarded = process.argv.slice(2);

  // This runner owns grep flags to split perf/non-perf.
  if (hasAnyArg(forwarded, ['-g', '--grep', '--grep-invert'])) {
    console.error('[e2e-run] Do not pass --grep/--grep-invert to this runner.');
    console.error('[e2e-run] Run Playwright directly instead: `yarn playwright test ...`');
    process.exit(2);
  }

  // Keep CI worker count conservative to avoid web export server OOM/connection-refused flakes
  // in long parallel runs. Local runs can still override with E2E_WORKERS.
  const workersFast = getNumberEnv('E2E_WORKERS', process.env.CI ? 2 : 4);
  const requestedPort = getNumberEnv('E2E_WEB_PORT', 8085);
  const autoSelectPort = String(process.env.E2E_AUTO_SELECT_PORT || '1') !== '0';
  const selectedPort = autoSelectPort
    ? await findAvailablePort(requestedPort)
    : requestedPort;

  if (selectedPort !== requestedPort) {
    console.log(
      `[e2e-run] Port ${requestedPort} is busy, using ${selectedPort} for this run.`
    );
  }
  process.env.E2E_WEB_PORT = String(selectedPort);

  const outputRootArgIndex = forwarded.findIndex((a) => a === '--output');
  const outputRoot =
    outputRootArgIndex !== -1 && typeof forwarded[outputRootArgIndex + 1] === 'string'
      ? forwarded[outputRootArgIndex + 1]
      : 'test-results';

  const forwardedWithoutOutput =
    outputRootArgIndex !== -1 ? forwarded.filter((_, i) => i !== outputRootArgIndex && i !== outputRootArgIndex + 1) : forwarded;

  // Pass 1: functional/UI/regression tests in parallel (exclude perf).
  await runPlaywright([
    'test',
    '--forbid-only',
    '--retries=0',
    '--pass-with-no-tests',
    `--workers=${workersFast}`,
    '--grep-invert',
    '@perf',
    '--output',
    path.join(outputRoot, 'e2e-fast'),
    ...forwardedWithoutOutput,
  ]);

  // Pass 2: perf/vitals tests in isolation (single worker).
  // Local environments occasionally hit transient web-server disconnects between long phases.
  // Retry once by default; real regressions still fail on the second attempt.
  const perfRetries = Math.max(0, getNumberEnv('E2E_PERF_RETRIES', 1));
  let perfAttempt = 0;
  while (true) {
    try {
      await runPlaywright([
        'test',
        '--forbid-only',
        '--retries=0',
        '--pass-with-no-tests',
        '--workers=1',
        '--grep',
        '@perf',
        '--output',
        path.join(outputRoot, 'e2e-perf'),
        ...forwardedWithoutOutput,
      ]);
      break;
    } catch (err) {
      if (perfAttempt >= perfRetries) throw err;
      perfAttempt += 1;
      const message = err && err.message ? err.message : String(err);
      console.warn(
        `[e2e-run] Perf pass failed (attempt ${perfAttempt}/${perfRetries + 1}): ${message}`
      );
      console.warn('[e2e-run] Retrying perf pass...');
      await sleep(1500);
    }
  }
}

main().catch((err) => {
  console.error(err && err.message ? err.message : String(err));
  process.exit(1);
});
