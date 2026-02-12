const fs = require('fs')
const path = require('path')
const { makeTempDir, runNodeCli, writeJsonFile } = require('./cli-test-utils')

describe('validate-selective-decisions script', () => {
  it('passes for valid aggregate file', () => {
    const dir = makeTempDir('validate-selective-agg-')
    const filePath = path.join(dir, 'selective-decisions.json')
    writeJsonFile(filePath, {
      schemaVersion: 1,
      decisions: [{
        contractVersion: 1,
        check: 'validator-contract-checks',
        decision: 'skip',
        shouldRun: false,
        reason: 'no-match',
        changedFilesScanned: 8,
        relevantMatches: 0,
        matchedFiles: [],
        dryRun: true,
        targetedTests: 7,
      }],
      warnings: [],
    })

    const result = runNodeCli(['scripts/validate-selective-decisions.js', '--file', filePath])
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('selective decisions aggregate validation passed.')
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('fails for malformed aggregate file', () => {
    const dir = makeTempDir('validate-selective-agg-')
    const filePath = path.join(dir, 'selective-decisions.json')
    writeJsonFile(filePath, {
      schemaVersion: 2,
      decisions: [{}],
      warnings: [1],
    })

    const result = runNodeCli(['scripts/validate-selective-decisions.js', '--file', filePath])
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('selective decisions aggregate validation failed:')
    fs.rmSync(dir, { recursive: true, force: true })
  })
})
