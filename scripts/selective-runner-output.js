const SELECTIVE_RUNNER_CONTRACT_VERSION = 1

const buildSelectiveDecision = ({
  check = '',
  decision = 'skip',
  reason = 'no-match',
  changedFiles = [],
  matchedFiles = [],
  dryRun = false,
  targetedTests = 0,
}) => {
  const safeChangedFiles = Array.isArray(changedFiles) ? changedFiles : []
  const safeMatchedFiles = Array.isArray(matchedFiles) ? matchedFiles : []
  const normalizedDecision = decision === 'run' ? 'run' : 'skip'

  return {
    contractVersion: SELECTIVE_RUNNER_CONTRACT_VERSION,
    check: String(check || ''),
    decision: normalizedDecision,
    shouldRun: normalizedDecision === 'run',
    reason: String(reason || 'no-match'),
    changedFilesScanned: safeChangedFiles.length,
    relevantMatches: safeMatchedFiles.length,
    matchedFiles: safeMatchedFiles,
    dryRun: Boolean(dryRun),
    targetedTests: Number(targetedTests) || 0,
  }
}

const emitSelectiveDecision = (payload) => {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`)
}

module.exports = {
  SELECTIVE_RUNNER_CONTRACT_VERSION,
  buildSelectiveDecision,
  emitSelectiveDecision,
}
