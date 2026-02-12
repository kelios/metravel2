const fs = require('fs')
const path = require('path')
const { makeTempDir, writeJsonFile, writeTextFile } = require('./cli-test-utils')
const {
  resolveFromCwd,
  readJsonFileWithStatus,
  appendLinesToStepSummary,
} = require('@/scripts/summary-utils')

describe('summary-utils', () => {
  it('resolves file path from cwd', () => {
    const resolved = resolveFromCwd('test-results/a.json')
    expect(resolved).toContain(path.join(process.cwd(), 'test-results', 'a.json'))
  })

  it('reads json payload with success status', () => {
    const dir = makeTempDir('summary-utils-')
    const file = path.join(dir, 'payload.json')
    writeJsonFile(file, { ok: true })
    const result = readJsonFileWithStatus(file)
    expect(result.ok).toBe(true)
    expect(result.payload).toEqual({ ok: true })
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('returns missing status for absent file', () => {
    const dir = makeTempDir('summary-utils-')
    const file = path.join(dir, 'missing.json')
    const result = readJsonFileWithStatus(file)
    expect(result.missing).toBe(true)
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('returns parseError for invalid json', () => {
    const dir = makeTempDir('summary-utils-')
    const file = path.join(dir, 'broken.json')
    writeTextFile(file, '{"ok":')
    const result = readJsonFileWithStatus(file)
    expect(result.ok).toBe(false)
    expect(result.parseError).toBeTruthy()
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('appends lines to explicit summary path', () => {
    const dir = makeTempDir('summary-utils-')
    const summaryPath = path.join(dir, 'summary.md')
    const appended = appendLinesToStepSummary({
      lines: ['## X', '- ok'],
      stepSummaryPath: summaryPath,
    })
    expect(appended).toBe(true)
    expect(fs.readFileSync(summaryPath, 'utf8')).toContain('## X')
    fs.rmSync(dir, { recursive: true, force: true })
  })
})
