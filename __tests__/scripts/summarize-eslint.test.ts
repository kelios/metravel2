const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawnSync } = require('child_process')

describe('summarize-eslint script', () => {
  it('prints and appends lint summary in cli mode', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'summarize-eslint-'))
    const inputFile = path.join(dir, 'eslint-results.json')
    const stepSummary = path.join(dir, 'step-summary.md')

    fs.writeFileSync(inputFile, JSON.stringify([
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
    ]), 'utf8')

    const result = spawnSync(process.execPath, ['scripts/summarize-eslint.js', inputFile], {
      cwd: process.cwd(),
      env: { ...process.env, GITHUB_STEP_SUMMARY: stepSummary },
      encoding: 'utf8',
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
