const {
  SCHEMA_CONTRACT_TESTS,
  parseArgs,
  parseChangedFiles,
  getMatchedFiles,
  shouldRunForChangedFiles,
  buildSummaryMarkdown,
} = require('@/scripts/run-schema-contract-tests-if-needed')

describe('run-schema-contract-tests-if-needed', () => {
  it('parses args with defaults and overrides', () => {
    expect(parseArgs([])).toEqual({
      changedFilesFile: '',
      dryRun: false,
    })
    expect(parseArgs(['--changed-files-file', 'changed_files.txt', '--dry-run'])).toEqual({
      changedFilesFile: 'changed_files.txt',
      dryRun: true,
    })
  })

  it('parses changed files list from newline payload', () => {
    expect(parseChangedFiles('a\nb\n\n c \n')).toEqual(['a', 'b', 'c'])
  })

  it('detects relevant changed files for schema contract checks', () => {
    expect(shouldRunForChangedFiles(['scripts/summarize-quality-gate.js'])).toBe(true)
    expect(shouldRunForChangedFiles(['scripts/validate-quality-summary.js'])).toBe(true)
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

  it('keeps targeted schema test list stable', () => {
    expect(SCHEMA_CONTRACT_TESTS).toEqual([
      '__tests__/scripts/summarize-quality-gate.test.ts',
      '__tests__/scripts/validate-quality-summary.test.ts',
      '__tests__/scripts/guard-quality-schema-change.test.ts',
    ])
  })
})
