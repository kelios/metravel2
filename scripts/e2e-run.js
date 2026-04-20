#!/usr/bin/env node

const { spawn, execSync } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');

const rootDir = path.join(__dirname, '..');
if (Object.prototype.hasOwnProperty.call(process.env, 'NO_COLOR')) {
  delete process.env.NO_COLOR;
}
if (Object.prototype.hasOwnProperty.call(process.env, 'FORCE_COLOR')) {
  delete process.env.FORCE_COLOR;
}

const playwrightCli = path.join(rootDir, 'node_modules', 'playwright', 'cli.js');

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

function listListeningPids(port) {
  try {
    const raw = String(
      execSync(`lsof -nP -tiTCP:${port} -sTCP:LISTEN`, {
        cwd: rootDir,
        stdio: ['ignore', 'pipe', 'ignore'],
      }) || ''
    )
      .trim()
      .split(/\r?\n/)
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isFinite(value) && value > 0);
    return raw;
  } catch {
    return [];
  }
}

function readProcessCommand(pid) {
  try {
    return String(
      execSync(`ps -p ${pid} -o command=`, {
        cwd: rootDir,
        stdio: ['ignore', 'pipe', 'ignore'],
      }) || ''
    ).trim();
  } catch {
    return '';
  }
}

function killProcess(pid, signal) {
  try {
    process.kill(pid, signal);
    return true;
  } catch {
    return false;
  }
}

function killStaleLocalWebServers(port) {
  const listeningPids = listListeningPids(port);
  const stalePids = [];

  for (const pid of listeningPids) {
    if (pid === process.pid) continue;

    const command = readProcessCommand(pid);
    const isManagedE2EServer =
      command.includes(path.join('scripts', 'serve-web-build.js')) && command.includes(rootDir);

    if (!isManagedE2EServer) continue;

    console.warn(
      `[e2e-run] Port ${port} is occupied by stale local server (pid=${pid}). Stopping it before continuing.`
    );

    if (killProcess(pid, 'SIGTERM')) {
      stalePids.push(pid);
    }
  }

  return stalePids;
}

async function waitForPortRelease(port, stalePids, timeoutMs = 5000) {
  if (!Array.isArray(stalePids) || stalePids.length === 0) return;

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const remaining = listListeningPids(port).filter((pid) => stalePids.includes(pid));
    if (remaining.length === 0) return;
    await sleep(150);
  }

  const remaining = listListeningPids(port).filter((pid) => stalePids.includes(pid));
  if (remaining.length === 0) return;

  for (const pid of remaining) {
    console.warn(
      `[e2e-run] Port ${port} is still occupied after SIGTERM (pid=${pid}). Sending SIGKILL.`
    );
    killProcess(pid, 'SIGKILL');
  }

  const killDeadline = Date.now() + 2000;
  while (Date.now() < killDeadline) {
    const active = listListeningPids(port).filter((pid) => remaining.includes(pid));
    if (active.length === 0) return;
    await sleep(100);
  }

  const active = listListeningPids(port).filter((pid) => remaining.includes(pid));
  if (active.length > 0) {
    throw new Error(
      `[e2e-run] Failed to free port ${port}; lingering server pid(s): ${active.join(', ')}`
    );
  }
}

async function cleanupManagedWebServer(port) {
  const staleServerPids = killStaleLocalWebServers(port);
  await waitForPortRelease(port, staleServerPids);
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

    const child = spawn(process.execPath, [playwrightCli, ...args], {
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

  // Keep worker count conservative to avoid long-run Playwright artifact/trace flakes
  // under local parallel load. Local runs can still opt back up with E2E_WORKERS.
  const workersFast = getNumberEnv('E2E_WORKERS', process.env.CI ? 2 : 1);
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
  await cleanupManagedWebServer(selectedPort);

  const outputRootArgIndex = forwarded.findIndex((a) => a === '--output');
  const outputRoot =
    outputRootArgIndex !== -1 && typeof forwarded[outputRootArgIndex + 1] === 'string'
      ? forwarded[outputRootArgIndex + 1]
      : 'test-results';

  const forwardedWithoutOutput =
    outputRootArgIndex !== -1 ? forwarded.filter((_, i) => i !== outputRootArgIndex && i !== outputRootArgIndex + 1) : forwarded;

  try {
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

    await cleanupManagedWebServer(selectedPort);

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
        await cleanupManagedWebServer(selectedPort);
        await sleep(1500);
      }
    }
  } finally {
    await cleanupManagedWebServer(selectedPort);
  }
}

main().catch((err) => {
  console.error(err && err.message ? err.message : String(err));
  process.exit(1);
});
