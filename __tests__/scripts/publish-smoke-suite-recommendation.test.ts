const fs = require('fs')
const path = require('path')
const { makeTempDir, writeJsonFile } = require('./cli-test-utils')
const {
  parseArgs,
  getDriftCounts,
  buildSummaryMarkdown,
  publishRecommendation,
} = require('@/scripts/publish-smoke-suite-recommendation')

describe('publish-smoke-suite-recommendation', () => {
  it('parses args with defaults and overrides', () => {
    expect(parseArgs([])).toEqual({
      summaryFile: 'test-results/quality-summary.json',
      outputFile: 'test-results/smoke-suite-baseline-recommendation.json',
      format: 'json',
    })

    expect(parseArgs(['--summary-file', 'a.json', '--output-file', 'b.json', '--format', 'csv'])).toEqual({
      summaryFile: 'a.json',
      outputFile: 'b.json',
      format: 'csv',
    })
  })

  it('computes drift counts from quality snapshot', () => {
    expect(getDriftCounts({
      smokeSuiteAddedFiles: ['a', 'b'],
      smokeSuiteRemovedFiles: ['c'],
    })).toEqual({
      added: 2,
      removed: 1,
      total: 3,
    })
  })

  it('builds no-drift markdown', () => {
    const markdown = buildSummaryMarkdown({
      drift: { added: 0, removed: 0, total: 0 },
      recommendation: null,
    })
    expect(markdown).toContain('Suite drift not detected (+0 / -0)')
  })

  it('publishes no-drift summary without writing recommendation file', () => {
    const dir = makeTempDir('publish-suite-reco-')
    const summaryFile = path.join(dir, 'quality-summary.json')
    const outputFile = path.join(dir, 'recommendation.json')
    const stepSummaryFile = path.join(dir, 'step-summary.md')

    writeJsonFile(summaryFile, {
      smokeSuiteAddedFiles: [],
      smokeSuiteRemovedFiles: [],
      smokeSuiteFiles: ['__tests__/a.test.ts'],
    })

    const result = publishRecommendation({
      summaryFile,
      outputFile,
      format: 'json',
      stepSummaryPath: stepSummaryFile,
    })

    expect(result.published).toBe(true)
    expect(result.drift).toEqual({ added: 0, removed: 0, total: 0 })
    expect(result.recommendation).toBeNull()
    expect(fs.existsSync(outputFile)).toBe(false)
    expect(fs.readFileSync(stepSummaryFile, 'utf8')).toContain('Suite drift not detected (+0 / -0)')

    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('publishes drift recommendation and writes output file', () => {
    const dir = makeTempDir('publish-suite-reco-')
    const summaryFile = path.join(dir, 'quality-summary.json')
    const outputFile = path.join(dir, 'recommendation.json')
    const stepSummaryFile = path.join(dir, 'step-summary.md')

    writeJsonFile(summaryFile, {
      smokeSuiteAddedFiles: ['__tests__/new.test.ts'],
      smokeSuiteRemovedFiles: ['__tests__/old.test.ts'],
      smokeSuiteFiles: ['__tests__/new.test.ts'],
    })

    const result = publishRecommendation({
      summaryFile,
      outputFile,
      format: 'json',
      stepSummaryPath: stepSummaryFile,
    })

    expect(result.published).toBe(true)
    expect(result.drift).toEqual({ added: 1, removed: 1, total: 2 })
    expect(result.recommendation).toBeTruthy()
    expect(result.recommendation.baselineValue).toBe('["__tests__/new.test.ts"]')
    expect(fs.existsSync(outputFile)).toBe(true)
    expect(fs.readFileSync(stepSummaryFile, 'utf8')).toContain('Suite drift detected: +1 / -1.')
    expect(fs.readFileSync(stepSummaryFile, 'utf8')).toContain('gh variable set SMOKE_SUITE_FILES_BASELINE')

    fs.rmSync(dir, { recursive: true, force: true })
  })
})
