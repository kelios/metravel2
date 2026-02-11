const fs = require('fs')
const os = require('os')
const path = require('path')
const {
  parseChangedFiles,
  getMatchedFiles,
  getCategoryBreakdown,
  decideExecutionFromMatches,
  buildDecisionSummary,
  appendStepSummary,
} = require('@/scripts/selective-check-utils')

describe('selective-check-utils', () => {
  it('parses changed files from raw text', () => {
    expect(parseChangedFiles('a\nb\n\n c \n')).toEqual(['a', 'b', 'c'])
  })

  it('matches changed files by regex patterns', () => {
    const matched = getMatchedFiles(
      ['README.md', 'scripts/validator-output.js', '__tests__/scripts/validator-output.test.ts'],
      [/^scripts\/validator-output\.js$/, /^__tests__\/scripts\/validator-output\.test\.ts$/],
    )
    expect(matched).toEqual([
      'scripts/validator-output.js',
      '__tests__/scripts/validator-output.test.ts',
    ])
  })

  it('aggregates category breakdown counts by category name', () => {
    const breakdown = getCategoryBreakdown(
      ['scripts/a.js', '__tests__/scripts/a.test.ts', '__tests__/scripts/b.test.ts'],
      [
        { name: 'scripts', pattern: /^scripts\// },
        { name: 'tests', pattern: /^__tests__\/scripts\/.*\.test\.ts$/ },
        { name: 'tests', pattern: /^__tests__\/scripts\/a\.test\.ts$/ },
      ],
    )
    expect(breakdown).toEqual([
      { name: 'scripts', count: 1 },
      { name: 'tests', count: 3 },
    ])
  })

  it('builds decision summary markdown', () => {
    const markdown = buildDecisionSummary({
      title: 'Sample Check',
      decision: 'run',
      changedFiles: ['a', 'b'],
      matchedFiles: ['b'],
      notes: ['note 1'],
    })
    expect(markdown).toContain('### Sample Check')
    expect(markdown).toContain('Decision: run')
    expect(markdown).toContain('Changed files scanned: 2')
    expect(markdown).toContain('Relevant file matches: 1')
    expect(markdown).toContain('note 1')
  })

  it('decides whether selective checks should run', () => {
    expect(decideExecutionFromMatches({ matchedFiles: ['scripts/a.js'], inputAvailable: true })).toEqual({
      shouldRun: true,
      reason: 'match',
    })
    expect(decideExecutionFromMatches({ matchedFiles: [], inputAvailable: true })).toEqual({
      shouldRun: false,
      reason: 'no-match',
    })
    expect(decideExecutionFromMatches({ matchedFiles: [], inputAvailable: false })).toEqual({
      shouldRun: true,
      reason: 'missing-input',
    })
  })

  it('appends summary to file path', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'selective-utils-'))
    const summaryPath = path.join(dir, 'summary.md')
    const appended = appendStepSummary('hello', summaryPath)
    expect(appended).toBe(true)
    expect(fs.readFileSync(summaryPath, 'utf8')).toBe('hello')
    fs.rmSync(dir, { recursive: true, force: true })
  })
})
