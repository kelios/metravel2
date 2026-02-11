const fs = require('fs')
const path = require('path')

const eslintPathArg = process.argv[2] || 'test-results/eslint-results.json'
const jestPathArg = process.argv[3] || 'test-results/jest-smoke-results.json'
const strictMissing = process.argv.includes('--fail-on-missing')
const jsonOutputFlagIndex = process.argv.indexOf('--json-output')
const jsonOutputPathArg =
  jsonOutputFlagIndex >= 0 && process.argv[jsonOutputFlagIndex + 1]
    ? process.argv[jsonOutputFlagIndex + 1]
    : ''
const lintJobResult = String(process.env.LINT_JOB_RESULT || '').trim().toLowerCase()
const smokeJobResult = String(process.env.SMOKE_JOB_RESULT || '').trim().toLowerCase()
const smokeDurationBudgetSeconds = Number(process.env.SMOKE_DURATION_BUDGET_SECONDS || 0)
const smokeDurationPreviousSecondsRaw = Number(process.env.SMOKE_DURATION_PREVIOUS_SECONDS || 0)
const smokeDurationBudgetStrict =
  String(process.env.SMOKE_DURATION_BUDGET_STRICT || '').trim().toLowerCase() === 'true'
const eslintPath = path.resolve(process.cwd(), eslintPathArg)
const jestPath = path.resolve(process.cwd(), jestPathArg)

const appendStepSummary = (markdown) => {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY
  if (!summaryPath) return
  fs.appendFileSync(summaryPath, `${markdown}\n`)
}

const print = (markdown) => {
  process.stdout.write(`${markdown}\n`)
  appendStepSummary(markdown)
}

const readJson = (filePath) => {
  if (!fs.existsSync(filePath)) return null
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch {
    return null
  }
}

const eslint = readJson(eslintPath)
const jest = readJson(jestPath)

const eslintFiles = Array.isArray(eslint) ? eslint : []
const eslintErrors = eslintFiles.reduce((sum, f) => sum + Number(f?.errorCount ?? 0), 0)
const eslintWarnings = eslintFiles.reduce((sum, f) => sum + Number(f?.warningCount ?? 0), 0)
const eslintOk = eslint !== null && eslintErrors === 0 && eslintWarnings === 0

const jestSuites = Number(jest?.numTotalTestSuites ?? 0)
const jestSuitesFailed = Number(jest?.numFailedTestSuites ?? 0)
const jestTests = Number(jest?.numTotalTests ?? 0)
const jestTestsFailed = Number(jest?.numFailedTests ?? 0)
const jestOk = jest !== null && jestSuitesFailed === 0 && jestTestsFailed === 0
const smokeDurationMs = Array.isArray(jest?.testResults)
  ? jest.testResults.reduce((sum, t) => sum + (Number(t?.endTime ?? 0) - Number(t?.startTime ?? 0)), 0)
  : 0
const smokeDurationSeconds = smokeDurationMs > 0 ? Number((smokeDurationMs / 1000).toFixed(2)) : 0
const hasSmokeDurationPrevious =
  Number.isFinite(smokeDurationPreviousSecondsRaw) && smokeDurationPreviousSecondsRaw > 0
const smokeDurationPreviousSeconds = hasSmokeDurationPrevious ? smokeDurationPreviousSecondsRaw : 0
const smokeDurationDeltaSeconds = hasSmokeDurationPrevious
  ? Number((smokeDurationSeconds - smokeDurationPreviousSeconds).toFixed(2))
  : 0
const smokeDurationDeltaPercent = hasSmokeDurationPrevious && smokeDurationPreviousSeconds > 0
  ? Number((((smokeDurationSeconds - smokeDurationPreviousSeconds) / smokeDurationPreviousSeconds) * 100).toFixed(2))
  : 0
const smokeDurationOverBudget =
  smokeDurationBudgetSeconds > 0 &&
  smokeDurationSeconds > smokeDurationBudgetSeconds
const budgetBlocking = smokeDurationBudgetStrict && smokeDurationOverBudget

const inconsistencies = []

