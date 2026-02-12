const {
  REQUIRED_PREFIX_BY_NAMESPACE,
  parseArgs,
  validate,
  validateDetailed,
} = require('@/scripts/validate-validator-error-codes-policy')
const { ERROR_CODES } = require('@/scripts/validator-error-codes')

describe('validate-validator-error-codes-policy', () => {
  it('parses args', () => {
    expect(parseArgs([])).toEqual({ output: 'text' })
    expect(parseArgs(['--json'])).toEqual({ output: 'json' })
  })

  it('passes for current error-codes map', () => {
    expect(validate(ERROR_CODES)).toEqual([])
  })

  it('reports prefix mismatch violations', () => {
    const cloned = JSON.parse(JSON.stringify(ERROR_CODES))
    cloned.incidentSnippet.MISSING_HEADER = 'WRONG_PREFIX_CODE'
    const errors = validateDetailed(cloned)
    expect(errors.some((entry) => entry.code === 'ERROR_CODES_POLICY_PREFIX_MISMATCH')).toBe(true)
  })

  it('reports duplicate value violations', () => {
    const cloned = JSON.parse(JSON.stringify(ERROR_CODES))
    cloned.validatorGuardComment.INVALID_STATUS = cloned.incidentSnippet.INVALID_FAILURE_CLASS
    const errors = validateDetailed(cloned)
    expect(errors.some((entry) => entry.code === 'ERROR_CODES_POLICY_DUPLICATE_VALUE')).toBe(true)
  })

  it('keeps required namespace-prefix map stable', () => {
    expect(REQUIRED_PREFIX_BY_NAMESPACE).toEqual({
      prCiException: 'PR_',
      incidentSnippet: 'INCIDENT_',
      incidentPayload: 'INCIDENT_PAYLOAD_',
      validatorGuardComment: 'VALIDATOR_GUARD_COMMENT_',
      errorCodesDoc: 'ERROR_CODES_DOC_',
      errorCodesPolicy: 'ERROR_CODES_POLICY_',
      validatorContractsSummary: 'VALIDATOR_CONTRACTS_SUMMARY_',
      suiteBaselineRecommendation: 'SUITE_',
    })
  })

  it('keeps namespace coverage aligned with validator-error-codes map', () => {
    const requiredNamespaces = Object.keys(REQUIRED_PREFIX_BY_NAMESPACE).sort()
    const availableNamespaces = Object.keys(ERROR_CODES).sort()
    expect(requiredNamespaces).toEqual(availableNamespaces)
  })
})
