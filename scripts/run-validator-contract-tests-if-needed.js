const { spawnSync } = require('child_process')
const { parseSelectiveRunnerArgs } = require('./selective-runner-args')
const {
  parseChangedFiles,
  getMatchedFiles,
  getCategoryBreakdown,
  decideExecutionFromMatches,
  buildDecisionSummary,
  appendStepSummary,
} = require('./selective-check-utils')
const { readChangedFiles, readChangedFilesWithMeta } = require('./changed-files-utils')
const { buildSelectiveDecision, emitSelectiveDecision } = require('./selective-runner-output')

const VALIDATOR_CONTRACT_TESTS = [
  '__tests__/scripts/validator-json-contract.test.ts',
  '__tests__/scripts/validator-error-codes-centralization.test.ts',
  '__tests__/scripts/validator-error-codes-prefix-policy.test.ts',
  '__tests__/scripts/validator-error-codes-uniqueness.test.ts',
  '__tests__/scripts/summarize-quality-gate.test.ts',
  '__tests__/scripts/summary-utils.test.ts',
  '__tests__/scripts/validation-rules.test.ts',
  '__tests__/scripts/summarize-eslint.test.ts',
  '__tests__/scripts/summarize-jest-smoke.test.ts',
  '__tests__/scripts/summarize-validator-guard.test.ts',
  '__tests__/scripts/summarize-validator-guard-comment-validation.test.ts',
  '__tests__/scripts/summarize-validator-error-codes-doc-table.test.ts',
  '__tests__/scripts/summarize-validator-error-codes-doc-table-validation.test.ts',
  '__tests__/scripts/validator-guard-comment-validation-pipeline.test.ts',
  '__tests__/scripts/render-validator-guard-comment.test.ts',
  '__tests__/scripts/validator-guard-comment-template.test.ts',
  '__tests__/scripts/validator-guard-comment-pipeline.test.ts',
  '__tests__/scripts/validator-output.test.ts',
  '__tests__/scripts/validator-error-codes.test.ts',
  '__tests__/scripts/validate-pr-ci-exception.test.ts',
  '__tests__/scripts/validate-validator-guard-comment.test.ts',
  '__tests__/scripts/validate-validator-error-codes-doc-table.test.ts',
  '__tests__/scripts/update-validator-error-codes-doc-table.test.ts',
  '__tests__/scripts/validate-ci-incident-snippet.test.ts',
  '__tests__/scripts/validate-ci-incident-payload.test.ts',
  '__tests__/scripts/summarize-ci-incident-payload-validation.test.ts',
  '__tests__/scripts/validate-smoke-suite-baseline-recommendation.test.ts',
  '__tests__/scripts/guard-validator-contract-json.test.ts',
  '__tests__/scripts/guard-validator-contract-change.test.ts',
]

const RELEVANT_CATEGORIES = [
  { name: 'validator', pattern: /^scripts\/validator-/ },
  { name: 'validators', pattern: /^scripts\/validate-.*\.js$/ },
  { name: 'summaries', pattern: /^scripts\/summarize-.*\.js$/ },
  { name: 'summaries', pattern: /^scripts\/render-validator-guard-comment\.js$/ },
  { name: 'shared', pattern: /^scripts\/summary-utils\.js$/ },
  { name: 'shared', pattern: /^scripts\/validation-rules\.js$/ },
  { name: 'shared', pattern: /^scripts\/update-validator-error-codes-doc-table\.js$/ },
  { name: 'tests', pattern: /^__tests__\/scripts\/validator-.*\.test\.ts$/ },
  { name: 'tests', pattern: /^__tests__\/scripts\/validate-.*\.test\.ts$/ },
  { name: 'tests', pattern: /^__tests__\/scripts\/summarize-.*\.test\.ts$/ },
  { name: 'tests', pattern: /^__tests__\/scripts\/render-validator-guard-comment\.test\.ts$/ },
  { name: 'tests', pattern: /^__tests__\/scripts\/summary-utils\.test\.ts$/ },
  { name: 'tests', pattern: /^__tests__\/scripts\/validation-rules\.test\.ts$/ },
  { name: 'tests', pattern: /^__tests__\/scripts\/update-.*\.test\.ts$/ },
  { name: 'guards', pattern: /^scripts\/guard-validator-contract-change\.js$/ },
  { name: 'tests', pattern: /^__tests__\/scripts\/guard-validator-contract-.*\.test\.ts$/ },
  { name: 'shared', pattern: /^scripts\/validation-utils\.js$/ },
  { name: 'docs', pattern: /^docs\/TESTING\.md$/ },
  { name: 'workflow', pattern: /^\.github\/workflows\/ci-smoke\.yml$/ },
]
const RELEVANT_PATTERNS = RELEVANT_CATEGORIES.map((c) => c.pattern)

