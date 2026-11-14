const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SEVERITIES = Object.freeze(['info', 'low', 'moderate', 'high', 'critical']);
// #3407: high/critical блокируют релиз безусловно. Запись low/moderate проходит только
// разобранной: зависимость обновлена либо в ACCEPTED_ADVISORIES_PATH лежит исключение с
// причиной и датой пересмотра. Новая запись и просроченная дата роняют проверку, поэтому
// хвост не растёт незаметно между ручными аудитами.
const TRIAGED_SEVERITIES = Object.freeze(['low', 'moderate']);
const ACCEPTED_ADVISORIES_PATH = path.join(__dirname, 'yarn-audit-accepted.json');
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
// Date.parse принимает 2026-02-30 (переносит на 2 марта), поэтому дата сверяется круговым преобразованием.
const isCalendarDate = (value) => ISO_DATE.test(value)
  && !Number.isNaN(Date.parse(value))
  && new Date(value).toISOString().slice(0, 10) === value;
const MIN_REASON_LENGTH = 20;

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

const advisoryKey = (id, moduleName) => `${String(id).trim().toUpperCase()}|${String(moduleName).trim()}`;

const readAdvisoryId = (advisory) => {
  const ghsa = typeof advisory?.github_advisory_id === 'string' ? advisory.github_advisory_id.trim() : '';
  if (ghsa) return ghsa.toUpperCase();
  const numeric = advisory?.id;
  return Number.isInteger(numeric) || (typeof numeric === 'string' && numeric.trim()) ? `NPM:${String(numeric).trim()}` : '';
};

const parseAcceptedAdvisories = (raw) => {
  let data;
  try {
    data = JSON.parse(String(raw));
  } catch {
    return { error: 'accepted advisories file is not valid JSON' };
  }
  if (!data || !Array.isArray(data.accepted)) {
    return { error: 'accepted advisories file has no "accepted" array' };
  }

  const entries = new Map();
  for (const [index, entry] of data.accepted.entries()) {
    const id = typeof entry?.id === 'string' ? entry.id.trim() : '';
    const moduleName = typeof entry?.module === 'string' ? entry.module.trim() : '';
    const reviewBy = typeof entry?.reviewBy === 'string' ? entry.reviewBy.trim() : '';
    const reason = typeof entry?.reason === 'string' ? entry.reason.trim() : '';
    if (!id || !moduleName || !isCalendarDate(reviewBy) || reason.length < MIN_REASON_LENGTH) {
      return { error: `accepted advisory #${index + 1} needs id, module, reviewBy (YYYY-MM-DD) and a reason` };
    }
    const key = advisoryKey(id, moduleName);
    if (entries.has(key)) {
      return { error: `accepted advisory ${id} for ${moduleName} is listed twice` };
    }
    entries.set(key, { id: id.toUpperCase(), module: moduleName, reviewBy });
  }
  return { entries };
};

const loadAcceptedAdvisories = (filePath = ACCEPTED_ADVISORIES_PATH) => {
  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch {
    return { error: 'accepted advisories file is missing or unreadable' };
  }
  return parseAcceptedAdvisories(raw);
};

const todayIsoDate = () => new Date().toISOString().slice(0, 10);

const formatAdvisoryList = (items) => items
  .map((item) => `  - ${item.id} ${item.module}${item.severity ? ` (${item.severity})` : ''}${item.reviewBy ? ` review by ${item.reviewBy}` : ''}`)
  .join('\n');

const formatPolicySummary = (counts) => [
  `high/critical: ${counts.high + counts.critical}`,
  `moderate: ${counts.moderate}`,
  `low: ${counts.low}`,
].join(', ');

