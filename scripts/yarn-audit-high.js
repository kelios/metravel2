const { spawnSync } = require('child_process');

const SEVERITIES = Object.freeze(['info', 'low', 'moderate', 'high', 'critical']);

// Modules whose vulnerabilities are in transitive Expo/RN SDK dependencies
// and cannot be resolved without an upstream SDK update.
const IGNORED_MODULES = new Set([
  'node-forge', // expo > @expo/cli > @expo/code-signing-certificates
]);

const createCounts = () => ({
  info: 0,
  low: 0,
  moderate: 0,
  high: 0,
  critical: 0,
});

const failClosed = (reason) => ({
  exitCode: 1,
  stdout: '',
  stderr: `yarn audit: FAILED CLOSED (${reason})\n`,
});

const isNonNegativeInteger = (value) => Number.isInteger(value) && value >= 0;

const parseJsonLines = (output) => {
  const lines = String(output || '').split(/\r?\n/).filter((line) => line.trim());
  if (lines.length === 0) {
    return { error: 'missing trustworthy audit summary' };
  }

  const records = [];
  for (let index = 0; index < lines.length; index += 1) {
    let record;
    try {
      record = JSON.parse(lines[index]);
    } catch {
      return { error: `malformed JSON at line ${index + 1}` };
    }

    if (!record || Array.isArray(record) || typeof record !== 'object' || typeof record.type !== 'string') {
      return { error: `malformed audit record at line ${index + 1}` };
    }
    records.push(record);
  }

  return { records };
};

const hasErrorRecord = (output) => {
  return String(output || '')
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .some((line) => {
      try {
        return JSON.parse(line)?.type === 'error';
      } catch {
        return false;
      }
    });
};

const readSummaryCounts = (summary) => {
  const totalDependencies = summary?.data?.totalDependencies;
  const vulnerabilities = summary?.data?.vulnerabilities;

  if (!isNonNegativeInteger(totalDependencies) || totalDependencies === 0) {
    return { error: 'invalid audit dependency metadata' };
  }
  if (!vulnerabilities || typeof vulnerabilities !== 'object' || Array.isArray(vulnerabilities)) {
    return { error: 'invalid audit vulnerability metadata' };
  }

  const counts = createCounts();
  for (const severity of SEVERITIES) {
    if (!isNonNegativeInteger(vulnerabilities[severity])) {
      return { error: `invalid ${severity} vulnerability count` };
    }
    counts[severity] = vulnerabilities[severity];
  }

  return { counts };
};

const formatPolicySummary = (counts, ignoredCount) => {
  const allowedIgnoredModules = [...IGNORED_MODULES].sort().join(', ') || 'none';
  return [
    `high/critical: ${counts.high + counts.critical}`,
    `moderate: ${counts.moderate}`,
    `low: ${counts.low}`,
    `ignored: ${ignoredCount}`,
    `allowed ignored modules: ${allowedIgnoredModules}`,
  ].join(', ');
};

// Yarn v1 reports completed audits with a severity bitmask rather than a
// conventional zero status: info=1, low=2, moderate=4, high=8, critical=16.
const getExpectedAuditExitCode = (counts) => {
  return (counts.info > 0 ? 1 : 0)
    + (counts.low > 0 ? 2 : 0)
    + (counts.moderate > 0 ? 4 : 0)
    + (counts.high > 0 ? 8 : 0)
    + (counts.critical > 0 ? 16 : 0);
};

const evaluateSuccessfulAudit = (output) => {
  const parsed = parseJsonLines(output);
  if (parsed.error) {
    return failClosed(parsed.error);
  }

  if (parsed.records.some((record) => record.type === 'error')) {
    return failClosed('registry/tool error record');
  }

  const summaries = parsed.records.filter((record) => record.type === 'auditSummary');
  if (summaries.length !== 1) {
    return failClosed('missing or duplicate trustworthy audit summary');
  }

  const summaryResult = readSummaryCounts(summaries[0]);
  if (summaryResult.error) {
    return failClosed(summaryResult.error);
  }
  const expectedChildStatus = getExpectedAuditExitCode(summaryResult.counts);

  const advisoryCounts = createCounts();
  const ignoredCounts = createCounts();
  let ignoredCount = 0;

  for (const record of parsed.records) {
    if (record.type !== 'auditAdvisory') continue;

    const advisory = record?.data?.advisory;
    const moduleName = typeof advisory?.module_name === 'string' ? advisory.module_name.trim() : '';
    const severity = typeof advisory?.severity === 'string' ? advisory.severity.toLowerCase() : '';

    if (!moduleName || !SEVERITIES.includes(severity)) {
      return failClosed('malformed audit advisory record');
    }

    advisoryCounts[severity] += 1;
    if (IGNORED_MODULES.has(moduleName)) {
      ignoredCounts[severity] += 1;
      ignoredCount += 1;
    }
  }

  const counts = { ...summaryResult.counts };
  for (const severity of SEVERITIES) {
    if (advisoryCounts[severity] > counts[severity]) {
      return failClosed('audit summary/advisory mismatch');
    }
    counts[severity] -= ignoredCounts[severity];
  }

  const policySummary = formatPolicySummary(counts, ignoredCount);
  if (counts.high + counts.critical > 0) {
    return {
      exitCode: 1,
      stdout: '',
      stderr: `yarn audit: found high/critical vulnerabilities (${policySummary})\n`,
      expectedChildStatus,
    };
  }

  return {
    exitCode: 0,
    stdout: `yarn audit: OK (${policySummary})\n`,
    stderr: '',
    expectedChildStatus,
  };
};

const evaluateAuditResult = (result) => {
  const output = String(result?.stdout || '');
  const errorOutput = String(result?.stderr || '');
  const containsErrorRecord = hasErrorRecord(output) || hasErrorRecord(errorOutput);

  if (result?.error) {
    return failClosed('audit command could not start');
  }

  if (containsErrorRecord) {
    const reason = result?.status === 0
      ? 'registry/tool error record'
      : 'registry/tool error and unsuccessful child exit';
    return failClosed(reason);
  }

  const outcome = evaluateSuccessfulAudit(output);
  if (!isNonNegativeInteger(outcome.expectedChildStatus)) {
    return outcome;
  }

  if (result?.status !== outcome.expectedChildStatus) {
    return failClosed('unexpected child exit status for audit summary');
  }

  return outcome;
};

const runAudit = ({ spawnAudit = spawnSync, stdout = process.stdout, stderr = process.stderr } = {}) => {
  const result = spawnAudit('yarn', ['audit', '--json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const outcome = evaluateAuditResult(result);

  if (outcome.stdout) stdout.write(outcome.stdout);
  if (outcome.stderr) stderr.write(outcome.stderr);
  return outcome.exitCode;
};

if (require.main === module) {
  process.exitCode = runAudit();
}

module.exports = {
  IGNORED_MODULES,
  evaluateAuditResult,
  evaluateSuccessfulAudit,
  runAudit,
};