if (lintJobResult === 'failure' && eslint !== null && eslintOk) {
  inconsistencies.push('Lint job failed but ESLint report has 0 errors and 0 warnings.')
}
if (lintJobResult === 'success' && !eslintOk) {
  inconsistencies.push('Lint job succeeded but ESLint report indicates issues or is missing.')
}

if (smokeJobResult === 'failure' && jest !== null && jestOk) {
  inconsistencies.push('Smoke job failed but Jest report has 0 failed suites/tests.')
}
if (smokeJobResult === 'success' && !jestOk) {
  inconsistencies.push('Smoke job succeeded but Jest report indicates failures or is missing.')
}

const overallOk = eslintOk && jestOk && inconsistencies.length === 0 && !budgetBlocking

const getFailureClass = () => {
  if (overallOk) return 'pass'
  if (inconsistencies.length > 0) return 'inconsistent_state'
  if (eslint === null || jest === null) return 'infra_artifact'
  if (budgetBlocking && eslintOk && jestOk) return 'performance_budget'
  if (!eslintOk && jestOk) return 'lint_only'
  if (eslintOk && !jestOk) return 'smoke_only'
  return 'mixed'
}

const failureClass = getFailureClass()
const recommendationByClass = {
  infra_artifact: 'QG-001',
  inconsistent_state: 'QG-002',
  lint_only: 'QG-003',
  smoke_only: 'QG-004',
  mixed: 'QG-005',
  performance_budget: 'QG-006',
}
const recommendationQuickMap =
  'QG-001 infra_artifact | QG-002 inconsistent_state | QG-003 lint_only | QG-004 smoke_only | QG-005 mixed | QG-006 performance_budget'
const recommendationAnchorByClass = {
  infra_artifact: 'qg-001',
  inconsistent_state: 'qg-002',
  lint_only: 'qg-003',
  smoke_only: 'qg-004',
  mixed: 'qg-005',
  performance_budget: 'qg-006',
}
const recommendationId = recommendationByClass[failureClass] || 'QG-000'
const recommendationAnchor = recommendationAnchorByClass[failureClass] || 'troubleshooting-by-failure-class'

const qualitySnapshot = {
  overallOk,
  failureClass,
  recommendationId: overallOk ? null : recommendationId,
  lintOk: eslintOk,
  smokeOk: jestOk,
  lintJobResult: lintJobResult || 'unknown',
  smokeJobResult: smokeJobResult || 'unknown',
  smokeDurationSeconds,
  smokeDurationBudgetSeconds,
  smokeDurationOverBudget,
  budgetBlocking,
  inconsistencies,
}

print('## Quality Gate Summary')
print('')
print(`- Overall Quality Gate: ${overallOk ? 'PASS' : 'FAIL'}`)
if (!overallOk) {
  print(`- Failure Class: ${failureClass}`)
  print(`- Recommendation ID: ${recommendationId}`)
  print(`- See: docs/TESTING.md#${recommendationAnchor} (${recommendationId})`)
  print(`- QG quick map: ${recommendationQuickMap}`)
}

