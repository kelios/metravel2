const { spawnSync } = require('child_process')

const runNode = (args, env = {}) => {
  const result = spawnSync(process.execPath, args, {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    encoding: 'utf8',
  })
  return {
    status: result.status ?? 1,
    stdout: String(result.stdout || ''),
    stderr: String(result.stderr || ''),
  }
}

describe('selective runner json contract', () => {
  it('emits run decision for validator selective runner with matched files', () => {
    const result = runNode(
      ['scripts/run-validator-contract-tests-if-needed.js', '--dry-run', '--json'],
      { CHANGED_FILES: 'scripts/validator-output.js\nREADME.md\n' },
    )

    expect(result.status).toBe(0)
    const payload = JSON.parse(result.stdout)
    expect(payload.contractVersion).toBe(1)
    expect(payload.check).toBe('validator-contract-checks')
    expect(payload.decision).toBe('run')
    expect(payload.reason).toBe('match')
    expect(payload.shouldRun).toBe(true)
    expect(payload.relevantMatches).toBeGreaterThan(0)
  })

  it('emits skip decision for schema selective runner with no matches', () => {
    const result = runNode(
      ['scripts/run-schema-contract-tests-if-needed.js', '--dry-run', '--json'],
      { CHANGED_FILES: 'README.md\n' },
    )

    expect(result.status).toBe(0)
    const payload = JSON.parse(result.stdout)
    expect(payload.contractVersion).toBe(1)
    expect(payload.check).toBe('schema-contract-checks')
    expect(payload.decision).toBe('skip')
    expect(payload.reason).toBe('no-match')
    expect(payload.shouldRun).toBe(false)
    expect(payload.relevantMatches).toBe(0)
  })

  it('emits forced run decision when changed-files input is unavailable', () => {
    const result = runNode(
      ['scripts/run-schema-contract-tests-if-needed.js', '--dry-run', '--json'],
      { CHANGED_FILES: '' },
    )

    expect(result.status).toBe(0)
    const payload = JSON.parse(result.stdout)
    expect(payload.contractVersion).toBe(1)
    expect(payload.check).toBe('schema-contract-checks')
    expect(payload.decision).toBe('run')
    expect(payload.reason).toBe('missing-input')
    expect(payload.shouldRun).toBe(true)
  })

  it('rejects json output without dry-run', () => {
    const result = runNode([
      'scripts/run-validator-contract-tests-if-needed.js',
      '--json',
    ])

    expect(result.status).toBe(2)
    expect(result.stdout).toBe('')
    expect(result.stderr).toContain('--json is supported only with --dry-run')
  })
})
