const fs = require('fs')
const path = require('path')
const {
  readJsonFileWithStatus,
  emitLines,
  appendLinesToStepSummary,
} = require('./summary-utils')
const {
  validateSelectiveDecision,
  validateSelectiveDecisionsAggregate,
} = require('./selective-decision-contract')

const eslintPathArg = process.argv[2] || 'test-results/eslint-results.json'
const jestPathArg = process.argv[3] || 'test-results/jest-smoke-results.json'
const strictMissing = process.argv.includes('--fail-on-missing')
const getFlagValue = (flag) => {
  const flagIndex = process.argv.indexOf(flag)
  if (flagIndex < 0) return ''
  return process.argv[flagIndex + 1] ? String(process.argv[flagIndex + 1]).trim() : ''
}
const jsonOutputPathArg = getFlagValue('--json-output')
const selectiveDecisionsFileArg = getFlagValue('--selective-decisions-file')
const schemaDecisionPathArg = getFlagValue('--schema-decision-file')
const validatorDecisionPathArg = getFlagValue('--validator-decision-file')
const validatorContractsSummaryValidationFileArg = getFlagValue('--validator-contracts-summary-validation-file')
const runtimeConfigDiagnosticsFileArg = getFlagValue('--runtime-config-diagnostics-file')
const lintJobResult = String(process.env.LINT_JOB_RESULT || '').trim().toLowerCase()
const smokeJobResult = String(process.env.SMOKE_JOB_RESULT || '').trim().toLowerCase()
const smokeDurationBudgetSeconds = Number(process.env.SMOKE_DURATION_BUDGET_SECONDS || 0)
const smokeDurationPreviousSecondsRaw = Number(process.env.SMOKE_DURATION_PREVIOUS_SECONDS || 0)
const smokeSuiteFilesBaselineRaw = String(process.env.SMOKE_SUITE_FILES_BASELINE || '').trim()
const smokeDurationBudgetStrict =
  String(process.env.SMOKE_DURATION_BUDGET_STRICT || '').trim().toLowerCase() === 'true'
const eslintPath = path.resolve(process.cwd(), eslintPathArg)
const jestPath = path.resolve(process.cwd(), jestPathArg)
const cwd = process.cwd()

const appendStepSummary = (markdown) => {
  appendLinesToStepSummary({ lines: [markdown] })
}

const print = (markdown) => {
  emitLines([markdown])
  appendStepSummary(markdown)
}

const readJson = (filePath) => {
  const result = readJsonFileWithStatus(filePath)
  return result.payload
}

const readSelectiveDecision = (rawPath, label) => {
  if (!rawPath) {
    return {
      decision: null,
      warning: '',
    }
  }

  const resolved = path.resolve(process.cwd(), rawPath)
  if (!fs.existsSync(resolved)) {
    return {
      decision: null,
      warning: `${label}: decision file not found (${rawPath}).`,
    }
  }

  const payload = readJson(resolved)
  if (!payload) {
    return {
      decision: null,
      warning: `${label}: cannot parse decision JSON (${rawPath}).`,
    }
  }

  const errors = validateSelectiveDecision(payload)
  if (errors.length > 0) {
    return {
      decision: null,
      warning: `${label}: invalid decision payload: ${errors.join(' ')}`,
    }
  }

  return {
    decision: payload,
    warning: '',
  }
}

const readSelectiveDecisionsAggregate = (rawPath) => {
  if (!rawPath) {
    return {
      decisions: [],
      warnings: [],
      aggregateIssue: false,
    }
  }

  const resolved = path.resolve(process.cwd(), rawPath)
  if (!fs.existsSync(resolved)) {
    return {
      decisions: [],
      warnings: [`selective-decisions: aggregate file not found (${rawPath}).`],
      aggregateIssue: true,
    }
  }

  const payload = readJson(resolved)
  if (!payload) {
    return {
      decisions: [],
      warnings: [`selective-decisions: cannot parse aggregate JSON (${rawPath}).`],
      aggregateIssue: true,
    }
  }

  const errors = validateSelectiveDecisionsAggregate(payload)
  if (errors.length > 0) {
    return {
      decisions: [],
      warnings: [`selective-decisions: invalid aggregate payload: ${errors.join(' ')}`],
      aggregateIssue: true,
    }
  }

  return {
    decisions: payload.decisions,
    warnings: payload.warnings,
    aggregateIssue: false,
  }
}

