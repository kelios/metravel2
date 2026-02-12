const {
  parseFileArg,
  readTextFile,
  extractMarkdownLineValue,
} = require('./validation-utils')
const { ERROR_CODES } = require('./validator-error-codes')
const { buildResult, emitResult } = require('./validator-output')
const { isConcreteValue, isHttpUrl } = require('./validation-rules')

const ALLOWED_FAILURE_CLASSES = new Set([
  'infra_artifact',
  'inconsistent_state',
  'lint_only',
  'smoke_only',
  'mixed',
  'performance_budget',
  'selective_contract',
])

const parseArgs = (argv) => {
  const args = {
    ...parseFileArg(argv, 'test-results/ci-incident-snippet.md'),
    output: 'text',
  }
  if (argv.includes('--json')) {
    args.output = 'json'
  }
  return args
}

const readIncident = (filePath) => {
  return readTextFile(filePath, 'incident file')
}

const extractLineValue = (markdown, label) => {
  return extractMarkdownLineValue(markdown, label)
}

const isPlaceholder = (value) => {
  return !isConcreteValue(value)
}

const validateDetailed = (markdown) => {
  const errors = []
  if (!/^###\s+CI Smoke Incident\s*$/m.test(markdown)) {
    errors.push({
      code: ERROR_CODES.incidentSnippet.MISSING_HEADER,
      field: 'header',
      message: 'Missing header: "### CI Smoke Incident".',
    })
  }

  const workflowRun = extractLineValue(markdown, 'Workflow run')
  if (!isHttpUrl(workflowRun)) {
    errors.push({
      code: ERROR_CODES.incidentSnippet.INVALID_WORKFLOW_RUN,
      field: 'Workflow run',
      message: 'Field "Workflow run" must be a valid URL.',
    })
  }

  const branchPr = extractLineValue(markdown, 'Branch / PR')
  if (!isHttpUrl(branchPr)) {
    errors.push({
      code: ERROR_CODES.incidentSnippet.INVALID_BRANCH_PR,
      field: 'Branch / PR',
      message: 'Field "Branch / PR" must be a valid URL.',
    })
  }

  const failureClass = extractLineValue(markdown, 'Failure Class')
  if (!ALLOWED_FAILURE_CLASSES.has(failureClass)) {
    errors.push({
      code: ERROR_CODES.incidentSnippet.INVALID_FAILURE_CLASS,
      field: 'Failure Class',
      message: 'Field "Failure Class" must be one of allowed classes.',
    })
  }

  const recommendationId = extractLineValue(markdown, 'Recommendation ID')
  if (!/^QG-\d{3}$/.test(recommendationId)) {
    errors.push({
      code: ERROR_CODES.incidentSnippet.INVALID_RECOMMENDATION_ID,
      field: 'Recommendation ID',
      message: 'Field "Recommendation ID" must be a concrete QG id (e.g., QG-004).',
    })
  }

  if (failureClass === 'selective_contract') {
    const followUp = extractLineValue(markdown, 'Follow-up required')
    const selectiveArtifact = extractLineValue(markdown, 'Selective decisions artifact')
    const hasFollowUpReference = /selective-decisions artifact/i.test(followUp)
    const hasArtifactReference = isHttpUrl(selectiveArtifact)
    if (!hasFollowUpReference && !hasArtifactReference) {
      errors.push({
        code: ERROR_CODES.incidentSnippet.MISSING_SELECTIVE_REFERENCE,
        field: 'selective decisions reference',
        message: 'Selective contract incidents must reference selective-decisions artifact in follow-up or dedicated artifact line.',
      })
    }
  }

  return errors
}

const validate = (markdown) => {
  return validateDetailed(markdown).map((e) => e.message)
}

const main = () => {
  try {
    const args = parseArgs(process.argv.slice(2))
    const markdown = readIncident(args.file)
    const errors = validateDetailed(markdown)
    const result = buildResult({ file: args.file, errors })
    const exitCode = emitResult({
      result,
      output: args.output,
      successMessage: 'CI incident snippet validation: passed.',
      failurePrefix: 'CI incident snippet validation',
    })
    if (exitCode !== 0) process.exit(exitCode)
  } catch (error) {
    console.error(`CI incident snippet validation: failed: ${String(error.message || error)}`)
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}

module.exports = {
  ALLOWED_FAILURE_CLASSES,
  parseArgs,
  readIncident,
  extractLineValue,
  isPlaceholder,
  validate,
  validateDetailed,
}
