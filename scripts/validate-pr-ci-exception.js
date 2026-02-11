const {
  readJsonFile,
} = require('./validation-utils')
const { ERROR_CODES } = require('./validator-error-codes')
const { buildResult, emitResult } = require('./validator-output')

const REQUIRED_FIELDS = [
  'Business reason',
  'Risk statement',
  'Rollback plan',
  'Owner',
  'Fix deadline (YYYY-MM-DD)',
]

const isTruthy = (value) => {
  const normalized = String(value || '').trim().toLowerCase()
  return normalized === 'true' || normalized === '1' || normalized === 'yes'
}

const parseArgs = (argv) => {
  const args = {
    output: 'text',
  }
  if (argv.includes('--json')) {
    args.output = 'json'
  }
  return args
}

const readPrBody = () => {
  const fromEnv = String(process.env.PR_BODY || '')
  if (fromEnv.trim()) return fromEnv

  const eventPath = process.env.GITHUB_EVENT_PATH
  if (!eventPath) return ''
  try {
    const payload = readJsonFile(eventPath, 'github event payload')
    return String(payload?.pull_request?.body || '')
  } catch {
    return ''
  }
}

const extractFieldValue = (body, fieldLabel) => {
  const escaped = fieldLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regexp = new RegExp(`^\\s*[-*]?\\s*${escaped}:\\s*(.*)\\s*$`, 'im')
  const match = body.match(regexp)
  return String(match?.[1] || '').trim()
}

const isPlaceholder = (value) => {
  const normalized = String(value || '').trim().toLowerCase()
  if (!normalized) return true
  return (
    normalized === 'tbd' ||
    normalized === 'n/a' ||
    normalized === 'na' ||
    normalized === '-' ||
    normalized === 'none' ||
    normalized === 'todo' ||
    normalized.startsWith('<') ||
    normalized.startsWith('[')
  )
}

const parseExceptionSection = (body) => {
  const requested = /-\s*\[[xX]\]\s*Exception requested/.test(body)
  const fields = Object.fromEntries(
    REQUIRED_FIELDS.map((label) => [label, extractFieldValue(body, label)])
  )
  return { requested, fields }
}

const validateException = ({ body, requireException }) => {
  const detailed = validateExceptionDetailed({ body, requireException })
  return {
    valid: detailed.valid,
    requested: detailed.requested,
    fields: detailed.fields,
    errors: detailed.errors.map((e) => e.message),
  }
}

const validateExceptionDetailed = ({ body, requireException }) => {
  const { requested, fields } = parseExceptionSection(body)
  const errors = []

  if (requireException && !requested) {
    errors.push({
      code: ERROR_CODES.prCiException.EXCEPTION_REQUIRED,
      field: 'Exception requested',
      message: 'Exception is required because CI gate failed, but "Exception requested" is not checked.',
    })
  }

  if (requested) {
    for (const label of REQUIRED_FIELDS) {
      const value = fields[label]
      if (isPlaceholder(value)) {
        errors.push({
          code: ERROR_CODES.prCiException.REQUIRED_FIELD_PLACEHOLDER,
          field: label,
          message: `Field "${label}" must be filled with a concrete value.`,
        })
      }
    }
  }

  return {
    valid: errors.length === 0,
    requested,
    fields,
    errors,
  }
}

const main = () => {
  const args = parseArgs(process.argv.slice(2))
  const body = readPrBody()
  const requireException = isTruthy(process.env.REQUIRE_EXCEPTION)
  const result = validateExceptionDetailed({ body, requireException })
  const outputResult = buildResult({
    errors: result.errors,
    extra: {
      requested: result.requested,
      requireException,
      fields: result.fields,
    },
  })

  if (args.output === 'json') {
    const exitCode = emitResult({
      result: outputResult,
      output: 'json',
    })
    if (exitCode !== 0) process.exit(exitCode)
    return
  }

  if (!result.requested && !requireException) {
    console.log('PR CI exception validation: no exception requested (not required).')
    return
  }

  const exitCode = emitResult({
    result: outputResult,
    output: 'text',
    successMessage: 'PR CI exception validation: passed.',
    failurePrefix: 'PR CI exception validation',
  })
  if (exitCode !== 0) process.exit(exitCode)
}

if (require.main === module) {
  main()
}

module.exports = {
  REQUIRED_FIELDS,
  parseArgs,
  parseExceptionSection,
  validateExceptionDetailed,
  validateException,
}
