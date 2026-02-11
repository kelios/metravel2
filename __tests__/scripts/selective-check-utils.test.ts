const fs = require('fs')
const os = require('os')
const path = require('path')
const {
  parseChangedFiles,
  getMatchedFiles,
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

  it('appends summary to file path', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'selective-utils-'))
    const summaryPath = path.join(dir, 'summary.md')
    const appended = appendStepSummary('hello', summaryPath)
    expect(appended).toBe(true)
    expect(fs.readFileSync(summaryPath, 'utf8')).toBe('hello')
    fs.rmSync(dir, { recursive: true, force: true })
  })
})
