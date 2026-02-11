const {
  VALIDATOR_CONTRACT_TESTS,
  parseArgs,
  parseChangedFiles,
  getMatchedFiles,
  shouldRunForChangedFiles,
  buildSummaryMarkdown,
  decideExecutionFromMatches,
} = require('@/scripts/run-validator-contract-tests-if-needed')

describe('run-validator-contract-tests-if-needed', () => {
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

  it('detects relevant changed files for validator contract checks', () => {
    expect(shouldRunForChangedFiles(['scripts/validator-output.js'])).toBe(true)
    expect(shouldRunForChangedFiles(['scripts/validate-pr-ci-exception.js'])).toBe(true)
    expect(shouldRunForChangedFiles(['__tests__/scripts/validator-json-contract.test.ts'])).toBe(true)
    expect(shouldRunForChangedFiles(['README.md'])).toBe(false)
  })

  it('returns matched files list for summary output', () => {
    expect(getMatchedFiles([
      'README.md',
      'scripts/validator-output.js',
      '__tests__/scripts/validator-json-contract.test.ts',
    ])).toEqual([
      'scripts/validator-output.js',
      '__tests__/scripts/validator-json-contract.test.ts',
    ])
  })

  it('builds run/skip summary markdown', () => {
    const runSummary = buildSummaryMarkdown({
      status: 'run',
      changedFiles: ['scripts/validator-output.js'],
      matchedFiles: ['scripts/validator-output.js'],
      dryRun: true,
    })
    expect(runSummary).toContain('Decision: run')
    expect(runSummary).toContain('Mode: dry-run')
    expect(runSummary).toContain('Matched files:')
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

  it('keeps targeted validator test list stable', () => {
    expect(VALIDATOR_CONTRACT_TESTS).toEqual([
      '__tests__/scripts/validator-json-contract.test.ts',
      '__tests__/scripts/validator-output.test.ts',
      '__tests__/scripts/validator-error-codes.test.ts',
      '__tests__/scripts/validate-pr-ci-exception.test.ts',
      '__tests__/scripts/validate-ci-incident-snippet.test.ts',
      '__tests__/scripts/validate-smoke-suite-baseline-recommendation.test.ts',
      '__tests__/scripts/guard-validator-contract-change.test.ts',
    ])
  })
})