if (jsonOutputPathArg) {
  const outputPath = path.resolve(process.cwd(), jsonOutputPathArg)
  const outputDir = path.dirname(outputPath)
  try {
    fs.mkdirSync(outputDir, { recursive: true })
    fs.writeFileSync(outputPath, JSON.stringify(qualitySnapshot, null, 2), 'utf8')
  } catch (error) {
    print(`- Warning: failed to write quality snapshot to ${jsonOutputPathArg}: ${String(error)}`)
  }
}
print(`- Lint: ${eslintOk ? 'PASS' : 'FAIL'}${eslint === null ? ' (report missing)' : ''}`)
print(`- Smoke tests: ${jestOk ? 'PASS' : 'FAIL'}${jest === null ? ' (report missing)' : ''}`)
if (lintJobResult || smokeJobResult) {
  print(`- Upstream job results: lint=${lintJobResult || 'unknown'}, smoke=${smokeJobResult || 'unknown'}`)
}
print('')
print('### Details')
print(`- ESLint files checked: ${eslintFiles.length}`)
print(`- ESLint errors: ${eslintErrors}`)
print(`- ESLint warnings: ${eslintWarnings}`)
print(`- Jest suites: ${jestSuites} total, ${jestSuitesFailed} failed`)
print(`- Jest tests: ${jestTests} total, ${jestTestsFailed} failed`)
if (smokeDurationBudgetSeconds > 0) {
  print(`- Smoke duration: ${smokeDurationSeconds}s (budget: ${smokeDurationBudgetSeconds}s)${smokeDurationOverBudget ? ' [OVER BUDGET]' : ''}`)
}
if (hasSmokeDurationPrevious) {
  const sign = smokeDurationDeltaSeconds > 0 ? '+' : ''
  const trend = smokeDurationDeltaSeconds > 0 ? 'slower' : (smokeDurationDeltaSeconds < 0 ? 'faster' : 'unchanged')
  print(`- Smoke trend: ${sign}${smokeDurationDeltaSeconds}s (${sign}${smokeDurationDeltaPercent}%) vs previous ${smokeDurationPreviousSeconds}s [${trend}]`)
}

if (inconsistencies.length > 0) {
  print('')
  print('### Consistency Checks')
  inconsistencies.forEach((item) => print(`- ${item}`))
}

if (smokeDurationOverBudget) {
  print('')
  print('### Performance Budget')
  print(`- Smoke duration exceeded budget (${smokeDurationSeconds}s > ${smokeDurationBudgetSeconds}s).`)
  if (smokeDurationBudgetStrict) {
    print('- Strict budget mode is enabled: this is treated as a blocking quality gate failure.')
  } else {
    print('- Consider trimming test scope or parallelizing CI jobs.')
  }
}

if (!overallOk) {
  print('')
  print('### Action Required')
  if (inconsistencies.length > 0) {
    print('- Inspect upstream job logs for infra/step failures and verify artifact publication matches job outcome.')
  }
  if (eslint === null) {
    print('- Re-run lint job and verify `eslint-results` artifact upload.')
  } else if (!eslintOk) {
    print('- Fix lint violations and re-run `yarn lint:ci`.')
  }

  if (jest === null) {
    print('- Re-run smoke job and verify `jest-smoke-results` artifact upload.')
  } else if (!jestOk) {
    print('- Investigate failing smoke tests and re-run `yarn test:smoke:critical`.')
  }
  if (budgetBlocking) {
    print('- Reduce smoke runtime or raise budget threshold if justified for the current suite size.')
  }

  print('')
  print('### How to Reproduce Locally')
  let hasReproCommands = false
  if (eslint === null || !eslintOk) {
    hasReproCommands = true
    print('- `yarn lint:ci`')
    print('- `node scripts/summarize-eslint.js test-results/eslint-results.json`')
  }
  if (jest === null || !jestOk) {
    hasReproCommands = true
    print('- `yarn test:smoke:critical:ci`')
    print('- `node scripts/summarize-jest-smoke.js test-results/jest-smoke-results.json`')
  }
  if (!hasReproCommands && inconsistencies.length > 0) {
    print('- `yarn lint:ci`')
    print('- `yarn test:smoke:critical:ci`')
    print('- Re-check CI artifact upload/download steps for both jobs.')
  }
  if (!hasReproCommands && budgetBlocking) {
    print('- `SMOKE_DURATION_BUDGET_SECONDS=10 SMOKE_DURATION_BUDGET_STRICT=true node scripts/summarize-quality-gate.js test-results/eslint-results.json test-results/jest-smoke-results.json --fail-on-missing`')
  }
}

if (strictMissing && (eslint === null || jest === null)) {
  print('')
  print('- Quality summary failed: required report artifact is missing.')
  process.exit(1)
}

if (strictMissing && inconsistencies.length > 0) {
  print('')
  print('- Quality summary failed: inconsistent state between job results and published reports.')
  process.exit(1)
}

if (budgetBlocking) {
  print('')
  print('- Quality summary failed: smoke duration budget exceeded in strict mode.')
  process.exit(1)
}
