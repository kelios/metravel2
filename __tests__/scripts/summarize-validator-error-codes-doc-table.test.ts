const { buildErrorCodesTable } = require('@/scripts/summarize-validator-error-codes-doc-table')
const { ERROR_CODES } = require('@/scripts/validator-error-codes')

describe('summarize-validator-error-codes-doc-table', () => {
  it('builds markdown table with expected headers and known values', () => {
    const table = buildErrorCodesTable(ERROR_CODES)
    expect(table).toContain('| Namespace | Key | Code |')
    expect(table).toContain('| validatorGuardComment | INVALID_STATUS | VALIDATOR_GUARD_COMMENT_INVALID_STATUS |')
    expect(table).toContain('| errorCodesDoc | OUTDATED_TABLE | ERROR_CODES_DOC_OUTDATED_TABLE |')
  })
})