const readValidatorContractsSummaryValidation = (rawPath) => {
  if (!rawPath) {
    return {
      payload: null,
      warnings: [],
      issue: false,
    }
  }

  const resolved = path.resolve(process.cwd(), rawPath)
  if (!fs.existsSync(resolved)) {
    return {
      payload: null,
      warnings: [`validator-contracts-summary-validation: file not found (${rawPath}).`],
      issue: true,
    }
  }

  const payload = readJson(resolved)
  if (!payload) {
    return {
      payload: null,
      warnings: [`validator-contracts-summary-validation: cannot parse JSON (${rawPath}).`],
      issue: true,
    }
  }

  const contractVersion = Number(payload?.contractVersion)
  const ok = typeof payload?.ok === 'boolean' ? payload.ok : null
  const errorCount = Number(payload?.errorCount)
  const errorsArray = payload?.errors
  const validContract = contractVersion === 1
    && ok !== null
    && Number.isFinite(errorCount)
    && Array.isArray(errorsArray)

  if (!validContract) {
    return {
      payload,
      warnings: ['validator-contracts-summary-validation: invalid validator-output contract payload.'],
      issue: true,
    }
  }

  return {
    payload,
    warnings: [],
    issue: !ok,
  }
}

const readRuntimeConfigDiagnostics = (rawPath) => {
  if (!rawPath) {
    return {
      payload: null,
      warnings: [],
      issue: false,
    }
  }

  const resolved = path.resolve(process.cwd(), rawPath)
  if (!fs.existsSync(resolved)) {
    return {
      payload: null,
      warnings: [`runtime-config-diagnostics: file not found (${rawPath}).`],
      issue: true,
    }
  }

  const payload = readJson(resolved)
  if (!payload) {
    return {
      payload: null,
      warnings: [`runtime-config-diagnostics: cannot parse JSON (${rawPath}).`],
      issue: true,
    }
  }

  const schemaVersion = Number(payload?.schemaVersion)
  const ok = typeof payload?.ok === 'boolean' ? payload.ok : null
  const errorCount = Number(payload?.errorCount)
  const warningCount = Number(payload?.warningCount)
  const diagnostics = payload?.diagnostics
  const validContract = schemaVersion === 1
    && ok !== null
    && Number.isFinite(errorCount)
    && Number.isFinite(warningCount)
    && Array.isArray(diagnostics)

  if (!validContract) {
    return {
      payload,
      warnings: ['runtime-config-diagnostics: invalid diagnostics contract payload.'],
      issue: true,
    }
  }

  return {
    payload,
    warnings: [],
    issue: !ok,
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
const smokeSuiteFiles = Array.isArray(jest?.testResults)
  ? jest.testResults
      .map((t) => String(t?.name || '').trim())
      .filter(Boolean)
      .map((name) => (path.isAbsolute(name) ? path.relative(cwd, name) : name))
  : []
const smokeSuiteFilesPreviewLimit = 10
const smokeSuiteFilesPreview = smokeSuiteFiles.slice(0, smokeSuiteFilesPreviewLimit)
const smokeSuiteFilesRemaining = Math.max(0, smokeSuiteFiles.length - smokeSuiteFilesPreview.length)
const parseSuiteBaseline = (raw) => {
  if (!raw) return []
  const trimmed = raw.trim()
  if (!trimmed) return []

  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) {
        return parsed.map((v) => String(v).trim()).filter(Boolean)
      }
    } catch {
      // fall back to CSV parsing
    }
  }

  return trimmed
    .split(',')
    .map((v) => String(v).trim())
    .filter(Boolean)
}
const smokeSuiteFilesBaseline = parseSuiteBaseline(smokeSuiteFilesBaselineRaw)
const smokeSuiteBaselineProvided = smokeSuiteFilesBaseline.length > 0
const currentSuiteSet = new Set(smokeSuiteFiles)
const baselineSuiteSet = new Set(smokeSuiteFilesBaseline)
const smokeSuiteAddedFiles = smokeSuiteFiles.filter((f) => !baselineSuiteSet.has(f))
const smokeSuiteRemovedFiles = smokeSuiteFilesBaseline.filter((f) => !currentSuiteSet.has(f))
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