// Yarn v1 reports completed audits with a severity bitmask rather than a
// conventional zero status: info=1, low=2, moderate=4, high=8, critical=16.
const getExpectedAuditExitCode = (counts) => {
  return (counts.info > 0 ? 1 : 0)
    + (counts.low > 0 ? 2 : 0)
    + (counts.moderate > 0 ? 4 : 0)
    + (counts.high > 0 ? 8 : 0)
    + (counts.critical > 0 ? 16 : 0);
};

const evaluateSuccessfulAudit = (output, policy = {}) => {
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
  const triagedAdvisories = new Map();
  let hasAnonymousAdvisory = false;

  for (const record of parsed.records) {
    if (record.type !== 'auditAdvisory') continue;

    const advisory = record?.data?.advisory;
    const moduleName = typeof advisory?.module_name === 'string' ? advisory.module_name.trim() : '';
    const severity = typeof advisory?.severity === 'string' ? advisory.severity.toLowerCase() : '';
    if (!moduleName || !SEVERITIES.includes(severity)) {
      return failClosed('malformed audit advisory record');
    }

    advisoryCounts[severity] += 1;

    if (TRIAGED_SEVERITIES.includes(severity)) {
      const id = readAdvisoryId(advisory);
      if (id) {
        triagedAdvisories.set(advisoryKey(id, moduleName), { id, module: moduleName, severity });
      } else {
        hasAnonymousAdvisory = true;
      }
    }
  }

  const counts = summaryResult.counts;
  for (const severity of SEVERITIES) {
    if (advisoryCounts[severity] > counts[severity]) {
      return failClosed('audit summary/advisory mismatch');
    }
  }

  const policySummary = formatPolicySummary(counts);
  if (counts.high + counts.critical > 0) {
    return {
      exitCode: 1,
      stdout: '',
      stderr: `yarn audit: found high/critical vulnerabilities (${policySummary})\n`,
      expectedChildStatus,
    };
  }

  if (hasAnonymousAdvisory) {
    return failClosed('audit advisory without an identifier');
  }
  const accepted = policy.accepted ?? loadAcceptedAdvisories();
  if (accepted.error) {
    return failClosed(accepted.error);
  }
  const today = policy.today ?? todayIsoDate();
  const reported = [...triagedAdvisories.entries()];
  const untriaged = reported.filter(([key]) => !accepted.entries.has(key)).map(([, item]) => item);
  if (untriaged.length > 0) {
    return {
      exitCode: 1,
      stdout: '',
      stderr: `yarn audit: untriaged low/moderate advisories (${policySummary}):\n${formatAdvisoryList(untriaged)}\n`
        + 'Update the dependency or add a reasoned entry to scripts/yarn-audit-accepted.json\n',
      expectedChildStatus,
    };
  }
  const expired = reported
    .map(([key, item]) => ({ ...item, reviewBy: accepted.entries.get(key).reviewBy }))
    .filter((item) => item.reviewBy < today);
  if (expired.length > 0) {
    return {
      exitCode: 1,
      stdout: '',
      stderr: `yarn audit: accepted advisories are past their review date (${policySummary}):\n${formatAdvisoryList(expired)}\n`,
      expectedChildStatus,
    };
  }
  const stale = [...accepted.entries.entries()]
    .filter(([key]) => !triagedAdvisories.has(key))
    .map(([, item]) => ({ id: item.id, module: item.module }));

  return {
    exitCode: 0,
    stdout: `yarn audit: OK (${policySummary})\n`
      + (reported.length > 0 ? `yarn audit: accepted low/moderate advisories: ${reported.length}\n` : '')
      + (stale.length > 0 ? `yarn audit: accepted entries no longer reported, remove them:\n${formatAdvisoryList(stale)}\n` : ''),
    stderr: '',
    expectedChildStatus,
  };
};

const evaluateAuditResult = (result, policy = {}) => {
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

  const outcome = evaluateSuccessfulAudit(output, policy);
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
  evaluateAuditResult,
  evaluateSuccessfulAudit,
  loadAcceptedAdvisories,
  parseAcceptedAdvisories,
  runAudit,
};
