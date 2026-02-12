const {
  parseArgs,
  buildSummaryLines,
} = require('@/scripts/summarize-validator-contracts-summary-validation')

describe('summarize-validator-contracts-summary-validation', () => {
  it('parses args', () => {
    expect(parseArgs([])).toEqual({
      file: 'test-results/validator-contracts-summary-validation.json',
    })
    expect(parseArgs(['--file', 'tmp/contracts-summary-validation.json'])).toEqual({
      file: 'tmp/contracts-summary-validation.json',
    })
  })

  it('builds pass summary', () => {
    const lines = buildSummaryLines({
      file: 'test-results/validator-contracts-summary-validation.json',
      payload: { ok: true, errorCount: 0, errors: [] },
      missing: false,
      parseError: '',
    })
    expect(lines.join('\n')).toContain('Status: pass')
    expect(lines.join('\n')).toContain('Error count: 0')
  })

  it('builds fail summary with remediation and codes', () => {
    const lines = buildSummaryLines({
      file: 'test-results/validator-contracts-summary-validation.json',
      payload: {
        ok: false,
        errorCount: 2,
        errors: [
          { code: 'VALIDATOR_CONTRACTS_SUMMARY_STATUS_MISMATCH' },
          { code: 'VALIDATOR_CONTRACTS_SUMMARY_COUNT_MISMATCH' },
        ],
      },
      missing: false,
      parseError: '',
    })
    const text = lines.join('\n')
    expect(text).toContain('Status: fail')
    expect(text).toContain('VALIDATOR_CONTRACTS_SUMMARY_STATUS_MISMATCH')
    expect(text).toContain('validator:contracts:summary')
  })
})