let selectiveDecisions = []
let selectiveDecisionWarnings = []
let selectiveDecisionsAggregateIssue = false
if (selectiveDecisionsFileArg) {
  const aggregate = readSelectiveDecisionsAggregate(selectiveDecisionsFileArg)
  selectiveDecisions = aggregate.decisions
  selectiveDecisionWarnings = aggregate.warnings
  selectiveDecisionsAggregateIssue = aggregate.aggregateIssue
} else {
  const selectiveDecisionReads = [
    readSelectiveDecision(schemaDecisionPathArg, 'schema-contract-checks'),
    readSelectiveDecision(validatorDecisionPathArg, 'validator-contract-checks'),
  ]
  selectiveDecisions = selectiveDecisionReads.map((item) => item.decision).filter(Boolean)
  selectiveDecisionWarnings = selectiveDecisionReads.map((item) => item.warning).filter(Boolean)
}
const validatorContractsSummaryValidation = readValidatorContractsSummaryValidation(
  validatorContractsSummaryValidationFileArg
)
const runtimeConfigDiagnostics = readRuntimeConfigDiagnostics(runtimeConfigDiagnosticsFileArg)

const overallOk = eslintOk
  && jestOk
  && inconsistencies.length === 0
  && !budgetBlocking
  && !selectiveDecisionsAggregateIssue
  && !runtimeConfigDiagnostics.issue
  && !validatorContractsSummaryValidation.issue

const getFailureClass = () => {
  if (overallOk) return 'pass'
  if (inconsistencies.length > 0) return 'inconsistent_state'
  if (eslint === null || jest === null) return 'infra_artifact'
  if (runtimeConfigDiagnostics.issue && eslintOk && jestOk && !budgetBlocking) return 'config_contract'
  if (validatorContractsSummaryValidation.issue && eslintOk && jestOk && !budgetBlocking) return 'validator_contract'
  if (selectiveDecisionsAggregateIssue && eslintOk && jestOk && !budgetBlocking) return 'selective_contract'
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
  selective_contract: 'QG-007',
  validator_contract: 'QG-008',
  config_contract: 'QG-009',
}
const recommendationQuickMap =
  'QG-001 infra_artifact | QG-002 inconsistent_state | QG-003 lint_only | QG-004 smoke_only | QG-005 mixed | QG-006 performance_budget | QG-007 selective_contract | QG-008 validator_contract | QG-009 config_contract'
const recommendationAnchorByClass = {
  infra_artifact: 'qg-001',
  inconsistent_state: 'qg-002',
  lint_only: 'qg-003',
  smoke_only: 'qg-004',
  mixed: 'qg-005',
  performance_budget: 'qg-006',
  selective_contract: 'qg-007',
  validator_contract: 'qg-008',
  config_contract: 'qg-009',
}
const recommendationId = recommendationByClass[failureClass] || 'QG-000'
const recommendationAnchor = recommendationAnchorByClass[failureClass] || 'troubleshooting-by-failure-class'
const qualitySchemaVersion = 1

