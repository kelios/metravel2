const {
  SCHEMA_CONTRACT_TESTS,
  parseArgs,
  parseChangedFiles,
  getMatchedFiles,
  shouldRunForChangedFiles,
  buildSummaryMarkdown,
  decideExecutionFromMatches,
} = require('@/scripts/run-schema-contract-tests-if-needed')
const fs = require('fs')
const path = require('path')

describe('run-schema-contract-tests-if-needed', () => {
  it('parses args with defaults and overrides', () => {
    expect(parseArgs([])).toEqual({
      changedFilesFile: '',
      dryRun: false,
      output: 'text',
    })
    expect(parseArgs(['--changed-files-file', 'changed_files.txt', '--dry-run'])).toEqual({
      changedFilesFile: 'changed_files.txt',
      dryRun: true,
      output: 'text',
    })
    expect(parseArgs(['--dry-run', '--json'])).toEqual({
      changedFilesFile: '',
      dryRun: true,
      output: 'json',
    })
  })

  it('parses changed files list from newline payload', () => {
    expect(parseChangedFiles('a\nb\n\n c \n')).toEqual(['a', 'b', 'c'])
  })

  it('detects relevant changed files for schema contract checks', () => {
    expect(shouldRunForChangedFiles(['scripts/summarize-quality-gate.js'])).toBe(true)
    expect(shouldRunForChangedFiles(['scripts/validate-quality-summary.js'])).toBe(true)
    expect(shouldRunForChangedFiles(['scripts/validate-selective-decision.js'])).toBe(true)
    expect(shouldRunForChangedFiles(['scripts/collect-selective-decisions.js'])).toBe(true)
    expect(shouldRunForChangedFiles(['__tests__/scripts/validate-quality-summary.test.ts'])).toBe(true)
    expect(shouldRunForChangedFiles(['README.md'])).toBe(false)
  })

  it('returns matched files list for summary output', () => {
    expect(getMatchedFiles([
      'README.md',
      'scripts/summarize-quality-gate.js',
      '__tests__/scripts/validate-quality-summary.test.ts',
    ])).toEqual([
      'scripts/summarize-quality-gate.js',
      '__tests__/scripts/validate-quality-summary.test.ts',
    ])
  })

  it('builds run/skip summary markdown', () => {
    const runSummary = buildSummaryMarkdown({
      status: 'run',
      changedFiles: ['scripts/summarize-quality-gate.js'],
      matchedFiles: ['scripts/summarize-quality-gate.js'],
      dryRun: true,
    })
    expect(runSummary).toContain('Decision: run')
    expect(runSummary).toContain('Mode: dry-run')
    expect(runSummary).toContain('Schema Contract Checks')
    expect(runSummary).toContain('Category matches:')

    const skipSummary = buildSummaryMarkdown({
      status: 'skip',
      changedFiles: ['README.md'],
      matchedFiles: [],
      dryRun: false,
    })
    expect(skipSummary).toContain('Decision: skip')
    expect(skipSummary).toContain('Relevant file matches: 0')
    expect(skipSummary).toContain('Category matches:')
  })

  it('forces run when changed-files input is unavailable', () => {
    expect(decideExecutionFromMatches({ matchedFiles: [], inputAvailable: false })).toEqual({
      shouldRun: true,
      reason: 'missing-input',
    })
    const summary = buildSummaryMarkdown({
      status: 'run',
      changedFiles: [],
      matchedFiles: [],
      dryRun: true,
      executionReason: 'missing-input',
    })
    expect(summary).toContain('Fail-safe: changed-files input unavailable')
  })

  it('keeps targeted schema test list stable', () => {
    expect(SCHEMA_CONTRACT_TESTS).toEqual([
      '__tests__/scripts/summarize-quality-gate.test.ts',
      '__tests__/scripts/validate-quality-summary.test.ts',
      '__tests__/scripts/selective-decision-contract.test.ts',
      '__tests__/scripts/validate-selective-decision.test.ts',
      '__tests__/scripts/collect-selective-decisions.test.ts',
      '__tests__/scripts/validate-selective-decisions.test.ts',
      '__tests__/scripts/guard-quality-schema-change.test.ts',
    ])
  })

  it('keeps targeted schema tests list unique', () => {
    const unique = new Set(SCHEMA_CONTRACT_TESTS)
    expect(unique.size).toBe(SCHEMA_CONTRACT_TESTS.length)
  })

  it('keeps targeted schema tests paths resolvable in repository', () => {
    const missing = SCHEMA_CONTRACT_TESTS.filter((file) => !fs.existsSync(path.resolve(process.cwd(), file)))
    expect(missing).toEqual([])
  })
})
