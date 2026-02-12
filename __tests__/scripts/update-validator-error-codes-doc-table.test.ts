const fs = require('fs')
const os = require('os')
const path = require('path')
const { parseArgs, updateTableBlock } = require('@/scripts/update-validator-error-codes-doc-table')
const {
  TABLE_START_MARKER,
  TABLE_END_MARKER,
} = require('@/scripts/validate-validator-error-codes-doc-table')

describe('update-validator-error-codes-doc-table', () => {
  it('parses args with default and override file', () => {
    expect(parseArgs([])).toEqual({ file: 'docs/TESTING.md' })
    expect(parseArgs(['--file', 'tmp/TESTING.md'])).toEqual({ file: 'tmp/TESTING.md' })
  })

  it('updates table block and stays idempotent', () => {
    const initial = [
      '# Test doc',
      TABLE_START_MARKER,
      '| Namespace | Key | Code |',
      '| stale | stale | stale |',
      TABLE_END_MARKER,
      '',
    ].join('\n')

    const updated = updateTableBlock(initial)
    const updatedAgain = updateTableBlock(updated)

    expect(updated).toContain('| Namespace | Key | Code |')
    expect(updated).not.toContain('| stale | stale | stale |')
    expect(updatedAgain).toBe(updated)
  })

  it('throws when markers are missing', () => {
    expect(() => updateTableBlock('# no markers')).toThrow('markers are missing or invalid')
  })

  it('updates file content through script main flow', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'update-error-codes-table-'))
    const docsPath = path.join(dir, 'TESTING.md')
    fs.writeFileSync(docsPath, [
      '# Title',
      TABLE_START_MARKER,
      '| old | old | old |',
      TABLE_END_MARKER,
      '',
    ].join('\n'), 'utf8')

    const before = fs.readFileSync(docsPath, 'utf8')
    const after = updateTableBlock(before)
    fs.writeFileSync(docsPath, after, 'utf8')

    const content = fs.readFileSync(docsPath, 'utf8')
    expect(content).toContain('| Namespace | Key | Code |')
    expect(content).not.toContain('| old | old | old |')

    fs.rmSync(dir, { recursive: true, force: true })
  })
})
