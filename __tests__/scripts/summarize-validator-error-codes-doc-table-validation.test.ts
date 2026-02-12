const {
  parseArgs,
  buildSummaryLines,
} = require('@/scripts/summarize-validator-error-codes-doc-table-validation')

describe('summarize-validator-error-codes-doc-table-validation', () => {
  it('parses args with defaults and overrides', () => {
    expect(parseArgs([])).toEqual({
      file: 'test-results/validator-error-codes-doc-table-validation.json',
    })
    expect(parseArgs(['--file', 'tmp/docs-table-validation.json'])).toEqual({
      file: 'tmp/docs-table-validation.json',
    })
  })

  it('builds summary lines for passing validation', () => {
    const lines = buildSummaryLines({
      file: 'test-results/validator-error-codes-doc-table-validation.json',
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
      file: 'test-results/validator-error-codes-doc-table-validation.json',
      payload: {
        ok: false,
        errorCount: 1,
        errors: [{ code: 'ERROR_CODES_DOC_OUTDATED_TABLE' }],
      },
      missing: false,
      parseError: '',
    })

    expect(lines.join('\n')).toContain('Status: fail')
    expect(lines.join('\n')).toContain('Error count: 1')
    expect(lines.join('\n')).toContain('ERROR_CODES_DOC_OUTDATED_TABLE')
    expect(lines.join('\n')).toContain('validator:error-codes:docs:update')
  })
})
