const VALIDATOR_CONTRACT_VERSION = 1

const normalizeErrors = (errors) => {
  if (!Array.isArray(errors)) return []
  return errors.map((error) => {
    if (error && typeof error === 'object') {
      return {
        code: String(error.code || 'VALIDATION_ERROR'),
        field: String(error.field || 'unknown'),
        message: String(error.message || 'Validation error'),
      }
    }
    return {
      code: 'VALIDATION_ERROR',
      field: 'unknown',
      message: String(error),
    }
  })
}

const buildResult = ({ file = '', errors = [], extra = {} }) => {
  const normalizedErrors = normalizeErrors(errors)
  return {
    contractVersion: VALIDATOR_CONTRACT_VERSION,
    ok: normalizedErrors.length === 0,
    ...(file ? { file } : {}),
    errorCount: normalizedErrors.length,
    errors: normalizedErrors,
    ...extra,
  }
}

const emitResult = ({
  result,
  output = 'text',
  successMessage = 'Validation: passed.',
  failurePrefix = 'Validation',
}) => {
  if (output === 'json') {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
    return result.ok ? 0 : 1
  }

  if (result.ok) {
    console.log(successMessage)
    return 0
  }

  console.log(`${failurePrefix}: failed.`)
  result.errors.forEach((error) => console.log(`- ${error.message}`))
  return 1
}

module.exports = {
  VALIDATOR_CONTRACT_VERSION,
  normalizeErrors,
  buildResult,
  emitResult,
}
