const fs = require('fs')
const os = require('os')
const path = require('path')
const { publishRecommendation } = require('@/scripts/publish-smoke-suite-recommendation')

describe('smoke suite baseline pipeline integration', () => {
  it('publishes recommendation artifact and summary from quality-summary fixture', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'suite-baseline-pipeline-'))
    const summaryFile = path.join(dir, 'quality-summary.json')
    const outputFile = path.join(dir, 'smoke-suite-baseline-recommendation.json')
    const stepSummaryFile = path.join(dir, 'step-summary.md')

    fs.writeFileSync(summaryFile, JSON.stringify({
      smokeSuiteFiles: [
        '__tests__/app/export.test.tsx',
        '__tests__/app/subscriptions.test.tsx',
      ],
      smokeSuiteAddedFiles: ['__tests__/app/subscriptions.test.tsx'],
      smokeSuiteRemovedFiles: ['__tests__/legacy/old.test.tsx'],
    }), 'utf8')

    const result = publishRecommendation({
      summaryFile,
      outputFile,
      format: 'json',
      stepSummaryPath: stepSummaryFile,
    })

    expect(result.published).toBe(true)
    expect(result.drift).toEqual({ added: 1, removed: 1, total: 2 })
    expect(result.recommendation).toBeTruthy()
    expect(result.recommendation.baselineValue).toBe('["__tests__/app/export.test.tsx","__tests__/app/subscriptions.test.tsx"]')

    const artifact = JSON.parse(fs.readFileSync(outputFile, 'utf8'))
    expect(artifact.sourceSnapshot).toBe(summaryFile)
    expect(artifact.suiteCount).toBe(2)
    expect(artifact.format).toBe('json')
    expect(artifact.ghCommand).toContain('gh variable set SMOKE_SUITE_FILES_BASELINE')

    const stepSummary = fs.readFileSync(stepSummaryFile, 'utf8')
    expect(stepSummary).toContain('### Smoke Suite Baseline Recommendation')
    expect(stepSummary).toContain('Suite drift detected: +1 / -1.')
    expect(stepSummary).toContain('Recommended value:')

    fs.rmSync(dir, { recursive: true, force: true })
  })
})
