const fs = require('fs')
const path = require('path')
const { parseFileArg, readTextFile } = require('./validation-utils')
const {
  TABLE_START_MARKER,
  TABLE_END_MARKER,
} = require('./validate-validator-error-codes-doc-table')
const { buildErrorCodesTable } = require('./summarize-validator-error-codes-doc-table')
const { ERROR_CODES } = require('./validator-error-codes')

const parseArgs = (argv) => {
  return parseFileArg(argv, 'docs/TESTING.md')
}

const updateTableBlock = (docsText) => {
  const text = String(docsText || '')
  const startIndex = text.indexOf(TABLE_START_MARKER)
  const endIndex = text.indexOf(TABLE_END_MARKER)

  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    throw new Error('Validator error-codes table markers are missing or invalid.')
  }

  const start = startIndex + TABLE_START_MARKER.length
  const before = text.slice(0, start)
  const after = text.slice(endIndex)
  const table = `\n${buildErrorCodesTable(ERROR_CODES)}`
  return `${before}${table}${after}`
}

const main = () => {
  const args = parseArgs(process.argv.slice(2))
  const resolved = path.resolve(process.cwd(), args.file)
  const docsText = readTextFile(args.file, 'testing docs file')
  const updated = updateTableBlock(docsText)
  fs.writeFileSync(resolved, updated, 'utf8')
  process.stdout.write(`Updated validator error-codes table in ${args.file}\n`)
}

if (require.main === module) {
  main()
}

module.exports = {
  parseArgs,
  updateTableBlock,
}
