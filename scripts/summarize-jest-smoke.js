const fs = require('fs')
const path = require('path')

const inputPath = process.argv[2] || 'jest-smoke-results.json'
const resolvedPath = path.resolve(process.cwd(), inputPath)

const appendStepSummary = (markdown) => {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY
  if (!summaryPath) return
  fs.appendFileSync(summaryPath, `${markdown}\n`)
}

const print = (markdown) => {
  process.stdout.write(`${markdown}\n`)
  appendStepSummary(markdown)
}

if (!fs.existsSync(resolvedPath)) {
  print('## CI Smoke Summary')
  print('')
  print(`- Result file not found: \`${inputPath}\``)
  process.exit(0)
}

let payload
try {
  payload = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'))
} catch (error) {
  print('## CI Smoke Summary')
  print('')
  print(`- Failed to parse \`${inputPath}\`: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(0)
}

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

print('## CI Smoke Summary')
print('')
print(`- Suites: ${passedSuites}/${totalSuites} passed (${failedSuites} failed)`)
print(`- Tests: ${passedTests}/${totalTests} passed (${failedTests} failed)`)
print(`- Duration: ${durationSec}s`)

if (failedFiles.length > 0) {
  print('- Failed suites:')
  failedFiles.forEach((file) => print(`  - \`${file}\``))
}
