const { ERROR_CODES } = require('@/scripts/validator-error-codes')

const REQUIRED_PREFIX_BY_NAMESPACE = {
  prCiException: 'PR_',
  incidentSnippet: 'INCIDENT_',
  incidentPayload: 'INCIDENT_PAYLOAD_',
  validatorGuardComment: 'VALIDATOR_GUARD_COMMENT_',
  errorCodesDoc: 'ERROR_CODES_DOC_',
  suiteBaselineRecommendation: 'SUITE_',
}

describe('validator-error-codes prefix policy', () => {
  it('keeps namespace-specific code prefixes consistent', () => {
    const violations = []

    for (const [namespace, requiredPrefix] of Object.entries(REQUIRED_PREFIX_BY_NAMESPACE)) {
      const entries = ERROR_CODES?.[namespace] || {}
      for (const [key, value] of Object.entries(entries)) {
        const code = String(value || '').trim()
        if (!code.startsWith(requiredPrefix)) {
          violations.push({
            namespace,
            key,
            code,
            requiredPrefix,
            remediation: `Rename ${namespace}.${key} to use prefix "${requiredPrefix}" in scripts/validator-error-codes.js`,
          })
        }
      }
    }

    expect(violations).toEqual([])
  })
})
