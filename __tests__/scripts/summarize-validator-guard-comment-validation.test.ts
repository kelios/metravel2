const { parseArgs, buildSummaryLines } = require('@/scripts/summarize-validator-guard-comment-validation')

describe('summarize-validator-guard-comment-validation', () => {
  it('parses args with defaults and overrides', () => {
    expect(parseArgs([])).toEqual({
      file: 'test-results/validator-guard-comment-validation.json',
    })
    expect(parseArgs(['--file', 'tmp/validation.json'])).toEqual({
      file: 'tmp/validation.json',
    })
  })

  it('builds summary lines for passing validation', () => {
    const lines = buildSummaryLines({
      file: 'test-results/validator-guard-comment-validation.json',
      payload: {
        ok: true,
        errorCount: 0,
        errors: [],
      },
      missing: false,
      parseError: '',
    })
    expect(lines.join('\n')).toContain('Status: pass')
    expect(lines.join('\n')).toContain('Error count: 0')
  })

  it('builds summary lines for failing validation with error codes', () => {
    const lines = buildSummaryLines({
      file: 'test-results/validator-guard-comment-validation.json',
      payload: {
        ok: false,
        errorCount: 2,
        errors: [
          { code: 'VALIDATOR_GUARD_COMMENT_INVALID_STATUS' },
          { code: 'VALIDATOR_GUARD_COMMENT_INVALID_WORKFLOW_RUN' },
        ],
      },
      missing: false,
      parseError: '',
    })
    expect(lines.join('\n')).toContain('Status: fail')
    expect(lines.join('\n')).toContain('Error count: 2')
    expect(lines.join('\n')).toContain('VALIDATOR_GUARD_COMMENT_INVALID_STATUS')
  })

  it('builds warning lines for missing or invalid payload files', () => {
    const missingLines = buildSummaryLines({
      file: 'test-results/missing.json',
      payload: null,
      missing: true,
      parseError: '',
    })
    expect(missingLines.join('\n')).toContain('Status: warning')
    expect(missingLines.join('\n')).toContain('Validation payload not found')

    const parseErrorLines = buildSummaryLines({
      file: 'test-results/invalid.json',
      payload: null,
      missing: false,
      parseError: 'Unexpected token',
    })
    expect(parseErrorLines.join('\n')).toContain('Status: warning')
    expect(parseErrorLines.join('\n')).toContain('Failed to parse validation payload')
  })
})
