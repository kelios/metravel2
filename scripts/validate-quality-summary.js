const fs = require('fs')
const path = require('path')

const SUPPORTED_SCHEMA_VERSION = 1
const REQUIRED_STRING_FIELDS = ['failureClass', 'lintJobResult', 'smokeJobResult']
const REQUIRED_BOOLEAN_FIELDS = ['overallOk', 'lintOk', 'smokeOk', 'smokeDurationOverBudget', 'budgetBlocking']
const REQUIRED_NUMBER_FIELDS = ['smokeDurationSeconds', 'smokeDurationBudgetSeconds']
const OPTIONAL_FIELDS = [
  'recommendationId',
  'inconsistencies',
  'smokeSuiteFiles',
  'smokeSuiteBaselineProvided',
  'smokeSuiteAddedFiles',
  'smokeSuiteRemovedFiles',
]

const validate = (payload) => {
  const errors = []
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return ['Payload must be a JSON object.']
  }

  if (typeof payload.schemaVersion !== 'number' || !Number.isInteger(payload.schemaVersion)) {
    errors.push('Field "schemaVersion" must be an integer.')
  } else if (payload.schemaVersion !== SUPPORTED_SCHEMA_VERSION) {
    errors.push(
      `Unsupported schemaVersion: ${payload.schemaVersion}. Expected ${SUPPORTED_SCHEMA_VERSION}.`
    )
  }

  for (const key of REQUIRED_STRING_FIELDS) {
    if (typeof payload[key] !== 'string' || !payload[key].trim()) {
      errors.push(`Field "${key}" must be a non-empty string.`)
    }
  }

  for (const key of REQUIRED_BOOLEAN_FIELDS) {
    if (typeof payload[key] !== 'boolean') {
      errors.push(`Field "${key}" must be a boolean.`)
    }
  }

  for (const key of REQUIRED_NUMBER_FIELDS) {
    if (typeof payload[key] !== 'number' || !Number.isFinite(payload[key])) {
      errors.push(`Field "${key}" must be a finite number.`)
    }
  }

  if ('recommendationId' in payload) {
    if (payload.recommendationId !== null && typeof payload.recommendationId !== 'string') {
      errors.push('Field "recommendationId" must be string or null.')
    }
  } else {
    errors.push('Field "recommendationId" is required (string or null).')
  }

  if ('inconsistencies' in payload) {
    if (!Array.isArray(payload.inconsistencies) || payload.inconsistencies.some((v) => typeof v !== 'string')) {
      errors.push('Field "inconsistencies" must be an array of strings.')
    }
  } else {
    errors.push('Field "inconsistencies" is required.')
  }

  if ('smokeSuiteFiles' in payload) {
    if (!Array.isArray(payload.smokeSuiteFiles) || payload.smokeSuiteFiles.some((v) => typeof v !== 'string')) {
      errors.push('Field "smokeSuiteFiles" must be an array of strings when provided.')
    }
  }
  if ('smokeSuiteBaselineProvided' in payload && typeof payload.smokeSuiteBaselineProvided !== 'boolean') {
    errors.push('Field "smokeSuiteBaselineProvided" must be a boolean when provided.')
  }
  if ('smokeSuiteAddedFiles' in payload) {
    if (!Array.isArray(payload.smokeSuiteAddedFiles) || payload.smokeSuiteAddedFiles.some((v) => typeof v !== 'string')) {
      errors.push('Field "smokeSuiteAddedFiles" must be an array of strings when provided.')
    }
  }
  if ('smokeSuiteRemovedFiles' in payload) {
    if (!Array.isArray(payload.smokeSuiteRemovedFiles) || payload.smokeSuiteRemovedFiles.some((v) => typeof v !== 'string')) {
      errors.push('Field "smokeSuiteRemovedFiles" must be an array of strings when provided.')
    }
  }

  const knownFields = new Set([
    'schemaVersion',
    ...REQUIRED_STRING_FIELDS,
    ...REQUIRED_BOOLEAN_FIELDS,
    ...REQUIRED_NUMBER_FIELDS,
    ...OPTIONAL_FIELDS,
  ])
  const extraFields = Object.keys(payload).filter((k) => !knownFields.has(k))
  if (extraFields.length > 0) {
    // Non-blocking, but visible to keep schema drift explicit.
    errors.push(`Unexpected fields present: ${extraFields.join(', ')}`)
  }

  return errors
}

const main = () => {
  const inputPath = process.argv[2] || 'test-results/quality-summary.json'
  const resolved = path.resolve(process.cwd(), inputPath)
  if (!fs.existsSync(resolved)) {
    console.error(`quality-summary validation failed: file not found: ${inputPath}`)
    process.exit(1)
  }

  let payload
  try {
    payload = JSON.parse(fs.readFileSync(resolved, 'utf8'))
  } catch (error) {
    console.error(`quality-summary validation failed: cannot parse JSON: ${String(error)}`)
    process.exit(1)
  }

  const errors = validate(payload)
  if (errors.length > 0) {
    console.error('quality-summary validation failed:')
    errors.forEach((e) => console.error(`- ${e}`))
    process.exit(1)
  }

  console.log('quality-summary validation passed.')
}

if (require.main === module) {
  main()
}

module.exports = {
  SUPPORTED_SCHEMA_VERSION,
  validate,
}