const qualitySnapshot = {
  schemaVersion: qualitySchemaVersion,
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
  smokeSuiteFiles,
  smokeSuiteBaselineProvided,
  smokeSuiteAddedFiles,
  smokeSuiteRemovedFiles,
  selectiveDecisions,
  selectiveDecisionWarnings,
  selectiveDecisionsAggregateIssue,
  runtimeConfigDiagnosticsOk: runtimeConfigDiagnostics.payload?.ok ?? null,
  runtimeConfigDiagnosticsWarnings: runtimeConfigDiagnostics.warnings,
  runtimeConfigDiagnosticsIssue: runtimeConfigDiagnostics.issue,
  validatorContractsSummaryValidationOk: validatorContractsSummaryValidation.payload?.ok ?? null,
  validatorContractsSummaryValidationWarnings: validatorContractsSummaryValidation.warnings,
  validatorContractsSummaryValidationIssue: validatorContractsSummaryValidation.issue,
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

print('')
print('### Smoke Composition')
print(`- Suites in critical run: ${jestSuites}`)
print(`- Tests in critical run: ${jestTests}`)
if (smokeSuiteFilesPreview.length > 0) {
  print('- Suite files:')
  smokeSuiteFilesPreview.forEach((suite) => print(`  - \`${suite}\``))
  if (smokeSuiteFilesRemaining > 0) {
    print(`  - ... and ${smokeSuiteFilesRemaining} more`)
  }
}
if (smokeSuiteBaselineProvided) {
  print(`- Suite drift vs baseline: +${smokeSuiteAddedFiles.length} / -${smokeSuiteRemovedFiles.length}`)
  const previewLimit = 5
  if (smokeSuiteAddedFiles.length > 0) {
    print('- Added suite files:')
    smokeSuiteAddedFiles.slice(0, previewLimit).forEach((f) => print(`  - \`${f}\``))
    if (smokeSuiteAddedFiles.length > previewLimit) {
      print(`  - ... and ${smokeSuiteAddedFiles.length - previewLimit} more`)
    }
  }
  if (smokeSuiteRemovedFiles.length > 0) {
    print('- Removed suite files:')
    smokeSuiteRemovedFiles.slice(0, previewLimit).forEach((f) => print(`  - \`${f}\``))
    if (smokeSuiteRemovedFiles.length > previewLimit) {
      print(`  - ... and ${smokeSuiteRemovedFiles.length - previewLimit} more`)
    }
  }
}

print('')
print('### Selective Checks')
if (selectiveDecisions.length === 0) {
  print('- No selective decision artifacts provided.')
} else {
  selectiveDecisions.forEach((decision) => {
    print(
      `- ${decision.check}: ${decision.decision} (reason: ${decision.reason}, matches: ${decision.relevantMatches}, scanned: ${decision.changedFilesScanned}, targeted tests: ${decision.targetedTests})`
    )
  })
}
if (selectiveDecisionWarnings.length > 0) {
  print('- Decision artifact warnings:')
  selectiveDecisionWarnings.forEach((warning) => print(`  - ${warning}`))
}

if (validatorContractsSummaryValidationFileArg) {
  print('')
  print('### Validator Contracts')
  if (!validatorContractsSummaryValidation.payload) {
    print('- Validator contracts summary validation: unavailable')
  } else {
    const status = validatorContractsSummaryValidation.payload.ok ? 'pass' : 'fail'
    const errorCount = Number(validatorContractsSummaryValidation.payload.errorCount || 0)
    print(`- Validator contracts summary validation: ${status} (errors: ${errorCount})`)
  }
  if (validatorContractsSummaryValidation.warnings.length > 0) {
    print('- Validator contracts warnings:')
    validatorContractsSummaryValidation.warnings.forEach((warning) => print(`  - ${warning}`))
  }
}

if (runtimeConfigDiagnosticsFileArg) {
  print('')
  print('### Runtime Config Diagnostics')
  if (!runtimeConfigDiagnostics.payload) {
    print('- Runtime config diagnostics: unavailable')
  } else {
    const status = runtimeConfigDiagnostics.payload.ok ? 'pass' : 'fail'
    const errorCount = Number(runtimeConfigDiagnostics.payload.errorCount || 0)
    const warningCount = Number(runtimeConfigDiagnostics.payload.warningCount || 0)
    print(`- Runtime config diagnostics: ${status} (errors: ${errorCount}, warnings: ${warningCount})`)
  }
  if (runtimeConfigDiagnostics.warnings.length > 0) {
    print('- Runtime config diagnostics warnings:')
    runtimeConfigDiagnostics.warnings.forEach((warning) => print(`  - ${warning}`))
  }
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
  if (selectiveDecisionsAggregateIssue) {
    print('- Fix selective decisions aggregate contract and re-run quality summary.')
  }
  if (runtimeConfigDiagnostics.issue) {
    print('- Fix runtime config diagnostics contract/issues and re-run quality summary.')
  }
  if (validatorContractsSummaryValidation.issue) {
    print('- Fix validator contracts summary validation issues and re-run quality summary.')
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
  if (!hasReproCommands && selectiveDecisionsAggregateIssue) {
    print('- `node scripts/collect-selective-decisions.js --schema-file test-results/selective/schema/schema-selective-decision.json --validator-file test-results/selective/validator/validator-selective-decision.json --output-file test-results/selective-decisions.json`')
    print('- `node scripts/validate-selective-decisions.js --file test-results/selective-decisions.json`')
  }
  if (!hasReproCommands && runtimeConfigDiagnostics.issue) {
    print('- `yarn config:diagnostics:json`')
    print('- `yarn config:diagnostics:strict`')
  }
  if (!hasReproCommands && validatorContractsSummaryValidation.issue) {
    print('- `yarn validator:contracts:summary`')
    print('- `yarn validator:contracts:summary:validate`')
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
