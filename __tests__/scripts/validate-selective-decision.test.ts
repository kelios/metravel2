const fs = require('fs')
const path = require('path')
const { makeTempDir, runNodeCli, writeJsonFile } = require('./cli-test-utils')

describe('validate-selective-decision script', () => {
  it('passes for valid selective decision file', () => {
    const dir = makeTempDir('validate-selective-')
    const filePath = path.join(dir, 'decision.json')
    writeJsonFile(filePath, {
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
    })

    const result = runNodeCli(['scripts/validate-selective-decision.js', '--file', filePath])
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('selective decision validation passed.')

    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('fails for malformed selective decision file', () => {
    const dir = makeTempDir('validate-selective-')
    const filePath = path.join(dir, 'decision.json')
    writeJsonFile(filePath, { contractVersion: 2 })

    const result = runNodeCli(['scripts/validate-selective-decision.js', '--file', filePath])
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('selective decision validation failed:')

    fs.rmSync(dir, { recursive: true, force: true })
  })
})
