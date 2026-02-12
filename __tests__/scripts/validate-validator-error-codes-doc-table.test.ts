const {
  TABLE_START_MARKER,
  TABLE_END_MARKER,
  parseArgs,
  extractTableBlock,
  validate,
  validateDetailed,
} = require('@/scripts/validate-validator-error-codes-doc-table')
const { buildErrorCodesTable } = require('@/scripts/summarize-validator-error-codes-doc-table')
const { ERROR_CODES } = require('@/scripts/validator-error-codes')

describe('validate-validator-error-codes-doc-table', () => {
  it('parses args with defaults and --json', () => {
    expect(parseArgs([])).toEqual({
      file: 'docs/TESTING.md',
      output: 'text',
    })
    expect(parseArgs(['--file', 'tmp/TESTING.md', '--json'])).toEqual({
      file: 'tmp/TESTING.md',
      output: 'json',
    })
  })

  it('extracts table block by markers', () => {
    const docs = [
      'Header',
      TABLE_START_MARKER,
      '| Namespace | Key | Code |',
      TABLE_END_MARKER,
      'Footer',
    ].join('\n')

    const extracted = extractTableBlock(docs)
    expect(extracted.found).toBe(true)
    expect(extracted.block).toContain('| Namespace | Key | Code |')
  })

  it('passes when docs table matches generated table', () => {
    const table = buildErrorCodesTable(ERROR_CODES).trim()
    const docs = [
      '## Some Section',
      TABLE_START_MARKER,
      table,
      TABLE_END_MARKER,
    ].join('\n')

    expect(validate(docs)).toEqual([])
  })

  it('fails when markers are missing', () => {
    const errors = validateDetailed('## Docs without markers')
    expect(errors.some((entry) => entry.code === 'ERROR_CODES_DOC_MISSING_MARKERS')).toBe(true)
  })

  it('fails when table content is outdated', () => {
    const docs = [
      '## Some Section',
      TABLE_START_MARKER,
      '| Namespace | Key | Code |',
      '| x | y | z |',
      TABLE_END_MARKER,
    ].join('\n')

    const errors = validateDetailed(docs)
    expect(errors.some((entry) => entry.code === 'ERROR_CODES_DOC_OUTDATED_TABLE')).toBe(true)
  })
})
