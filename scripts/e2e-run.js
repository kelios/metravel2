#!/usr/bin/env node

const { spawn } = require('node:child_process');
const path = require('node:path');

const rootDir = path.join(__dirname, '..');

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

function runPlaywright(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(playwrightBin, args, {
      cwd: rootDir,
      stdio: 'inherit',
      env: process.env,
    });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Playwright exited with code ${code}`));
    });
  });
}

async function main() {
  const forwarded = process.argv.slice(2);

  // This runner owns grep flags to split perf/non-perf.
  if (hasAnyArg(forwarded, ['-g', '--grep', '--grep-invert'])) {
    console.error('[e2e-run] Do not pass --grep/--grep-invert to this runner.');
    console.error('[e2e-run] Run Playwright directly instead: `yarn playwright test ...`');
    process.exit(2);
  }

  const workersFast = getNumberEnv('E2E_WORKERS', process.env.CI ? 4 : 4);
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
    `--workers=${workersFast}`,
    '--grep-invert',
    '@perf',
    '--output',
    path.join(outputRoot, 'e2e-fast'),
    ...forwardedWithoutOutput,
  ]);

  // Pass 2: perf/vitals tests in isolation (single worker).
  await runPlaywright([
    'test',
    '--forbid-only',
    '--retries=0',
    '--workers=1',
    '--grep',
    '@perf',
    '--output',
    path.join(outputRoot, 'e2e-perf'),
    ...forwardedWithoutOutput,
  ]);
}

main().catch((err) => {
  console.error(err && err.message ? err.message : String(err));
  process.exit(1);
});

