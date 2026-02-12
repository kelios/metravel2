const { SMOKE_CRITICAL_TESTS } = require('@/scripts/smoke-critical-tests')

describe('smoke-critical-tests', () => {
  it('keeps critical smoke test list stable and non-empty', () => {
    expect(Array.isArray(SMOKE_CRITICAL_TESTS)).toBe(true)
    expect(SMOKE_CRITICAL_TESTS.length).toBe(70)
  })

  it('contains key contract and docs coverage tests', () => {
    expect(SMOKE_CRITICAL_TESTS).toContain('__tests__/scripts/workflow-contract-doc-commands-contract.test.ts')
    expect(SMOKE_CRITICAL_TESTS).toContain('__tests__/scripts/validator-doc-commands-contract.test.ts')
    expect(SMOKE_CRITICAL_TESTS).toContain('__tests__/scripts/incident-doc-commands-contract.test.ts')
    expect(SMOKE_CRITICAL_TESTS).toContain('__tests__/scripts/baseline-doc-commands-contract.test.ts')
    expect(SMOKE_CRITICAL_TESTS).toContain('__tests__/scripts/doc-command-contract-utils.test.ts')
    expect(SMOKE_CRITICAL_TESTS).toContain('__tests__/scripts/run-smoke-critical.test.ts')
  })

  it('does not contain duplicate test entries', () => {
    expect(new Set(SMOKE_CRITICAL_TESTS).size).toBe(SMOKE_CRITICAL_TESTS.length)
  })

  it('keeps stable pre-scripts prefix and grouped scripts tail', () => {
    expect(SMOKE_CRITICAL_TESTS.slice(0, 4)).toEqual([
      '__tests__/app/export.test.tsx',
      '__tests__/app/subscriptions.test.tsx',
      '__tests__/components/profile.test.tsx',
      '__tests__/api/travels.test.ts',
    ])

    const firstScriptsIndex = SMOKE_CRITICAL_TESTS.findIndex((file) => file.startsWith('__tests__/scripts/'))
    expect(firstScriptsIndex).toBe(4)
    expect(SMOKE_CRITICAL_TESTS.slice(firstScriptsIndex).every((file) => file.startsWith('__tests__/scripts/'))).toBe(true)
  })
})
