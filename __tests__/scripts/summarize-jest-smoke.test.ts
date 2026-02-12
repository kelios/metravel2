const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawnSync } = require('child_process')

describe('summarize-jest-smoke script', () => {
  it('prints and appends smoke summary in cli mode', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'summarize-jest-smoke-'))
    const inputFile = path.join(dir, 'jest-smoke-results.json')
    const stepSummary = path.join(dir, 'step-summary.md')

    fs.writeFileSync(inputFile, JSON.stringify({
      numTotalTestSuites: 2,
      numPassedTestSuites: 1,
      numFailedTestSuites: 1,
      numTotalTests: 10,
      numPassedTests: 9,
      numFailedTests: 1,
      testResults: [
        { name: `${process.cwd()}/a.test.ts`, status: 'passed', startTime: 1000, endTime: 1600 },
        { name: `${process.cwd()}/b.test.ts`, status: 'failed', startTime: 1700, endTime: 2600 },
      ],
    }), 'utf8')

    const result = spawnSync(process.execPath, ['scripts/summarize-jest-smoke.js', inputFile], {
      cwd: process.cwd(),
      env: { ...process.env, GITHUB_STEP_SUMMARY: stepSummary },
      encoding: 'utf8',
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('## CI Smoke Summary')
    expect(result.stdout).toContain('- Suites: 1/2 passed (1 failed)')
    expect(result.stdout).toContain('- Failed suites:')
    const markdown = fs.readFileSync(stepSummary, 'utf8')
    expect(markdown).toContain('- Tests: 9/10 passed (1 failed)')
    expect(markdown).toContain('`b.test.ts`')

    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('reports missing file in cli mode', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'summarize-jest-smoke-'))
    const missing = path.join(dir, 'missing.json')
    const stepSummary = path.join(dir, 'step-summary.md')
    const result = spawnSync(process.execPath, ['scripts/summarize-jest-smoke.js', missing], {
      cwd: process.cwd(),
      env: { ...process.env, GITHUB_STEP_SUMMARY: stepSummary },
      encoding: 'utf8',
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('Result file not found')
    const markdown = fs.readFileSync(stepSummary, 'utf8')
    expect(markdown).toContain('Result file not found')

    fs.rmSync(dir, { recursive: true, force: true })
  })
})
