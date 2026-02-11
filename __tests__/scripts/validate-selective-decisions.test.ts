const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawnSync } = require('child_process')

const runNode = (args) => {
  const result = spawnSync(process.execPath, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
  })
  return {
    status: result.status ?? 1,
    stdout: String(result.stdout || ''),
    stderr: String(result.stderr || ''),
  }
}

describe('validate-selective-decisions script', () => {
  it('passes for valid aggregate file', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'validate-selective-agg-'))
    const filePath = path.join(dir, 'selective-decisions.json')
    fs.writeFileSync(filePath, JSON.stringify({
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
    }), 'utf8')

    const result = runNode(['scripts/validate-selective-decisions.js', '--file', filePath])
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('selective decisions aggregate validation passed.')
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('fails for malformed aggregate file', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'validate-selective-agg-'))
    const filePath = path.join(dir, 'selective-decisions.json')
    fs.writeFileSync(filePath, JSON.stringify({
      schemaVersion: 2,
      decisions: [{}],
      warnings: [1],
    }), 'utf8')

    const result = runNode(['scripts/validate-selective-decisions.js', '--file', filePath])
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('selective decisions aggregate validation failed:')
    fs.rmSync(dir, { recursive: true, force: true })
  })
})
