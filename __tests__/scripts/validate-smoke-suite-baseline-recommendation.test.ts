const fs = require('fs')
const os = require('os')
const path = require('path')
const {
  parseArgs,
  readRecommendation,
  validate,
  validateDetailed,
} = require('@/scripts/validate-smoke-suite-baseline-recommendation')

describe('validate-smoke-suite-baseline-recommendation', () => {
  it('parses default and custom file args', () => {
    expect(parseArgs([])).toEqual({
      file: 'test-results/smoke-suite-baseline-recommendation.json',
      output: 'text',
    })
    expect(parseArgs(['--file', 'tmp/reco.json'])).toEqual({
      file: 'tmp/reco.json',
      output: 'text',
    })
    expect(parseArgs(['--json'])).toEqual({
      file: 'test-results/smoke-suite-baseline-recommendation.json',
      output: 'json',
    })
  })

  it('passes for valid json-format recommendation payload', () => {
    const payload = {
      sourceSnapshot: 'test-results/quality-summary.json',
      suiteCount: 2,
      format: 'json',
      baselineValue: '["__tests__/a.test.ts","__tests__/b.test.ts"]',
      ghCommand: "gh variable set SMOKE_SUITE_FILES_BASELINE --body '[\"__tests__/a.test.ts\",\"__tests__/b.test.ts\"]'",
    }
    expect(validate(payload)).toEqual([])
  })

  it('passes for valid csv-format recommendation payload', () => {
    const payload = {
      sourceSnapshot: 'test-results/quality-summary.json',
      suiteCount: 1,
      format: 'csv',
      baselineValue: '__tests__/a.test.ts',
      ghCommand: "gh variable set SMOKE_SUITE_FILES_BASELINE --body '__tests__/a.test.ts'",
    }
    expect(validate(payload)).toEqual([])
  })

  it('fails for invalid payload fields', () => {
    const payload = {
      sourceSnapshot: '',
      suiteCount: 0,
      format: 'yaml',
      baselineValue: '',
      ghCommand: 'echo test',
    }
    const errors = validate(payload)
    expect(errors.join('\n')).toContain('sourceSnapshot')
    expect(errors.join('\n')).toContain('suiteCount')
    expect(errors.join('\n')).toContain('format')
    expect(errors.join('\n')).toContain('baselineValue')
    expect(errors.join('\n')).toContain('ghCommand')
  })

  it('fails when json baselineValue is not parseable/valid array', () => {
    const payload = {
      sourceSnapshot: 'test-results/quality-summary.json',
      suiteCount: 1,
      format: 'json',
      baselineValue: '{bad json}',
      ghCommand: "gh variable set SMOKE_SUITE_FILES_BASELINE --body '{bad json}'",
    }
    const errors = validate(payload)
    expect(errors.join('\n')).toContain('valid JSON array string')
  })

  it('returns machine-readable detailed errors', () => {
    const payload = {
      sourceSnapshot: '',
      suiteCount: 0,
      format: 'yaml',
      baselineValue: '',
      ghCommand: '',
    }
    const detailed = validateDetailed(payload)
    expect(detailed.length).toBeGreaterThan(0)
    expect(detailed[0]).toHaveProperty('code')
    expect(detailed[0]).toHaveProperty('field')
    expect(detailed[0]).toHaveProperty('message')
  })

  it('reads recommendation file', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'validate-suite-reco-'))
    const filePath = path.join(dir, 'recommendation.json')
    const payload = {
      sourceSnapshot: 'test-results/quality-summary.json',
      suiteCount: 1,
      format: 'json',
      baselineValue: '["__tests__/a.test.ts"]',
      ghCommand: "gh variable set SMOKE_SUITE_FILES_BASELINE --body '[\"__tests__/a.test.ts\"]'",
    }
    fs.writeFileSync(filePath, JSON.stringify(payload), 'utf8')
    expect(readRecommendation(filePath)).toEqual(payload)
    fs.rmSync(dir, { recursive: true, force: true })
  })
})
