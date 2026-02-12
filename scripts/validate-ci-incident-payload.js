const {
  parseFileArg,
  readJsonFile,
} = require('./validation-utils')
const { ERROR_CODES } = require('./validator-error-codes')
const { buildResult, emitResult } = require('./validator-output')

const ALLOWED_FAILURE_CLASSES = new Set([
  'infra_artifact',
  'inconsistent_state',
  'lint_only',
  'smoke_only',
  'mixed',
  'performance_budget',
  'selective_contract',
])

const ALLOWED_ARTIFACT_SOURCES = new Set(['explicit', 'run_id', 'fallback', 'none'])

const parseArgs = (argv) => {
  const args = {
    ...parseFileArg(argv, 'test-results/ci-incident-payload.json'),
    output: 'text',
  }
  if (argv.includes('--json')) {
    args.output = 'json'
  }
  return args
}

const readIncidentPayload = (filePath) => {
  return readJsonFile(filePath, 'incident payload file')
}

const validateDetailed = (payload) => {
  const errors = []
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    errors.push({
      code: ERROR_CODES.incidentPayload.INVALID_PAYLOAD_OBJECT,
      field: 'payload',
      message: 'Incident payload must be an object.',
    })
    return errors
  }

  const failureClass = String(payload.failureClass || '').trim()
  if (!ALLOWED_FAILURE_CLASSES.has(failureClass)) {
    errors.push({
      code: ERROR_CODES.incidentPayload.INVALID_FAILURE_CLASS,
      field: 'failureClass',
      message: 'Field "failureClass" must be one of allowed classes.',
    })
  }

  const recommendationId = String(payload.recommendationId || '').trim()
  if (!/^QG-\d{3}$/.test(recommendationId)) {
    errors.push({
      code: ERROR_CODES.incidentPayload.INVALID_RECOMMENDATION_ID,
      field: 'recommendationId',
      message: 'Field "recommendationId" must be a concrete QG id (e.g., QG-004).',
    })
  }

  const artifactSource = String(payload.artifactSource || '').trim()
  if (!ALLOWED_ARTIFACT_SOURCES.has(artifactSource)) {
    errors.push({
      code: ERROR_CODES.incidentPayload.INVALID_ARTIFACT_SOURCE,
      field: 'artifactSource',
      message: 'Field "artifactSource" must be one of: explicit, run_id, fallback, none.',
    })
  }

  const artifactUrl = String(payload.artifactUrl || '').trim()
  if (artifactSource === 'none' && artifactUrl) {
    errors.push({
      code: ERROR_CODES.incidentPayload.INCONSISTENT_ARTIFACT_URL,
      field: 'artifactUrl',
      message: 'Field "artifactUrl" must be empty when artifactSource is "none".',
    })
  }

  if ((artifactSource === 'explicit' || artifactSource === 'run_id') && !artifactUrl) {
    errors.push({
      code: ERROR_CODES.incidentPayload.INCONSISTENT_ARTIFACT_URL,
      field: 'artifactUrl',
      message: 'Field "artifactUrl" must be non-empty when artifactSource is "explicit" or "run_id".',
    })
  }

  if (artifactSource === 'fallback' && failureClass !== 'selective_contract') {
    errors.push({
      code: ERROR_CODES.incidentPayload.INCONSISTENT_ARTIFACT_SOURCE,
      field: 'artifactSource',
      message: 'Field "artifactSource" value "fallback" is allowed only for selective_contract failures.',
    })
  }

  if (failureClass === 'selective_contract' && artifactSource === 'none') {
    errors.push({
      code: ERROR_CODES.incidentPayload.INCONSISTENT_ARTIFACT_SOURCE,
      field: 'artifactSource',
      message: 'Selective contract incidents must use artifactSource explicit, run_id, or fallback.',
    })
  }

  const markdown = String(payload.markdown || '')
  const artifactLine = /^-\s*Selective decisions artifact:\s*(.+)\s*$/m.exec(markdown)?.[1]?.trim() || ''
  if (artifactUrl && artifactLine !== artifactUrl) {
    errors.push({
      code: ERROR_CODES.incidentPayload.INCONSISTENT_MARKDOWN_ARTIFACT,
      field: 'markdown',
      message: 'Markdown selective decisions artifact line must match "artifactUrl".',
    })
  }
  if (!artifactUrl && artifactLine) {
    errors.push({
      code: ERROR_CODES.incidentPayload.INCONSISTENT_MARKDOWN_ARTIFACT,
      field: 'markdown',
      message: 'Markdown must not include selective decisions artifact line when "artifactUrl" is empty.',
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
    const payload = readIncidentPayload(args.file)
    const errors = validateDetailed(payload)
    const result = buildResult({ file: args.file, errors })
    const exitCode = emitResult({
      result,
      output: args.output,
      successMessage: 'CI incident payload validation: passed.',
      failurePrefix: 'CI incident payload validation',
    })
    if (exitCode !== 0) process.exit(exitCode)
  } catch (error) {
    console.error(`CI incident payload validation: failed: ${String(error.message || error)}`)
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}

module.exports = {
  ALLOWED_FAILURE_CLASSES,
  ALLOWED_ARTIFACT_SOURCES,
  parseArgs,
  readIncidentPayload,
  validate,
  validateDetailed,
}
