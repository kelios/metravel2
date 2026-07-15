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

function findManagedLocalWebServers(port) {
  const listeningPids = listListeningPids(port);
  return listeningPids.filter((pid) => {
    if (pid === process.pid) return false;
    const command = readProcessCommand(pid);
    return command.includes(path.join('scripts', 'serve-web-build.js')) && command.includes(rootDir);
  });
}

async function observeManagedWebServer(port) {
  const pids = findManagedLocalWebServers(port);
  if (pids.length > 0) {
    console.warn(
      `[e2e-run] Leaving existing managed server untouched on port ${port} (pid=${pids.join(',')}).`
    );
  }
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

async function runFastPlaywrightPass({
  workers,
  outputRoot,
  forwarded,
  port,
  shards,
  retries,
}) {
  const shardCount = Math.max(1, Number.isFinite(shards) ? Math.floor(shards) : 1);
  const shardRetries = Math.max(0, Number.isFinite(retries) ? Math.floor(retries) : 0);
  for (let shardIndex = 1; shardIndex <= shardCount; shardIndex += 1) {
    const shardArgs =
      shardCount > 1
        ? ['--shard', `${shardIndex}/${shardCount}`]
        : [];
    const shardOutput =
      shardCount > 1
        ? path.join(outputRoot, `e2e-fast-shard-${shardIndex}-of-${shardCount}`)
        : path.join(outputRoot, 'e2e-fast');

    if (shardCount > 1) {
      console.log(`[e2e-run] Fast pass shard ${shardIndex}/${shardCount}`);
    }

    let attempt = 0;
    while (true) {
      try {
        await runPlaywright([
          'test',
          '--forbid-only',
          '--retries=0',
          '--pass-with-no-tests',
          `--workers=${workers}`,
          '--grep-invert',
          '@perf',
          '--output',
          shardOutput,
          ...shardArgs,
          ...forwarded,
        ]);
        break;
      } catch (err) {
        if (attempt >= shardRetries) throw err;
        attempt += 1;
        const message = err && err.message ? err.message : String(err);
        console.warn(
          `[e2e-run] Fast pass shard ${shardIndex}/${shardCount} failed (attempt ${attempt}/${shardRetries + 1}): ${message}`
        );
        console.warn(`[e2e-run] Retrying fast pass shard ${shardIndex}/${shardCount}...`);
        await observeManagedWebServer(port);
        await sleep(1500);
      }
    }

    await observeManagedWebServer(port);
  }
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
  const fastShards = getNumberEnv('E2E_FAST_SHARDS', process.env.CI ? 1 : 16);
  const fastShardRetries = getNumberEnv('E2E_FAST_SHARD_RETRIES', process.env.CI ? 0 : 1);
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
  await observeManagedWebServer(selectedPort);

  const outputRootArgIndex = forwarded.findIndex((a) => a === '--output');
  const outputRoot =
    outputRootArgIndex !== -1 && typeof forwarded[outputRootArgIndex + 1] === 'string'
      ? forwarded[outputRootArgIndex + 1]
      : 'test-results';

  const forwardedWithoutOutput =
    outputRootArgIndex !== -1 ? forwarded.filter((_, i) => i !== outputRootArgIndex && i !== outputRootArgIndex + 1) : forwarded;

  try {
    // Pass 1: functional/UI/regression tests in parallel (exclude perf).
    await runFastPlaywrightPass({
      workers: workersFast,
      outputRoot,
      forwarded: forwardedWithoutOutput,
      port: selectedPort,
      shards: fastShards,
      retries: fastShardRetries,
    });

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
        await observeManagedWebServer(selectedPort);
        await sleep(1500);
      }
    }
  } finally {
    await observeManagedWebServer(selectedPort);
  }
}

main().catch((err) => {
  console.error(err && err.message ? err.message : String(err));
  process.exit(1);
});
