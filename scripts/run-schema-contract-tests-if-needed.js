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

const SCHEMA_CONTRACT_TESTS = [
  '__tests__/scripts/summarize-quality-gate.test.ts',
  '__tests__/scripts/validate-quality-summary.test.ts',
  '__tests__/scripts/selective-decision-contract.test.ts',
  '__tests__/scripts/validate-selective-decision.test.ts',
  '__tests__/scripts/guard-quality-schema-change.test.ts',
]

const RELEVANT_CATEGORIES = [
  { name: 'schema', pattern: /^scripts\/summarize-quality-gate\.js$/ },
  { name: 'schema', pattern: /^scripts\/validate-quality-summary\.js$/ },
  { name: 'schema', pattern: /^scripts\/selective-decision-contract\.js$/ },
  { name: 'schema', pattern: /^scripts\/validate-selective-decision\.js$/ },
  { name: 'guards', pattern: /^scripts\/guard-quality-schema-change\.js$/ },
  { name: 'tests', pattern: /^__tests__\/scripts\/summarize-quality-gate\.test\.ts$/ },
  { name: 'tests', pattern: /^__tests__\/scripts\/validate-quality-summary\.test\.ts$/ },
  { name: 'tests', pattern: /^__tests__\/scripts\/selective-decision-contract\.test\.ts$/ },
  { name: 'tests', pattern: /^__tests__\/scripts\/validate-selective-decision\.test\.ts$/ },
  { name: 'tests', pattern: /^__tests__\/scripts\/guard-quality-schema-change\.test\.ts$/ },
  { name: 'docs', pattern: /^docs\/TESTING\.md$/ },
  { name: 'workflow', pattern: /^\.github\/workflows\/ci-smoke\.yml$/ },
]
const RELEVANT_PATTERNS = RELEVANT_CATEGORIES.map((c) => c.pattern)

const parseArgs = (argv) => parseSelectiveRunnerArgs(argv)

const getMatchedSchemaFiles = (changedFiles) => getMatchedFiles(changedFiles, RELEVANT_PATTERNS)

const shouldRunForChangedFiles = (changedFiles) => {
  return getMatchedSchemaFiles(changedFiles).length > 0
}

const runSchemaContractTests = () => {
  const result = spawnSync(
    'yarn',
    ['jest', '--runInBand', ...SCHEMA_CONTRACT_TESTS],
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
    notes.push(`Targeted tests: ${SCHEMA_CONTRACT_TESTS.length}`)
    if (dryRun) notes.push('Mode: dry-run')
  }
  return buildDecisionSummary({
    title: 'Schema Contract Checks',
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
    console.error('schema-contract-check: --json is supported only with --dry-run.')
    process.exit(2)
  }
  const changedFilesMeta = readChangedFilesWithMeta({ changedFilesFile: args.changedFilesFile })
  const changedFiles = changedFilesMeta.files
  const matchedFiles = getMatchedSchemaFiles(changedFiles)
  const execution = decideExecutionFromMatches({
    matchedFiles,
    inputAvailable: changedFilesMeta.available,
  })

  if (!execution.shouldRun) {
    log('schema-contract-check: skipped (no relevant file changes).')
    appendStepSummary(buildSummaryMarkdown({
      status: 'skip',
      changedFiles,
      matchedFiles,
      dryRun: args.dryRun,
      executionReason: execution.reason,
    }))
    if (args.output === 'json') {
      emitSelectiveDecision(buildSelectiveDecision({
        check: 'schema-contract-checks',
        decision: 'skip',
        reason: execution.reason,
        changedFiles,
        matchedFiles,
        dryRun: args.dryRun,
        targetedTests: SCHEMA_CONTRACT_TESTS.length,
      }))
    }
    return
  }

  if (execution.reason === 'missing-input') {
    log('schema-contract-check: changed-files input unavailable; forcing targeted schema contract tests.')
  } else {
    log('schema-contract-check: running targeted schema contract tests.')
  }
  appendStepSummary(buildSummaryMarkdown({
    status: 'run',
    changedFiles,
    matchedFiles,
    dryRun: args.dryRun,
    executionReason: execution.reason,
  }))
  if (args.dryRun) {
    log(`schema-contract-check: dry-run, would run ${SCHEMA_CONTRACT_TESTS.length} tests.`)
    if (args.output === 'json') {
      emitSelectiveDecision(buildSelectiveDecision({
        check: 'schema-contract-checks',
        decision: 'run',
        reason: execution.reason,
        changedFiles,
        matchedFiles,
        dryRun: args.dryRun,
        targetedTests: SCHEMA_CONTRACT_TESTS.length,
      }))
    }
    return
  }

  const status = runSchemaContractTests()
  if (status !== 0) {
    process.exit(status)
  }
}

if (require.main === module) {
  main()
}

module.exports = {
  SCHEMA_CONTRACT_TESTS,
  RELEVANT_PATTERNS,
  parseArgs,
  parseChangedFiles,
  getMatchedFiles: getMatchedSchemaFiles,
  shouldRunForChangedFiles,
  readChangedFiles,
  readChangedFilesWithMeta,
  decideExecutionFromMatches,
  buildSelectiveDecision,
  buildSummaryMarkdown,
}
