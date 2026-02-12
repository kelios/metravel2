const { runNodeCli } = require('./cli-test-utils')

describe('guard-validator-contract json mode', () => {
  it('emits machine-readable json payload for failing guard result', () => {
    const result = runNodeCli(
      ['scripts/guard-validator-contract-change.js', '--json'],
      { CHANGED_FILES: 'scripts/summarize-jest-smoke.js\n' },
    )

    expect(result.status).toBe(1)
    const payload = JSON.parse(result.stdout)
    expect(payload.contractVersion).toBe(1)
    expect(payload.ok).toBe(false)
    expect(payload.missing).toContain('__tests__/scripts/summarize-jest-smoke.test.ts')
    expect(payload.hints.some((hint) => hint.includes('Expected summary companion test'))).toBe(true)
  })

  it('emits machine-readable json payload for passing guard result', () => {
    const result = runNodeCli(
      ['scripts/guard-validator-contract-change.js', '--json'],
      {
        CHANGED_FILES: [
          'scripts/summarize-jest-smoke.js',
          '__tests__/scripts/summarize-jest-smoke.test.ts',
          'docs/TESTING.md',
        ].join('\n'),
      },
    )

    expect(result.status).toBe(0)
    const payload = JSON.parse(result.stdout)
    expect(payload.contractVersion).toBe(1)
    expect(payload.ok).toBe(true)
    expect(payload.missingCount).toBe(0)
  })
})
