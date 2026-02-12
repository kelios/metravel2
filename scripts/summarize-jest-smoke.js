const {
  readJsonFileWithStatus,
  emitLines,
  appendLinesToStepSummary,
} = require('./summary-utils')

const inputPath = process.argv[2] || 'jest-smoke-results.json'
const printLines = (lines) => {
  emitLines(lines)
  appendLinesToStepSummary({ lines })
}

const smokeResults = readJsonFileWithStatus(inputPath)

if (smokeResults.missing) {
  printLines([
    '## CI Smoke Summary',
    '',
    `- Result file not found: \`${inputPath}\``,
  ])
  process.exit(0)
}

if (smokeResults.parseError) {
  printLines([
    '## CI Smoke Summary',
    '',
    `- Failed to parse \`${inputPath}\`: ${smokeResults.parseError}`,
  ])
  process.exit(0)
}

const payload = smokeResults.payload
const totalSuites = Number(payload?.numTotalTestSuites ?? 0)
const passedSuites = Number(payload?.numPassedTestSuites ?? 0)
const failedSuites = Number(payload?.numFailedTestSuites ?? 0)
const totalTests = Number(payload?.numTotalTests ?? 0)
const passedTests = Number(payload?.numPassedTests ?? 0)
const failedTests = Number(payload?.numFailedTests ?? 0)
const durationMs = Array.isArray(payload?.testResults)
  ? payload.testResults.reduce((sum, t) => sum + Number(t?.endTime ?? 0) - Number(t?.startTime ?? 0), 0)
  : 0
const durationSec = Number.isFinite(durationMs) && durationMs > 0 ? (durationMs / 1000).toFixed(2) : '0.00'

const failedFiles = Array.isArray(payload?.testResults)
  ? payload.testResults
      .filter((suite) => suite?.status === 'failed')
      .map((suite) => String(suite?.name || '').replace(`${process.cwd()}/`, ''))
      .filter(Boolean)
  : []

const lines = [
  '## CI Smoke Summary',
  '',
  `- Suites: ${passedSuites}/${totalSuites} passed (${failedSuites} failed)`,
  `- Tests: ${passedTests}/${totalTests} passed (${failedTests} failed)`,
  `- Duration: ${durationSec}s`,
]

if (failedFiles.length > 0) {
  lines.push('- Failed suites:')
  failedFiles.forEach((file) => lines.push(`  - \`${file}\``))
}

printLines(lines)
