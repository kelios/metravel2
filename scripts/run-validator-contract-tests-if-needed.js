const fs = require('fs')
const { spawnSync } = require('child_process')
const {
  parseChangedFiles,
  getMatchedFiles,
  buildDecisionSummary,
  appendStepSummary,
} = require('./selective-check-utils')

const VALIDATOR_CONTRACT_TESTS = [
  '__tests__/scripts/validator-json-contract.test.ts',
  '__tests__/scripts/validator-output.test.ts',
  '__tests__/scripts/validator-error-codes.test.ts',
  '__tests__/scripts/validate-pr-ci-exception.test.ts',
  '__tests__/scripts/validate-ci-incident-snippet.test.ts',
  '__tests__/scripts/validate-smoke-suite-baseline-recommendation.test.ts',
  '__tests__/scripts/guard-validator-contract-change.test.ts',
]

const RELEVANT_PATTERNS = [
  /^scripts\/validator-/,
  /^scripts\/validation-utils\.js$/,
  /^scripts\/validate-.*\.js$/,
  /^scripts\/guard-validator-contract-change\.js$/,
  /^__tests__\/scripts\/validator-.*\.test\.ts$/,
  /^__tests__\/scripts\/validate-.*\.test\.ts$/,
  /^__tests__\/scripts\/guard-validator-contract-change\.test\.ts$/,
  /^docs\/TESTING\.md$/,
  /^\.github\/workflows\/ci-smoke\.yml$/,
]

const parseArgs = (argv) => {
  const args = {
    changedFilesFile: '',
    dryRun: false,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (token === '--changed-files-file' && argv[i + 1]) {
      args.changedFilesFile = argv[i + 1]
      i += 1
      continue
    }
    if (token === '--dry-run') {
      args.dryRun = true
      continue
    }
  }

  return args
}

const getMatchedValidatorFiles = (changedFiles) => getMatchedFiles(changedFiles, RELEVANT_PATTERNS)

const shouldRunForChangedFiles = (changedFiles) => {
  return getMatchedValidatorFiles(changedFiles).length > 0
}

const readChangedFiles = ({ changedFilesFile }) => {
  if (changedFilesFile && fs.existsSync(changedFilesFile)) {
    return parseChangedFiles(fs.readFileSync(changedFilesFile, 'utf8'))
  }
  return parseChangedFiles(process.env.CHANGED_FILES || '')
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
