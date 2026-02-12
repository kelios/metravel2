const {
  SUPPORTED_SCHEMA_VERSION,
  ALLOWED_STATUSES,
  parseArgs,
  validate,
  validateDetailed,
} = require('@/scripts/validate-validator-contracts-summary')

const buildValidPayload = () => ({
  schemaVersion: SUPPORTED_SCHEMA_VERSION,
  overallStatus: 'pass',
  checkCount: 3,
  passCount: 3,
  failCount: 0,
  warningCount: 0,
  totalErrors: 0,
  errorCodes: [],
  checks: [
    {
      id: 'validator-guard-comment-validation',
      title: 'Validator Guard Comment Validation',
      file: 'test-results/validator-guard-comment-validation.json',
      status: 'pass',
      ok: true,
      errorCount: 0,
      errorCodes: [],
      reason: '',
    },
    {
      id: 'validator-error-codes-doc-table-validation',
      title: 'Validator Error Codes Docs Table Validation',
      file: 'test-results/validator-error-codes-doc-table-validation.json',
      status: 'pass',
      ok: true,
      errorCount: 0,
      errorCodes: [],
      reason: '',
    },
    {
      id: 'validator-error-codes-policy-validation',
      title: 'Validator Error Codes Policy Validation',
      file: 'test-results/validator-error-codes-policy-validation.json',
      status: 'pass',
      ok: true,
      errorCount: 0,
      errorCodes: [],
      reason: '',
    },
  ],
})

describe('validate-validator-contracts-summary', () => {
  it('keeps payload field contract stable', () => {
    const payload = buildValidPayload()
    expect(Object.keys(payload)).toEqual([
      'schemaVersion',
      'overallStatus',
      'checkCount',
      'passCount',
      'failCount',
      'warningCount',
      'totalErrors',
      'errorCodes',
      'checks',
    ])

    expect(Object.keys(payload.checks[0])).toEqual([
      'id',
      'title',
      'file',
      'status',
      'ok',
      'errorCount',
      'errorCodes',
      'reason',
    ])
  })

  it('keeps status contract stable', () => {
    expect(ALLOWED_STATUSES).toEqual(['pass', 'fail', 'warning'])
  })

  it('parses args', () => {
    expect(parseArgs([])).toEqual({
      file: 'test-results/validator-contracts-summary.json',
      output: 'text',
    })
    expect(parseArgs(['--file', 'tmp/summary.json', '--json'])).toEqual({
      file: 'tmp/summary.json',
      output: 'json',
    })
  })

  it('passes on valid payload', () => {
    expect(validate(JSON.stringify(buildValidPayload()))).toEqual([])
  })

  it('fails on invalid json', () => {
    const errors = validateDetailed('{')
    expect(errors.some((entry) => entry.code === 'VALIDATOR_CONTRACTS_SUMMARY_INVALID_JSON')).toBe(true)
  })

  it('fails on schema/count/status mismatches', () => {
    const payload = buildValidPayload()
    payload.schemaVersion = 999
    payload.passCount = 2
    payload.checks[2].status = 'fail'
    payload.overallStatus = 'pass'
    payload.totalErrors = 7
    payload.errorCodes = ['X']

    const errors = validateDetailed(JSON.stringify(payload))
    expect(errors.some((entry) => entry.code === 'VALIDATOR_CONTRACTS_SUMMARY_INVALID_SCHEMA_VERSION')).toBe(true)
    expect(errors.some((entry) => entry.code === 'VALIDATOR_CONTRACTS_SUMMARY_COUNT_MISMATCH')).toBe(true)
    expect(errors.some((entry) => entry.code === 'VALIDATOR_CONTRACTS_SUMMARY_STATUS_MISMATCH')).toBe(true)
    expect(errors.some((entry) => entry.code === 'VALIDATOR_CONTRACTS_SUMMARY_ERROR_CODES_MISMATCH')).toBe(true)
  })
})
