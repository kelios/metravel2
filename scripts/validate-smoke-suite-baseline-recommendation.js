const {
  parseFileArg,
  readJsonFile,
} = require('./validation-utils')
const { ERROR_CODES } = require('./validator-error-codes')
const { buildResult, emitResult } = require('./validator-output')

const parseArgs = (argv) => {
  const args = {
    ...parseFileArg(argv, 'test-results/smoke-suite-baseline-recommendation.json'),
    output: 'text',
  }
  if (argv.includes('--json')) {
    args.output = 'json'
  }
  return args
}

const readRecommendation = (filePath) => {
  return readJsonFile(filePath, 'recommendation file')
}

const validateDetailed = (payload) => {
  const errors = []
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    errors.push({
      code: ERROR_CODES.suiteBaselineRecommendation.INVALID_PAYLOAD_OBJECT,
      field: 'payload',
      message: 'Recommendation payload must be an object.',
    })
    return errors
  }

  const sourceSnapshot = String(payload.sourceSnapshot || '').trim()
  if (!sourceSnapshot) {
    errors.push({
      code: ERROR_CODES.suiteBaselineRecommendation.INVALID_SOURCE_SNAPSHOT,
      field: 'sourceSnapshot',
      message: 'Field "sourceSnapshot" must be a non-empty string.',
    })
  }

  const suiteCount = Number(payload.suiteCount)
  if (!Number.isInteger(suiteCount) || suiteCount <= 0) {
    errors.push({
      code: ERROR_CODES.suiteBaselineRecommendation.INVALID_SUITE_COUNT,
      field: 'suiteCount',
      message: 'Field "suiteCount" must be a positive integer.',
    })
  }

  const format = String(payload.format || '').trim()
  if (format !== 'json' && format !== 'csv') {
    errors.push({
      code: ERROR_CODES.suiteBaselineRecommendation.INVALID_FORMAT,
      field: 'format',
      message: 'Field "format" must be "json" or "csv".',
    })
  }

  const baselineValue = String(payload.baselineValue || '').trim()
  if (!baselineValue) {
    errors.push({
      code: ERROR_CODES.suiteBaselineRecommendation.INVALID_BASELINE_VALUE_EMPTY,
      field: 'baselineValue',
      message: 'Field "baselineValue" must be a non-empty string.',
    })
  } else if (format === 'json') {
    try {
      const parsed = JSON.parse(baselineValue)
      if (!Array.isArray(parsed) || parsed.length === 0 || !parsed.every((v) => String(v).trim().length > 0)) {
        errors.push({
          code: ERROR_CODES.suiteBaselineRecommendation.INVALID_BASELINE_VALUE_JSON_ARRAY,
          field: 'baselineValue',
          message: 'Field "baselineValue" (json format) must be a non-empty JSON array of non-empty strings.',
        })
      }
    } catch {
      errors.push({
        code: ERROR_CODES.suiteBaselineRecommendation.INVALID_BASELINE_VALUE_JSON_PARSE,
        field: 'baselineValue',
        message: 'Field "baselineValue" must be valid JSON array string when format is "json".',
      })
    }
  } else if (format === 'csv') {
    const items = baselineValue
      .split(',')
      .map((v) => String(v).trim())
      .filter(Boolean)
    if (items.length === 0) {
      errors.push({
        code: ERROR_CODES.suiteBaselineRecommendation.INVALID_BASELINE_VALUE_CSV,
        field: 'baselineValue',
        message: 'Field "baselineValue" (csv format) must contain at least one value.',
      })
    }
  }

  const ghCommand = String(payload.ghCommand || '').trim()
  if (!ghCommand) {
    errors.push({
      code: ERROR_CODES.suiteBaselineRecommendation.INVALID_GH_COMMAND_EMPTY,
      field: 'ghCommand',
      message: 'Field "ghCommand" must be a non-empty string.',
    })
  } else if (!ghCommand.includes('gh variable set SMOKE_SUITE_FILES_BASELINE --body')) {
    errors.push({
      code: ERROR_CODES.suiteBaselineRecommendation.INVALID_GH_COMMAND_CONTENT,
      field: 'ghCommand',
      message: 'Field "ghCommand" must contain SMOKE_SUITE_FILES_BASELINE update command.',
    })
  }

  return errors
}

const validate = (payload) => {
  return validateDetailed(payload).map((e) => e.message)
}

const main = () => {
  try {
    const args = parseArgs(process.argv.slice(2))
    const payload = readRecommendation(args.file)
    const errors = validateDetailed(payload)
    const result = buildResult({ file: args.file, errors })
    const exitCode = emitResult({
      result,
      output: args.output,
      successMessage: 'Smoke suite baseline recommendation validation: passed.',
      failurePrefix: 'Smoke suite baseline recommendation validation',
    })
    if (exitCode !== 0) process.exit(exitCode)
  } catch (error) {
    console.error(`Smoke suite baseline recommendation validation: failed: ${String(error.message || error)}`)
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}

module.exports = {
  parseArgs,
  readRecommendation,
  validate,
  validateDetailed,
}
