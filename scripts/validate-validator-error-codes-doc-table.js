const { parseFileArg, readTextFile } = require('./validation-utils')
const { buildResult, emitResult } = require('./validator-output')
const { ERROR_CODES } = require('./validator-error-codes')
const { buildErrorCodesTable } = require('./summarize-validator-error-codes-doc-table')

const DEFAULT_DOCS_FILE = 'docs/TESTING.md'
const TABLE_START_MARKER = '<!-- validator-error-codes-table:start -->'
const TABLE_END_MARKER = '<!-- validator-error-codes-table:end -->'
const UPDATE_COMMAND = 'yarn validator:error-codes:docs:update'

const parseArgs = (argv) => {
  const args = {
    ...parseFileArg(argv, DEFAULT_DOCS_FILE),
    output: 'text',
  }
  if (argv.includes('--json')) {
    args.output = 'json'
  }
  return args
}

const extractTableBlock = (docsText) => {
  const text = String(docsText || '')
  const startIndex = text.indexOf(TABLE_START_MARKER)
  const endIndex = text.indexOf(TABLE_END_MARKER)

  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    return { found: false, block: '' }
  }

  const start = startIndex + TABLE_START_MARKER.length
  const block = text.slice(start, endIndex)
  return { found: true, block }
}

const validateDetailed = (docsText) => {
  const errors = []
  const extracted = extractTableBlock(docsText)
  if (!extracted.found) {
    errors.push({
      code: ERROR_CODES.errorCodesDoc.MISSING_MARKERS,
      field: 'docs-table-markers',
      message: 'Validator error-codes table markers are missing in docs/TESTING.md.',
    })
    return errors
  }

  const expected = buildErrorCodesTable(ERROR_CODES).trim()
  const actual = String(extracted.block || '').trim()
  if (actual !== expected) {
    errors.push({
      code: ERROR_CODES.errorCodesDoc.OUTDATED_TABLE,
      field: 'docs-table-content',
      message: `Validator error-codes table in ${DEFAULT_DOCS_FILE} is outdated. Run: ${UPDATE_COMMAND}`,
    })
  }

  return errors
}

const validate = (docsText) => {
  return validateDetailed(docsText).map((entry) => entry.message)
}

const main = () => {
  try {
    const args = parseArgs(process.argv.slice(2))
    const docsText = readTextFile(args.file, 'testing docs file')
    const errors = validateDetailed(docsText)
    const result = buildResult({ file: args.file, errors })
    const exitCode = emitResult({
      result,
      output: args.output,
      successMessage: 'Validator error-codes docs table validation: passed.',
      failurePrefix: 'Validator error-codes docs table validation',
    })
    if (exitCode !== 0) process.exit(exitCode)
  } catch (error) {
    console.error(`Validator error-codes docs table validation: failed: ${String(error.message || error)}`)
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}

module.exports = {
  DEFAULT_DOCS_FILE,
  TABLE_START_MARKER,
  TABLE_END_MARKER,
  UPDATE_COMMAND,
  parseArgs,
  extractTableBlock,
  validate,
  validateDetailed,
}
