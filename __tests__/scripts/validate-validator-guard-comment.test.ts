const {
  parseArgs,
  extractLineValue,
  validate,
  validateDetailed,
  MARKER,
  ALLOWED_STATUSES,
  REQUIRED_LABELS,
} = require('@/scripts/validate-validator-guard-comment')
const { ERROR_CODES } = require('@/scripts/validator-error-codes')

describe('validate-validator-guard-comment', () => {
  it('keeps guard comment field contract stable', () => {
    expect(ALLOWED_STATUSES).toEqual(['PASS', 'FAIL'])
    expect(REQUIRED_LABELS).toEqual(['Status', 'Reason', 'Workflow run', 'Guard artifact'])
  })

  it('parses args with defaults and --json', () => {
    expect(parseArgs([])).toEqual({
      file: 'test-results/validator-guard-comment-publish.md',
      output: 'text',
    })
    expect(parseArgs(['--file', 'tmp/comment.md', '--json'])).toEqual({
      file: 'tmp/comment.md',
      output: 'json',
    })
  })

  it('extracts markdown values by label', () => {
    const markdown = '- Status: FAIL\n- Reason: Guard failed\n'
    expect(extractLineValue(markdown, 'Status')).toBe('FAIL')
    expect(extractLineValue(markdown, 'Reason')).toBe('Guard failed')
  })

  it('passes valid PASS markdown', () => {
    const markdown = [
      MARKER,
      '### Validator Guard Comment',
      '',
      '- Status: PASS',
      '- Reason: Guard checks passed.',
      '- Workflow run: https://github.com/org/repo/actions/runs/123',
      '- Guard artifact: https://github.com/org/repo/actions/runs/123#artifacts',
      '',
    ].join('\n')

    expect(validate(markdown)).toEqual([])
  })

  it('passes valid FAIL markdown', () => {
    const markdown = [
      MARKER,
      '### Validator Guard Comment',
      '',
      '- Status: FAIL',
      '- Reason: Guarded files changed without companions.',
      '- Workflow run: https://github.com/org/repo/actions/runs/123',
      '- Guard artifact: https://github.com/org/repo/actions/runs/123#artifacts',
      '- Missing required files:',
      '  - `docs/TESTING.md`',
      '',
    ].join('\n')

    expect(validate(markdown)).toEqual([])
  })

  it('fails for missing marker and header', () => {
    const markdown = [
      '- Status: FAIL',
      '- Reason: Guarded files changed without companions.',
      '- Workflow run: https://github.com/org/repo/actions/runs/123',
      '- Guard artifact: https://github.com/org/repo/actions/runs/123#artifacts',
      '',
    ].join('\n')

    const errors = validateDetailed(markdown)
    expect(errors.some((entry) => entry.code === ERROR_CODES.validatorGuardComment.MISSING_MARKER)).toBe(true)
    expect(errors.some((entry) => entry.code === ERROR_CODES.validatorGuardComment.MISSING_HEADER)).toBe(true)
  })

  it('fails for invalid status and placeholder fields', () => {
    const markdown = [
      MARKER,
      '### Validator Guard Comment',
      '',
      '- Status: UNKNOWN',
      '- Reason: <fill>',
      '- Workflow run: not-a-url',
      '- Guard artifact: <link>',
      '',
    ].join('\n')

    const errors = validate(markdown).join('\n')
    expect(errors).toContain('Status')
    expect(errors).toContain('Reason')
    expect(errors).toContain('Workflow run')
    expect(errors).toContain('Guard artifact')
  })
})
