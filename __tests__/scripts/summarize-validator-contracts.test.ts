const path = require('path')
const fs = require('fs')
const { makeTempDir } = require('./cli-test-utils')
const {
  DEFAULT_GUARD_FILE,
  DEFAULT_DOCS_FILE,
  DEFAULT_POLICY_FILE,
  SUMMARY_SCHEMA_VERSION,
  parseArgs,
  toUniqueCodes,
  buildCheckSummary,
  buildSummaryPayload,
  buildSummaryLines,
  writeJsonSummary,
} = require('@/scripts/summarize-validator-contracts')

describe('summarize-validator-contracts', () => {
  it('parses args with defaults and overrides', () => {
    expect(parseArgs([])).toEqual({
      guardFile: DEFAULT_GUARD_FILE,
      docsFile: DEFAULT_DOCS_FILE,
      policyFile: DEFAULT_POLICY_FILE,
      jsonOutput: '',
    })

    expect(parseArgs([
      '--guard-file', 'tmp/guard.json',
      '--docs-file', 'tmp/docs.json',
      '--policy-file', 'tmp/policy.json',
      '--json-output', 'tmp/summary.json',
    ])).toEqual({
      guardFile: 'tmp/guard.json',
      docsFile: 'tmp/docs.json',
      policyFile: 'tmp/policy.json',
      jsonOutput: 'tmp/summary.json',
    })
  })

  it('extracts unique non-empty error codes', () => {
    expect(toUniqueCodes([
      { code: 'A' },
      { code: 'A' },
      { code: 'B' },
      {},
      null,
    ])).toEqual(['A', 'B'])
  })

  it('builds warning check for missing payload', () => {
    const check = buildCheckSummary({
      id: 'validator-guard-comment-validation',
      title: 'Validator Guard Comment Validation',
      file: 'tmp/missing.json',
      payload: null,
      missing: true,
      parseError: '',
    })
    expect(check.status).toBe('warning')
    expect(check.reason).toContain('not found')
  })

  it('builds pass/fail check summaries from payload', () => {
    const pass = buildCheckSummary({
      id: 'validator-error-codes-doc-table-validation',
      title: 'Validator Error Codes Docs Table Validation',
      file: 'tmp/pass.json',
      payload: { ok: true, errorCount: 0, errors: [] },
      missing: false,
      parseError: '',
    })
    expect(pass.status).toBe('pass')

    const fail = buildCheckSummary({
      id: 'validator-error-codes-policy-validation',
      title: 'Validator Error Codes Policy Validation',
      file: 'tmp/fail.json',
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
    expect(fail.status).toBe('fail')
    expect(fail.errorCodes).toEqual([
      'ERROR_CODES_POLICY_PREFIX_MISMATCH',
      'ERROR_CODES_POLICY_DUPLICATE_VALUE',
    ])
  })

  it('builds fail aggregate payload with counts and codes', () => {
    const summary = buildSummaryPayload({
      checks: [
        { id: 'a', status: 'pass', errorCount: 0, errorCodes: [] },
        { id: 'b', status: 'fail', errorCount: 2, errorCodes: ['E1'] },
        { id: 'c', status: 'warning', errorCount: 0, errorCodes: [] },
      ],
    })

    expect(summary).toEqual(expect.objectContaining({
      schemaVersion: SUMMARY_SCHEMA_VERSION,
      overallStatus: 'fail',
      checkCount: 3,
      passCount: 1,
      failCount: 1,
      warningCount: 1,
      totalErrors: 2,
      errorCodes: ['E1'],
    }))
  })

  it('builds human-readable summary lines', () => {
    const lines = buildSummaryLines({
      summary: {
        overallStatus: 'warning',
        checkCount: 3,
        passCount: 2,
        failCount: 0,
        warningCount: 1,
        totalErrors: 0,
        errorCodes: [],
        checks: [
          { id: 'validator-guard-comment-validation', status: 'pass', errorCount: 0, errorCodes: [], reason: '' },
          { id: 'validator-error-codes-doc-table-validation', status: 'warning', errorCount: 0, errorCodes: [], reason: 'missing file' },
          { id: 'validator-error-codes-policy-validation', status: 'pass', errorCount: 0, errorCodes: [], reason: '' },
        ],
      },
    })

    const joined = lines.join('\n')
    expect(joined).toContain('Validator Contracts Validation')
    expect(joined).toContain('Status: warning')
    expect(joined).toContain('validator-error-codes-doc-table-validation: warning')
  })

  it('writes json summary snapshot', () => {
    const dir = makeTempDir('validator-contracts-summary-')
    const output = path.join(dir, 'summary.json')
    const payload = { schemaVersion: SUMMARY_SCHEMA_VERSION, overallStatus: 'pass' }
    expect(writeJsonSummary({ jsonOutput: output, payload })).toBe(true)
    const parsed = JSON.parse(fs.readFileSync(output, 'utf8'))
    expect(parsed).toEqual(payload)
  })
})
