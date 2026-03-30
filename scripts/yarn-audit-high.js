const { spawnSync } = require('child_process');

const result = spawnSync('yarn', ['audit', '--json'], {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
});

const out = (result.stdout || '').trim();
const err = (result.stderr || '').trim();

if (!out && result.status !== 0) {
  // If yarn produced no JSON output, fail with whatever we have.
  process.stderr.write(err ? `${err}\n` : 'yarn audit failed with no output\n');
  process.exit(result.status || 1);
}

const lines = out.split(/\r?\n/).filter(Boolean);

// Modules whose vulnerabilities are in transitive Expo/RN SDK dependencies
// and cannot be resolved without an upstream SDK update.
const IGNORED_MODULES = new Set([
  'node-forge', // expo > @expo/cli > @expo/code-signing-certificates
]);

let highOrCriticalCount = 0;
let ignoredCount = 0;
let moderateCount = 0;
let lowCount = 0;

for (const line of lines) {
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    continue;
  }

  if (msg.type !== 'auditAdvisory') continue;

  const moduleName = String(msg?.data?.advisory?.module_name || '');
  const severity = String(msg?.data?.advisory?.severity || '').toLowerCase();

  if (IGNORED_MODULES.has(moduleName)) {
    ignoredCount += 1;
    continue;
  }

  if (severity === 'critical' || severity === 'high') {
    highOrCriticalCount += 1;
  } else if (severity === 'moderate') {
    moderateCount += 1;
  } else if (severity === 'low') {
    lowCount += 1;
  }
}

if (highOrCriticalCount > 0) {
  process.stderr.write(`yarn audit: found ${highOrCriticalCount} high/critical vulnerabilities\n`);
  process.exit(1);
}

// Print a short summary (keep it minimal to avoid noisy logs)
const ignoredNote = ignoredCount > 0 ? `, ignored: ${ignoredCount}` : '';
process.stdout.write(
  `yarn audit: OK (high/critical: 0, moderate: ${moderateCount}, low: ${lowCount}${ignoredNote})\n`
);
process.exit(0);
