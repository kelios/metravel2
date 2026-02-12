const {
  parseFileArg,
  readTextFile,
  extractMarkdownLineValue,
} = require('./validation-utils')
const { buildResult, emitResult } = require('./validator-output')
const { isConcreteValue, isHttpUrl } = require('./validation-rules')
const { ERROR_CODES } = require('./validator-error-codes')

const MARKER = '<!-- validator-guard-comment -->'
const ALLOWED_STATUSES = ['PASS', 'FAIL']
const REQUIRED_LABELS = ['Status', 'Reason', 'Workflow run', 'Guard artifact']

const parseArgs = (argv) => {
  const args = {
    ...parseFileArg(argv, 'test-results/validator-guard-comment-publish.md'),
    output: 'text',
  }
  if (argv.includes('--json')) {
    args.output = 'json'
  }
  return args
}

const extractLineValue = (markdown, label) => {
  return extractMarkdownLineValue(markdown, label)
}

const validateDetailed = (markdown) => {
  const errors = []
  const text = String(markdown || '')

  if (!text.includes(MARKER)) {
    errors.push({
      code: ERROR_CODES.validatorGuardComment.MISSING_MARKER,
      field: 'marker',
      message: 'Missing marker: "<!-- validator-guard-comment -->".',
    })
  }

  if (!/^###\s+Validator Guard Comment\s*$/m.test(text)) {
    errors.push({
      code: ERROR_CODES.validatorGuardComment.MISSING_HEADER,
      field: 'header',
      message: 'Missing header: "### Validator Guard Comment".',
    })
  }

  const status = extractLineValue(text, 'Status')
  if (!ALLOWED_STATUSES.includes(status)) {
    errors.push({
      code: ERROR_CODES.validatorGuardComment.INVALID_STATUS,
      field: 'Status',
      message: 'Field "Status" must be PASS or FAIL.',
    })
  }

  const reason = extractLineValue(text, 'Reason')
  if (!isConcreteValue(reason)) {
    errors.push({
      code: ERROR_CODES.validatorGuardComment.INVALID_REASON,
      field: 'Reason',
      message: 'Field "Reason" must be a concrete value.',
    })
  }

  const workflowRun = extractLineValue(text, 'Workflow run')
  if (!isHttpUrl(workflowRun)) {
    errors.push({
      code: ERROR_CODES.validatorGuardComment.INVALID_WORKFLOW_RUN,
      field: 'Workflow run',
      message: 'Field "Workflow run" must be a valid URL.',
    })
  }

  const guardArtifact = extractLineValue(text, 'Guard artifact')
  if (!isHttpUrl(guardArtifact)) {
    errors.push({
      code: ERROR_CODES.validatorGuardComment.INVALID_GUARD_ARTIFACT,
      field: 'Guard artifact',
      message: 'Field "Guard artifact" must be a valid URL.',
    })
  }

  return errors
}

const validate = (markdown) => {
  return validateDetailed(markdown).map((error) => error.message)
}

const main = () => {
  try {
    const args = parseArgs(process.argv.slice(2))
    const markdown = readTextFile(args.file, 'validator guard comment file')
    const result = buildResult({
      file: args.file,
      errors: validateDetailed(markdown),
    })
    const exitCode = emitResult({
      result,
      output: args.output,
      successMessage: 'Validator guard comment validation: passed.',
      failurePrefix: 'Validator guard comment validation',
    })
    if (exitCode !== 0) process.exit(exitCode)
  } catch (error) {
    console.error(`Validator guard comment validation: failed: ${String(error.message || error)}`)
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}

module.exports = {
  MARKER,
  ALLOWED_STATUSES,
  REQUIRED_LABELS,
  parseArgs,
  extractLineValue,
  validate,
  validateDetailed,
}
