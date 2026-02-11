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

describe('validate-selective-decision script', () => {
  it('passes for valid selective decision file', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'validate-selective-'))
    const filePath = path.join(dir, 'decision.json')
    fs.writeFileSync(filePath, JSON.stringify({
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
    }), 'utf8')

    const result = runNode(['scripts/validate-selective-decision.js', '--file', filePath])
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('selective decision validation passed.')

    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('fails for malformed selective decision file', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'validate-selective-'))
    const filePath = path.join(dir, 'decision.json')
    fs.writeFileSync(filePath, JSON.stringify({ contractVersion: 2 }), 'utf8')

    const result = runNode(['scripts/validate-selective-decision.js', '--file', filePath])
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('selective decision validation failed:')

    fs.rmSync(dir, { recursive: true, force: true })
  })
})
