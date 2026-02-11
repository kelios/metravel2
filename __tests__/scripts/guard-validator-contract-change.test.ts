const {
  evaluateGuard,
  parseOverrideReason,
} = require('@/scripts/guard-validator-contract-change')

describe('guard-validator-contract-change', () => {
  it('passes when validator contract files are unchanged', () => {
    const result = evaluateGuard({
      changedFiles: ['README.md'],
      prBody: '',
    })
    expect(result.ok).toBe(true)
  })

  it('fails when validator-error-codes changes without required companions', () => {
    const result = evaluateGuard({
      changedFiles: ['scripts/validator-error-codes.js'],
      prBody: '',
    })
    expect(result.ok).toBe(false)
    expect(result.missing).toContain('__tests__/scripts/validator-error-codes.test.ts')
    expect(result.missing).toContain('__tests__/scripts/validator-json-contract.test.ts')
    expect(result.missing).toContain('docs/TESTING.md')
  })

  it('passes when validator-output changes include required tests and docs', () => {
    const result = evaluateGuard({
      changedFiles: [
        'scripts/validator-output.js',
        '__tests__/scripts/validator-output.test.ts',
        '__tests__/scripts/validator-json-contract.test.ts',
        'docs/TESTING.md',
      ],
      prBody: '',
    })
    expect(result.ok).toBe(true)
  })

  it('passes when override is present in PR body', () => {
    const result = evaluateGuard({
      changedFiles: ['scripts/validator-error-codes.js'],
      prBody: 'validator-guard: skip - urgent contract hotfix, tests in follow-up PR',
    })
    expect(result.ok).toBe(true)
    expect(result.reason).toContain('override')
  })

  it('parses override reason', () => {
    const reason = parseOverrideReason('Text\nvalidator-guard: skip - justified exception\nMore')
    expect(reason).toBe('justified exception')
  })
})
