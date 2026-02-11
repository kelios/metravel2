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

const SCHEMA_CONTRACT_TESTS = [
  '__tests__/scripts/summarize-quality-gate.test.ts',
  '__tests__/scripts/validate-quality-summary.test.ts',
  '__tests__/scripts/guard-quality-schema-change.test.ts',
]

const RELEVANT_CATEGORIES = [
  { name: 'schema', pattern: /^scripts\/summarize-quality-gate\.js$/ },
  { name: 'schema', pattern: /^scripts\/validate-quality-summary\.js$/ },
  { name: 'guards', pattern: /^scripts\/guard-quality-schema-change\.js$/ },
  { name: 'tests', pattern: /^__tests__\/scripts\/summarize-quality-gate\.test\.ts$/ },
  { name: 'tests', pattern: /^__tests__\/scripts\/validate-quality-summary\.test\.ts$/ },
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

const buildSummaryMarkdown = ({ status, changedFiles, matchedFiles, dryRun }) => {
  const notes = []
  const breakdown = getCategoryBreakdown(changedFiles || [], RELEVANT_CATEGORIES)
  if (breakdown.length > 0) {
    notes.push(`Category matches: ${breakdown.map((item) => `${item.name}=${item.count}`).join(', ')}`)
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
