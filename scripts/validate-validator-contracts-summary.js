const { parseFileArg, readTextFile } = require('./validation-utils')
const { buildResult, emitResult } = require('./validator-output')
const { ERROR_CODES } = require('./validator-error-codes')

const SUPPORTED_SCHEMA_VERSION = 1
const ALLOWED_STATUSES = ['pass', 'fail', 'warning']

const parseArgs = (argv) => {
  const args = {
    ...parseFileArg(argv, 'test-results/validator-contracts-summary.json'),
    output: 'text',
  }
  if (argv.includes('--json')) {
    args.output = 'json'
  }
  return args
}

const isPlainObject = (value) => {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

const isNonNegativeInteger = (value) => Number.isInteger(value) && value >= 0

const ensureString = (value) => String(value || '').trim()

const validateDetailed = (rawContent) => {
  const errors = []
  let payload = null

  try {
    payload = JSON.parse(String(rawContent || ''))
  } catch (error) {
    errors.push({
      code: ERROR_CODES.validatorContractsSummary.INVALID_JSON,
      field: 'json',
      message: `Invalid JSON payload: ${String(error?.message || error)}`,
    })
    return errors
  }

  if (!isPlainObject(payload)) {
    errors.push({
      code: ERROR_CODES.validatorContractsSummary.INVALID_PAYLOAD_OBJECT,
      field: 'payload',
      message: 'Validator contracts summary payload must be a JSON object.',
    })
    return errors
  }

  if (payload.schemaVersion !== SUPPORTED_SCHEMA_VERSION) {
    errors.push({
      code: ERROR_CODES.validatorContractsSummary.INVALID_SCHEMA_VERSION,
      field: 'schemaVersion',
      message: `schemaVersion must be ${SUPPORTED_SCHEMA_VERSION}.`,
    })
  }

  if (!ALLOWED_STATUSES.includes(payload.overallStatus)) {
    errors.push({
      code: ERROR_CODES.validatorContractsSummary.INVALID_OVERALL_STATUS,
      field: 'overallStatus',
      message: `overallStatus must be one of: ${ALLOWED_STATUSES.join(', ')}.`,
    })
  }

  const countFields = ['checkCount', 'passCount', 'failCount', 'warningCount', 'totalErrors']
  countFields.forEach((field) => {
    if (!isNonNegativeInteger(payload[field])) {
      errors.push({
        code: ERROR_CODES.validatorContractsSummary.INVALID_COUNT_FIELD,
        field,
        message: `${field} must be a non-negative integer.`,
      })
    }
  })

  const checks = Array.isArray(payload.checks) ? payload.checks : null
  if (!checks) {
    errors.push({
      code: ERROR_CODES.validatorContractsSummary.INVALID_CHECKS_ARRAY,
      field: 'checks',
      message: 'checks must be an array.',
    })
  }

  const topCodes = Array.isArray(payload.errorCodes) ? payload.errorCodes : null
  if (!topCodes) {
    errors.push({
      code: ERROR_CODES.validatorContractsSummary.INVALID_ERROR_CODES_ARRAY,
      field: 'errorCodes',
      message: 'errorCodes must be an array.',
    })
  }

  if (!checks || !topCodes) {
    return errors
  }

  const statusCounts = { pass: 0, fail: 0, warning: 0 }
  let computedTotalErrors = 0
  const aggregatedCodes = []

  checks.forEach((check, index) => {
    const fieldPrefix = `checks[${index}]`
    if (!isPlainObject(check)) {
      errors.push({
        code: ERROR_CODES.validatorContractsSummary.INVALID_CHECK_ENTRY,
        field: fieldPrefix,
        message: `${fieldPrefix} must be an object.`,
      })
      return
    }

    const id = ensureString(check.id)
    const title = ensureString(check.title)
    const file = ensureString(check.file)
    const status = ensureString(check.status)
    const reason = check.reason == null ? '' : String(check.reason)
    const ok = typeof check.ok === 'boolean' ? check.ok : null
    const errorCount = check.errorCount
    const errorCodes = Array.isArray(check.errorCodes) ? check.errorCodes : null

    if (!id) {
      errors.push({
        code: ERROR_CODES.validatorContractsSummary.INVALID_CHECK_ENTRY,
        field: `${fieldPrefix}.id`,
        message: `${fieldPrefix}.id must be a non-empty string.`,
      })
    }
    if (!title) {
      errors.push({
        code: ERROR_CODES.validatorContractsSummary.INVALID_CHECK_ENTRY,
        field: `${fieldPrefix}.title`,
        message: `${fieldPrefix}.title must be a non-empty string.`,
      })
    }
    if (!file) {
      errors.push({
        code: ERROR_CODES.validatorContractsSummary.INVALID_CHECK_ENTRY,
        field: `${fieldPrefix}.file`,
        message: `${fieldPrefix}.file must be a non-empty string.`,
      })
    }
    if (!ALLOWED_STATUSES.includes(status)) {
      errors.push({
        code: ERROR_CODES.validatorContractsSummary.INVALID_CHECK_ENTRY,
        field: `${fieldPrefix}.status`,
        message: `${fieldPrefix}.status must be one of: ${ALLOWED_STATUSES.join(', ')}.`,
      })
    }
    if (ok === null) {
      errors.push({
        code: ERROR_CODES.validatorContractsSummary.INVALID_CHECK_ENTRY,
        field: `${fieldPrefix}.ok`,
        message: `${fieldPrefix}.ok must be a boolean.`,
      })
    }
    if (!isNonNegativeInteger(errorCount)) {
      errors.push({
        code: ERROR_CODES.validatorContractsSummary.INVALID_CHECK_ENTRY,
        field: `${fieldPrefix}.errorCount`,
        message: `${fieldPrefix}.errorCount must be a non-negative integer.`,
      })
    }
    if (!Array.isArray(errorCodes)) {
      errors.push({
        code: ERROR_CODES.validatorContractsSummary.INVALID_CHECK_ENTRY,
        field: `${fieldPrefix}.errorCodes`,
        message: `${fieldPrefix}.errorCodes must be an array.`,
      })
    }
    if (typeof reason !== 'string') {
      errors.push({
        code: ERROR_CODES.validatorContractsSummary.INVALID_CHECK_ENTRY,
        field: `${fieldPrefix}.reason`,
        message: `${fieldPrefix}.reason must be a string.`,
      })
    }

    if (ALLOWED_STATUSES.includes(status)) {
      statusCounts[status] += 1
    }
    if (isNonNegativeInteger(errorCount)) {
      computedTotalErrors += errorCount
    }
    if (Array.isArray(errorCodes)) {
      errorCodes
        .map((code) => String(code || '').trim())
        .filter(Boolean)
        .forEach((code) => aggregatedCodes.push(code))
    }
  })

  const uniqueAggregatedCodes = [...new Set(aggregatedCodes)]
  const uniqueTopCodes = [...new Set(topCodes.map((code) => String(code || '').trim()).filter(Boolean))]

  if (isNonNegativeInteger(payload.checkCount) && payload.checkCount !== checks.length) {
    errors.push({
      code: ERROR_CODES.validatorContractsSummary.COUNT_MISMATCH,
      field: 'checkCount',
      message: `checkCount (${payload.checkCount}) does not match checks length (${checks.length}).`,
    })
  }

  if (isNonNegativeInteger(payload.passCount) && payload.passCount !== statusCounts.pass) {
    errors.push({
      code: ERROR_CODES.validatorContractsSummary.COUNT_MISMATCH,
      field: 'passCount',
      message: `passCount (${payload.passCount}) does not match computed value (${statusCounts.pass}).`,
    })
  }

  if (isNonNegativeInteger(payload.failCount) && payload.failCount !== statusCounts.fail) {
    errors.push({
      code: ERROR_CODES.validatorContractsSummary.COUNT_MISMATCH,
      field: 'failCount',
      message: `failCount (${payload.failCount}) does not match computed value (${statusCounts.fail}).`,
    })
  }

  if (isNonNegativeInteger(payload.warningCount) && payload.warningCount !== statusCounts.warning) {
    errors.push({
      code: ERROR_CODES.validatorContractsSummary.COUNT_MISMATCH,
      field: 'warningCount',
      message: `warningCount (${payload.warningCount}) does not match computed value (${statusCounts.warning}).`,
    })
  }

  if (isNonNegativeInteger(payload.totalErrors) && payload.totalErrors !== computedTotalErrors) {
    errors.push({
      code: ERROR_CODES.validatorContractsSummary.COUNT_MISMATCH,
      field: 'totalErrors',
      message: `totalErrors (${payload.totalErrors}) does not match computed value (${computedTotalErrors}).`,
    })
  }

  const expectedOverallStatus = statusCounts.fail > 0 ? 'fail' : (statusCounts.warning > 0 ? 'warning' : 'pass')
  if (ALLOWED_STATUSES.includes(payload.overallStatus) && payload.overallStatus !== expectedOverallStatus) {
    errors.push({
      code: ERROR_CODES.validatorContractsSummary.STATUS_MISMATCH,
      field: 'overallStatus',
      message: `overallStatus (${payload.overallStatus}) does not match computed status (${expectedOverallStatus}).`,
    })
  }

  if (uniqueTopCodes.join('|') !== uniqueAggregatedCodes.join('|')) {
    errors.push({
      code: ERROR_CODES.validatorContractsSummary.ERROR_CODES_MISMATCH,
      field: 'errorCodes',
      message: 'errorCodes must equal aggregated unique codes from checks[*].errorCodes in stable order.',
    })
  }

  return errors
}

const validate = (rawContent) => {
  return validateDetailed(rawContent).map((entry) => entry.message)
}

const main = () => {
  try {
    const args = parseArgs(process.argv.slice(2))
    const raw = readTextFile(args.file, 'validator contracts summary file')
    const result = buildResult({
      file: args.file,
      errors: validateDetailed(raw),
      extra: {
        supportedSchemaVersion: SUPPORTED_SCHEMA_VERSION,
      },
    })
    const exitCode = emitResult({
      result,
      output: args.output,
      successMessage: 'Validator contracts summary validation: passed.',
      failurePrefix: 'Validator contracts summary validation',
    })
    if (exitCode !== 0) process.exit(exitCode)
  } catch (error) {
    console.error(`Validator contracts summary validation: failed: ${String(error.message || error)}`)
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}

module.exports = {
  SUPPORTED_SCHEMA_VERSION,
  ALLOWED_STATUSES,
  parseArgs,
  validate,
  validateDetailed,
}
