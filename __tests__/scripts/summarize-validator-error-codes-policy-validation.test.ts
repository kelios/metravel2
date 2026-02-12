const {
  parseArgs,
  buildSummaryLines,
} = require('@/scripts/summarize-validator-error-codes-policy-validation')

describe('summarize-validator-error-codes-policy-validation', () => {
  it('parses args', () => {
    expect(parseArgs([])).toEqual({
      file: 'test-results/validator-error-codes-policy-validation.json',
    })
    expect(parseArgs(['--file', 'tmp/policy.json'])).toEqual({
      file: 'tmp/policy.json',
    })
  })

  it('builds pass summary', () => {
    const lines = buildSummaryLines({
      file: 'test-results/validator-error-codes-policy-validation.json',
      payload: { ok: true, errorCount: 0, errors: [] },
      missing: false,
      parseError: '',
    })
    expect(lines.join('\n')).toContain('Status: pass')
    expect(lines.join('\n')).toContain('Error count: 0')
  })

  it('builds fail summary with remediation', () => {
    const lines = buildSummaryLines({
      file: 'test-results/validator-error-codes-policy-validation.json',
      payload: {
        ok: false,
        errorCount: 2,
        errors: [
          { code: 'ERROR_CODES_POLICY_PREFIX_MISMATCH' },
          { code: 'ERROR_CODES_POLICY_DUPLICATE_VALUE' },
        ],
      },
      missing: false,
      parseError: '',
    })
    expect(lines.join('\n')).toContain('Status: fail')
    expect(lines.join('\n')).toContain('ERROR_CODES_POLICY_PREFIX_MISMATCH')
    expect(lines.join('\n')).toContain('validator:contracts:check')
  })
})
