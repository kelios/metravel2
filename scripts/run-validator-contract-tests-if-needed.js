const { spawnSync } = require('child_process')
const { parseSelectiveRunnerArgs } = require('./selective-runner-args')
const {
  parseChangedFiles,
  getMatchedFiles,
  getCategoryBreakdown,
  buildDecisionSummary,
  appendStepSummary,
} = require('./selective-check-utils')
const { readChangedFiles } = require('./changed-files-utils')

const VALIDATOR_CONTRACT_TESTS = [
  '__tests__/scripts/validator-json-contract.test.ts',
  '__tests__/scripts/validator-output.test.ts',
  '__tests__/scripts/validator-error-codes.test.ts',
  '__tests__/scripts/validate-pr-ci-exception.test.ts',
  '__tests__/scripts/validate-ci-incident-snippet.test.ts',
  '__tests__/scripts/validate-smoke-suite-baseline-recommendation.test.ts',
  '__tests__/scripts/guard-validator-contract-change.test.ts',
]

const RELEVANT_CATEGORIES = [
  { name: 'validator', pattern: /^scripts\/validator-/ },
  { name: 'validators', pattern: /^scripts\/validate-.*\.js$/ },
  { name: 'tests', pattern: /^__tests__\/scripts\/validator-.*\.test\.ts$/ },
  { name: 'tests', pattern: /^__tests__\/scripts\/validate-.*\.test\.ts$/ },
  { name: 'guards', pattern: /^scripts\/guard-validator-contract-change\.js$/ },
  { name: 'tests', pattern: /^__tests__\/scripts\/guard-validator-contract-change\.test\.ts$/ },
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

const buildSummaryMarkdown = ({ status, changedFiles, matchedFiles, dryRun }) => {
  const notes = []
  const breakdown = getCategoryBreakdown(changedFiles || [], RELEVANT_CATEGORIES)
  if (breakdown.length > 0) {
    notes.push(`Category matches: ${breakdown.map((item) => `${item.name}=${item.count}`).join(', ')}`)
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
  const changedFiles = readChangedFiles({ changedFilesFile: args.changedFilesFile })
  const matchedFiles = getMatchedValidatorFiles(changedFiles)

  if (matchedFiles.length === 0) {
    console.log('validator-contract-check: skipped (no relevant file changes).')
    appendStepSummary(buildSummaryMarkdown({
      status: 'skip',
      changedFiles,
      matchedFiles,
      dryRun: args.dryRun,
    }))
    return
  }

  console.log('validator-contract-check: running targeted validator contract tests.')
  appendStepSummary(buildSummaryMarkdown({
    status: 'run',
    changedFiles,
    matchedFiles,
    dryRun: args.dryRun,
  }))
  if (args.dryRun) {
    console.log(`validator-contract-check: dry-run, would run ${VALIDATOR_CONTRACT_TESTS.length} tests.`)
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
  buildSummaryMarkdown,
  appendStepSummary,
}