const parseArgs = (argv) => parseSelectiveRunnerArgs(argv)

const getMatchedValidatorFiles = (changedFiles) => getMatchedFiles(changedFiles, RELEVANT_PATTERNS)

const shouldRunForChangedFiles = (changedFiles) => {
  return getMatchedValidatorFiles(changedFiles).length > 0
}

const runValidatorContractTests = () => {
  const result = spawnSync(
    'yarn',
    ['jest', '--runInBand', ...VALIDATOR_CONTRACT_TESTS],
    { stdio: 'inherit' },
  )
  return result.status ?? 1
}

const buildSummaryMarkdown = ({ status, changedFiles, matchedFiles, dryRun, executionReason }) => {
  const notes = []
  const breakdown = getCategoryBreakdown(changedFiles || [], RELEVANT_CATEGORIES)
  if (breakdown.length > 0) {
    notes.push(`Category matches: ${breakdown.map((item) => `${item.name}=${item.count}`).join(', ')}`)
  }
  if (executionReason === 'missing-input') {
    notes.push('Fail-safe: changed-files input unavailable; forcing run to avoid false skip.')
  }
  if (status === 'run') {
    notes.push(`Targeted tests: ${VALIDATOR_CONTRACT_TESTS.length}`)
    if (dryRun) notes.push('Mode: dry-run')
  }
  return buildDecisionSummary({
    title: 'Validator Contract Checks',
    decision: status,
    changedFiles: changedFiles || [],
    matchedFiles: matchedFiles || [],
    notes,
  })
}

const main = () => {
  const args = parseArgs(process.argv.slice(2))
  const log = args.output === 'json' ? console.error : console.log
  if (args.output === 'json' && !args.dryRun) {
    console.error('validator-contract-check: --json is supported only with --dry-run.')
    process.exit(2)
  }
  const changedFilesMeta = readChangedFilesWithMeta({ changedFilesFile: args.changedFilesFile })
  const changedFiles = changedFilesMeta.files
  const matchedFiles = getMatchedValidatorFiles(changedFiles)
  const execution = decideExecutionFromMatches({
    matchedFiles,
    inputAvailable: changedFilesMeta.available,
  })

  if (!execution.shouldRun) {
    log('validator-contract-check: skipped (no relevant file changes).')
    appendStepSummary(buildSummaryMarkdown({
      status: 'skip',
      changedFiles,
      matchedFiles,
      dryRun: args.dryRun,
      executionReason: execution.reason,
    }))
    if (args.output === 'json') {
      emitSelectiveDecision(buildSelectiveDecision({
        check: 'validator-contract-checks',
        decision: 'skip',
        reason: execution.reason,
        changedFiles,
        matchedFiles,
        dryRun: args.dryRun,
        targetedTests: VALIDATOR_CONTRACT_TESTS.length,
      }))
    }
    return
  }

  if (execution.reason === 'missing-input') {
    log('validator-contract-check: changed-files input unavailable; forcing targeted validator contract tests.')
  } else {
    log('validator-contract-check: running targeted validator contract tests.')
  }
  appendStepSummary(buildSummaryMarkdown({
    status: 'run',
    changedFiles,
    matchedFiles,
    dryRun: args.dryRun,
    executionReason: execution.reason,
  }))
  if (args.dryRun) {
    log(`validator-contract-check: dry-run, would run ${VALIDATOR_CONTRACT_TESTS.length} tests.`)
    if (args.output === 'json') {
      emitSelectiveDecision(buildSelectiveDecision({
        check: 'validator-contract-checks',
        decision: 'run',
        reason: execution.reason,
        changedFiles,
        matchedFiles,
        dryRun: args.dryRun,
        targetedTests: VALIDATOR_CONTRACT_TESTS.length,
      }))
    }
    return
  }

  const status = runValidatorContractTests()
  if (status !== 0) {
    process.exit(status)
  }
}

if (require.main === module) {
  main()
}

module.exports = {
  VALIDATOR_CONTRACT_TESTS,
  RELEVANT_PATTERNS,
  parseArgs,
  parseChangedFiles,
  getMatchedFiles: getMatchedValidatorFiles,
  shouldRunForChangedFiles,
  readChangedFiles,
  readChangedFilesWithMeta,
  decideExecutionFromMatches,
  buildSelectiveDecision,
  buildSummaryMarkdown,
  appendStepSummary,
}
