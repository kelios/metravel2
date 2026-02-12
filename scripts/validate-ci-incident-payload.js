const {
  parseFileArg,
  readJsonFile,
} = require('./validation-utils')
const { ERROR_CODES } = require('./validator-error-codes')
const { buildResult, emitResult } = require('./validator-output')

const SUPPORTED_SCHEMA_VERSION = 1
const ALLOWED_FAILURE_CLASSES = new Set([
  'infra_artifact',
  'inconsistent_state',
  'lint_only',
  'smoke_only',
  'mixed',
  'performance_budget',
  'selective_contract',
  'validator_contract',
  'config_contract',
])

const ALLOWED_ARTIFACT_SOURCES = new Set(['explicit', 'run_id', 'fallback', 'none'])
const ALLOWED_PRIMARY_ARTIFACT_KINDS = new Set(['none', 'selective_decisions', 'validator_contracts', 'runtime_config_diagnostics'])

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

  const schemaVersion = payload.schemaVersion
  if (!Number.isInteger(schemaVersion) || schemaVersion !== SUPPORTED_SCHEMA_VERSION) {
    errors.push({
      code: ERROR_CODES.incidentPayload.INVALID_SCHEMA_VERSION,
      field: 'schemaVersion',
      message: `Field "schemaVersion" must be integer ${SUPPORTED_SCHEMA_VERSION}.`,
    })
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

  const primaryArtifactKind = String(payload.primaryArtifactKind || '').trim()
  if (!ALLOWED_PRIMARY_ARTIFACT_KINDS.has(primaryArtifactKind)) {
    errors.push({
      code: ERROR_CODES.incidentPayload.INVALID_PRIMARY_ARTIFACT_KIND,
      field: 'primaryArtifactKind',
      message: 'Field "primaryArtifactKind" must be one of: none, selective_decisions, validator_contracts, runtime_config_diagnostics.',
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
  if (failureClass === 'selective_contract' && primaryArtifactKind !== 'selective_decisions') {
    errors.push({
      code: ERROR_CODES.incidentPayload.INCONSISTENT_PRIMARY_ARTIFACT_KIND,
      field: 'primaryArtifactKind',
      message: 'Selective contract incidents must use primaryArtifactKind "selective_decisions".',
    })
  }

  const validatorArtifactSource = String(payload.validatorArtifactSource || '').trim()
  if (validatorArtifactSource && !ALLOWED_ARTIFACT_SOURCES.has(validatorArtifactSource)) {
    errors.push({
      code: ERROR_CODES.incidentPayload.INVALID_ARTIFACT_SOURCE,
      field: 'validatorArtifactSource',
      message: 'Field "validatorArtifactSource" must be one of: explicit, run_id, fallback, none.',
    })
  }

  const validatorArtifactUrl = String(payload.validatorArtifactUrl || '').trim()
  if ((validatorArtifactSource === 'none' || !validatorArtifactSource) && validatorArtifactUrl) {
    errors.push({
      code: ERROR_CODES.incidentPayload.INCONSISTENT_VALIDATOR_ARTIFACT_URL,
      field: 'validatorArtifactUrl',
      message: 'Field "validatorArtifactUrl" must be empty when validatorArtifactSource is "none" or empty.',
    })
  }

  if ((validatorArtifactSource === 'explicit' || validatorArtifactSource === 'run_id') && !validatorArtifactUrl) {
    errors.push({
      code: ERROR_CODES.incidentPayload.INCONSISTENT_VALIDATOR_ARTIFACT_URL,
      field: 'validatorArtifactUrl',
      message: 'Field "validatorArtifactUrl" must be non-empty when validatorArtifactSource is "explicit" or "run_id".',
    })
  }

  if (validatorArtifactSource === 'fallback' && failureClass !== 'validator_contract') {
    errors.push({
      code: ERROR_CODES.incidentPayload.INCONSISTENT_VALIDATOR_ARTIFACT_SOURCE,
      field: 'validatorArtifactSource',
      message: 'Field "validatorArtifactSource" value "fallback" is allowed only for validator_contract failures.',
    })
  }

  if (failureClass === 'validator_contract' && (validatorArtifactSource === 'none' || !validatorArtifactSource)) {
    errors.push({
      code: ERROR_CODES.incidentPayload.INCONSISTENT_VALIDATOR_ARTIFACT_SOURCE,
      field: 'validatorArtifactSource',
      message: 'Validator contract incidents must use validatorArtifactSource explicit, run_id, or fallback.',
    })
  }
  if (failureClass === 'validator_contract' && primaryArtifactKind !== 'validator_contracts') {
    errors.push({
      code: ERROR_CODES.incidentPayload.INCONSISTENT_PRIMARY_ARTIFACT_KIND,
      field: 'primaryArtifactKind',
      message: 'Validator contract incidents must use primaryArtifactKind "validator_contracts".',
    })
  }
  if (failureClass === 'config_contract' && primaryArtifactKind !== 'runtime_config_diagnostics') {
    errors.push({
      code: ERROR_CODES.incidentPayload.INCONSISTENT_PRIMARY_ARTIFACT_KIND,
      field: 'primaryArtifactKind',
      message: 'Config contract incidents must use primaryArtifactKind "runtime_config_diagnostics".',
    })
  }
  if (
    failureClass !== 'selective_contract'
    && failureClass !== 'validator_contract'
    && failureClass !== 'config_contract'
    && primaryArtifactKind !== 'none'
  ) {
    errors.push({
      code: ERROR_CODES.incidentPayload.INCONSISTENT_PRIMARY_ARTIFACT_KIND,
      field: 'primaryArtifactKind',
      message: 'Non-contract incidents must use primaryArtifactKind "none".',
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

  const validatorArtifactLine = /^-\s*Validator contracts artifact:\s*(.+)\s*$/m.exec(markdown)?.[1]?.trim() || ''
  if (validatorArtifactUrl && validatorArtifactLine !== validatorArtifactUrl) {
    errors.push({
      code: ERROR_CODES.incidentPayload.INCONSISTENT_MARKDOWN_VALIDATOR_ARTIFACT,
      field: 'markdown',
      message: 'Markdown validator contracts artifact line must match "validatorArtifactUrl".',
    })
  }
  if (!validatorArtifactUrl && validatorArtifactLine) {
    errors.push({
      code: ERROR_CODES.incidentPayload.INCONSISTENT_MARKDOWN_VALIDATOR_ARTIFACT,
      field: 'markdown',
      message: 'Markdown must not include validator contracts artifact line when "validatorArtifactUrl" is empty.',
    })
  }

  const runtimeArtifactSource = String(payload.runtimeArtifactSource || '').trim()
  if (runtimeArtifactSource && !ALLOWED_ARTIFACT_SOURCES.has(runtimeArtifactSource)) {
    errors.push({
      code: ERROR_CODES.incidentPayload.INVALID_ARTIFACT_SOURCE,
      field: 'runtimeArtifactSource',
      message: 'Field "runtimeArtifactSource" must be one of: explicit, run_id, fallback, none.',
    })
  }

  const runtimeArtifactUrl = String(payload.runtimeArtifactUrl || '').trim()
  if ((runtimeArtifactSource === 'none' || !runtimeArtifactSource) && runtimeArtifactUrl) {
    errors.push({
      code: ERROR_CODES.incidentPayload.INCONSISTENT_ARTIFACT_URL,
      field: 'runtimeArtifactUrl',
      message: 'Field "runtimeArtifactUrl" must be empty when runtimeArtifactSource is "none" or empty.',
    })
  }
  if ((runtimeArtifactSource === 'explicit' || runtimeArtifactSource === 'run_id') && !runtimeArtifactUrl) {
    errors.push({
      code: ERROR_CODES.incidentPayload.INCONSISTENT_ARTIFACT_URL,
      field: 'runtimeArtifactUrl',
      message: 'Field "runtimeArtifactUrl" must be non-empty when runtimeArtifactSource is "explicit" or "run_id".',
    })
  }
  if (runtimeArtifactSource === 'fallback' && failureClass !== 'config_contract') {
    errors.push({
      code: ERROR_CODES.incidentPayload.INCONSISTENT_ARTIFACT_SOURCE,
      field: 'runtimeArtifactSource',
      message: 'Field "runtimeArtifactSource" value "fallback" is allowed only for config_contract failures.',
    })
  }
  if (failureClass === 'config_contract' && (runtimeArtifactSource === 'none' || !runtimeArtifactSource)) {
    errors.push({
      code: ERROR_CODES.incidentPayload.INCONSISTENT_ARTIFACT_SOURCE,
      field: 'runtimeArtifactSource',
      message: 'Config contract incidents must use runtimeArtifactSource explicit, run_id, or fallback.',
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
  SUPPORTED_SCHEMA_VERSION,
  ALLOWED_FAILURE_CLASSES,
  ALLOWED_ARTIFACT_SOURCES,
  ALLOWED_PRIMARY_ARTIFACT_KINDS,
  parseArgs,
  readIncidentPayload,
  validate,
  validateDetailed,
}
