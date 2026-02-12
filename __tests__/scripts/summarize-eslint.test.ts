const fs = require('fs')
const path = require('path')
const { makeTempDir, runNodeCli, writeJsonFile } = require('./cli-test-utils')

describe('summarize-eslint script', () => {
  it('prints and appends lint summary in cli mode', () => {
    const dir = makeTempDir('summarize-eslint-')
    const inputFile = path.join(dir, 'eslint-results.json')
    const stepSummary = path.join(dir, 'step-summary.md')

    writeJsonFile(inputFile, [
      {
        filePath: `${process.cwd()}/src/a.ts`,
        errorCount: 1,
        warningCount: 0,
      },
      {
        filePath: `${process.cwd()}/src/b.ts`,
        errorCount: 0,
        warningCount: 2,
      },
    ])

    const result = runNodeCli(['scripts/summarize-eslint.js', inputFile], {
      GITHUB_STEP_SUMMARY: stepSummary,
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('## Lint Summary')
    expect(result.stdout).toContain('- Files checked: 2')
    const markdown = fs.readFileSync(stepSummary, 'utf8')
    expect(markdown).toContain('- Errors: 1')
    expect(markdown).toContain('- Warnings: 2')

    fs.rmSync(dir, { recursive: true, force: true })
  })
})
