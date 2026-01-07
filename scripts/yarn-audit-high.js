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

let highOrCriticalCount = 0;
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

  const severity = String(msg?.data?.advisory?.severity || '').toLowerCase();
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
process.stdout.write(
  `yarn audit: OK (high/critical: 0, moderate: ${moderateCount}, low: ${lowCount})\n`
);
process.exit(0);
