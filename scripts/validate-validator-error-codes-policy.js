const { ERROR_CODES } = require('./validator-error-codes')
const { buildResult, emitResult } = require('./validator-output')

const REQUIRED_PREFIX_BY_NAMESPACE = {
  prCiException: 'PR_',
  incidentSnippet: 'INCIDENT_',
  incidentPayload: 'INCIDENT_PAYLOAD_',
  validatorGuardComment: 'VALIDATOR_GUARD_COMMENT_',
  errorCodesDoc: 'ERROR_CODES_DOC_',
  errorCodesPolicy: 'ERROR_CODES_POLICY_',
  validatorContractsSummary: 'VALIDATOR_CONTRACTS_SUMMARY_',
  suiteBaselineRecommendation: 'SUITE_',
}

const parseArgs = (argv) => {
  return {
    output: argv.includes('--json') ? 'json' : 'text',
  }
}

const validateDetailed = (errorCodes = ERROR_CODES) => {
  const errors = []

  for (const [namespace, requiredPrefix] of Object.entries(REQUIRED_PREFIX_BY_NAMESPACE)) {
    const entries = errorCodes?.[namespace] || {}
    for (const [key, value] of Object.entries(entries)) {
      const code = String(value || '').trim()
      if (!code.startsWith(requiredPrefix)) {
        errors.push({
          code: ERROR_CODES.errorCodesPolicy.PREFIX_MISMATCH,
          field: `${namespace}.${key}`,
          message: `Code "${code}" must start with "${requiredPrefix}" for namespace "${namespace}". Remediation: update scripts/validator-error-codes.js.`,
        })
      }
    }
  }

  const seen = new Map()
  for (const [namespace, entries] of Object.entries(errorCodes || {})) {
    for (const [key, value] of Object.entries(entries || {})) {
      const code = String(value || '').trim()
      if (!code) continue
      const location = `${namespace}.${key}`
      const existing = seen.get(code)
      if (existing) {
        errors.push({
          code: ERROR_CODES.errorCodesPolicy.DUPLICATE_VALUE,
          field: location,
          message: `Duplicate code "${code}" found in "${existing}" and "${location}". Remediation: make codes globally unique in scripts/validator-error-codes.js.`,
        })
      } else {
        seen.set(code, location)
      }
    }
  }

  return errors
}

const validate = (errorCodes = ERROR_CODES) => {
  return validateDetailed(errorCodes).map((entry) => entry.message)
}

const main = () => {
  const args = parseArgs(process.argv.slice(2))
  const result = buildResult({ errors: validateDetailed(ERROR_CODES) })
  const exitCode = emitResult({
    result,
    output: args.output,
    successMessage: 'Validator error-codes policy validation: passed.',
    failurePrefix: 'Validator error-codes policy validation',
  })
  if (exitCode !== 0) process.exit(exitCode)
}

if (require.main === module) {
  main()
}

module.exports = {
  REQUIRED_PREFIX_BY_NAMESPACE,
  parseArgs,
  validate,
  validateDetailed,
}
