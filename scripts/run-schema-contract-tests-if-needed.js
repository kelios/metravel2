const fs = require('fs')
const { spawnSync } = require('child_process')
const {
  parseChangedFiles,
  getMatchedFiles,
  buildDecisionSummary,
  appendStepSummary,
} = require('./selective-check-utils')

const SCHEMA_CONTRACT_TESTS = [
  '__tests__/scripts/summarize-quality-gate.test.ts',
  '__tests__/scripts/validate-quality-summary.test.ts',
  '__tests__/scripts/guard-quality-schema-change.test.ts',
]

const RELEVANT_PATTERNS = [
  /^scripts\/summarize-quality-gate\.js$/,
  /^scripts\/validate-quality-summary\.js$/,
  /^scripts\/guard-quality-schema-change\.js$/,
  /^__tests__\/scripts\/summarize-quality-gate\.test\.ts$/,
  /^__tests__\/scripts\/validate-quality-summary\.test\.ts$/,
  /^__tests__\/scripts\/guard-quality-schema-change\.test\.ts$/,
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

const getMatchedSchemaFiles = (changedFiles) => getMatchedFiles(changedFiles, RELEVANT_PATTERNS)

const shouldRunForChangedFiles = (changedFiles) => {
  return getMatchedSchemaFiles(changedFiles).length > 0
}

const readChangedFiles = ({ changedFilesFile }) => {
  if (changedFilesFile && fs.existsSync(changedFilesFile)) {
    return parseChangedFiles(fs.readFileSync(changedFilesFile, 'utf8'))
  }
  return parseChangedFiles(process.env.CHANGED_FILES || '')
}

const runSchemaContractTests = () => {
  const result = spawnSync(
    'yarn',
    ['jest', '--runInBand', ...SCHEMA_CONTRACT_TESTS],
    { stdio: 'inherit' },
  )
  return result.status ?? 1
}

const buildSummaryMarkdown = ({ status, changedFiles, matchedFiles, dryRun }) => {
  const notes = []
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
  const changedFiles = readChangedFiles({ changedFilesFile: args.changedFilesFile })
  const matchedFiles = getMatchedSchemaFiles(changedFiles)

  if (matchedFiles.length === 0) {
    console.log('schema-contract-check: skipped (no relevant file changes).')
    appendStepSummary(buildSummaryMarkdown({
      status: 'skip',
      changedFiles,
      matchedFiles,
      dryRun: args.dryRun,
    }))
    return
  }

  console.log('schema-contract-check: running targeted schema contract tests.')
  appendStepSummary(buildSummaryMarkdown({
    status: 'run',
    changedFiles,
    matchedFiles,
    dryRun: args.dryRun,
  }))
  if (args.dryRun) {
    console.log(`schema-contract-check: dry-run, would run ${SCHEMA_CONTRACT_TESTS.length} tests.`)
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
  buildSummaryMarkdown,
}
