const {
  evaluateGuard,
  parseOverrideReason,
  parseArgs,
  buildJsonResult,
  OUTPUT_CONTRACT_VERSION,
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

  it('fails when summary-utils changes without required companions', () => {
    const result = evaluateGuard({
      changedFiles: ['scripts/summary-utils.js'],
      prBody: '',
    })
    expect(result.ok).toBe(false)
    expect(result.missing).toContain('__tests__/scripts/summary-utils.test.ts')
    expect(result.missing).toContain('__tests__/scripts/run-validator-contract-tests-if-needed.test.ts')
    expect(result.missing).toContain('docs/TESTING.md')
  })

  it('passes when summary-utils changes include required tests and docs', () => {
    const result = evaluateGuard({
      changedFiles: [
        'scripts/summary-utils.js',
        '__tests__/scripts/summary-utils.test.ts',
        '__tests__/scripts/run-validator-contract-tests-if-needed.test.ts',
        'docs/TESTING.md',
      ],
      prBody: '',
    })
    expect(result.ok).toBe(true)
  })

  it('fails when validation-rules changes without companions', () => {
    const result = evaluateGuard({
      changedFiles: ['scripts/validation-rules.js'],
      prBody: '',
    })
    expect(result.ok).toBe(false)
    expect(result.missing).toContain('__tests__/scripts/validation-rules.test.ts')
    expect(result.missing).toContain('docs/TESTING.md')
  })

  it('passes when validation-rules changes include companions', () => {
    const result = evaluateGuard({
      changedFiles: [
        'scripts/validation-rules.js',
        '__tests__/scripts/validation-rules.test.ts',
        'docs/TESTING.md',
      ],
      prBody: '',
    })
    expect(result.ok).toBe(true)
  })

  it('fails when validator guard comment validator changes without companions', () => {
    const result = evaluateGuard({
      changedFiles: ['scripts/validate-validator-guard-comment.js'],
      prBody: '',
    })
    expect(result.ok).toBe(false)
    expect(result.missing).toContain('__tests__/scripts/validate-validator-guard-comment.test.ts')
    expect(result.missing).toContain('docs/TESTING.md')
  })

  it('passes when validator guard comment validator changes include companions', () => {
    const result = evaluateGuard({
      changedFiles: [
        'scripts/validate-validator-guard-comment.js',
        '__tests__/scripts/validate-validator-guard-comment.test.ts',
        'docs/TESTING.md',
      ],
      prBody: '',
    })
    expect(result.ok).toBe(true)
  })

  it('fails when validator error-codes docs-table validator changes without companions', () => {
    const result = evaluateGuard({
      changedFiles: ['scripts/validate-validator-error-codes-doc-table.js'],
      prBody: '',
    })
    expect(result.ok).toBe(false)
    expect(result.missing).toContain('__tests__/scripts/validate-validator-error-codes-doc-table.test.ts')
    expect(result.missing).toContain('docs/TESTING.md')
  })

  it('passes when validator error-codes docs-table validator changes include companions', () => {
    const result = evaluateGuard({
      changedFiles: [
        'scripts/validate-validator-error-codes-doc-table.js',
        '__tests__/scripts/validate-validator-error-codes-doc-table.test.ts',
        'docs/TESTING.md',
      ],
      prBody: '',
    })
    expect(result.ok).toBe(true)
  })

  it('fails when validator error-codes policy validator changes without companions', () => {
    const result = evaluateGuard({
      changedFiles: ['scripts/validate-validator-error-codes-policy.js'],
      prBody: '',
    })
    expect(result.ok).toBe(false)
    expect(result.missing).toContain('__tests__/scripts/validate-validator-error-codes-policy.test.ts')
    expect(result.missing).toContain('docs/TESTING.md')
  })

  it('passes when validator error-codes policy validator changes include companions', () => {
    const result = evaluateGuard({
      changedFiles: [
        'scripts/validate-validator-error-codes-policy.js',
        '__tests__/scripts/validate-validator-error-codes-policy.test.ts',
        'docs/TESTING.md',
      ],
      prBody: '',
    })
    expect(result.ok).toBe(true)
  })

  it('fails when validator contracts summary validator changes without companions', () => {
    const result = evaluateGuard({
      changedFiles: ['scripts/validate-validator-contracts-summary.js'],
      prBody: '',
    })
    expect(result.ok).toBe(false)
    expect(result.missing).toContain('__tests__/scripts/validate-validator-contracts-summary.test.ts')
    expect(result.missing).toContain('docs/TESTING.md')
  })

  it('passes when validator contracts summary validator changes include companions', () => {
    const result = evaluateGuard({
      changedFiles: [
        'scripts/validate-validator-contracts-summary.js',
        '__tests__/scripts/validate-validator-contracts-summary.test.ts',
        'docs/TESTING.md',
      ],
      prBody: '',
    })
    expect(result.ok).toBe(true)
  })

  it('fails when validator error-codes docs-table updater changes without companions', () => {
    const result = evaluateGuard({
      changedFiles: ['scripts/update-validator-error-codes-doc-table.js'],
      prBody: '',
    })
    expect(result.ok).toBe(false)
    expect(result.missing).toContain('__tests__/scripts/update-validator-error-codes-doc-table.test.ts')
    expect(result.missing).toContain('docs/TESTING.md')
  })

  it('passes when validator error-codes docs-table updater changes include companions', () => {
    const result = evaluateGuard({
      changedFiles: [
        'scripts/update-validator-error-codes-doc-table.js',
        '__tests__/scripts/update-validator-error-codes-doc-table.test.ts',
        'docs/TESTING.md',
      ],
      prBody: '',
    })
    expect(result.ok).toBe(true)
  })

  it('fails when validator guard comment template changes without companions', () => {
    const result = evaluateGuard({
      changedFiles: ['scripts/validator-guard-comment-template.js'],
      prBody: '',
    })
    expect(result.ok).toBe(false)
    expect(result.missing).toContain('__tests__/scripts/validator-guard-comment-template.test.ts')
    expect(result.missing).toContain('docs/TESTING.md')
  })

  it('passes when validator guard comment template changes include companions', () => {
    const result = evaluateGuard({
      changedFiles: [
        'scripts/validator-guard-comment-template.js',
        '__tests__/scripts/validator-guard-comment-template.test.ts',
        'docs/TESTING.md',
      ],
      prBody: '',
    })
    expect(result.ok).toBe(true)
  })

  it('fails when summarize script changes without required companions', () => {
    const result = evaluateGuard({
      changedFiles: ['scripts/summarize-jest-smoke.js'],
      prBody: '',
    })
    expect(result.ok).toBe(false)
    expect(result.missing).toContain('__tests__/scripts/summarize-jest-smoke.test.ts')
    expect(result.missing).toContain('docs/TESTING.md')
    expect(result.hints).toContain(
      'Expected summary companion test for scripts/summarize-jest-smoke.js: __tests__/scripts/summarize-jest-smoke.test.ts'
    )
  })

  it('passes when summarize script changes include matching test and docs', () => {
    const result = evaluateGuard({
      changedFiles: [
        'scripts/summarize-jest-smoke.js',
        '__tests__/scripts/summarize-jest-smoke.test.ts',
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

  it('parses output args and builds json result payload', () => {
    expect(parseArgs([])).toEqual({ output: 'text' })
    expect(parseArgs(['--json'])).toEqual({ output: 'json' })
    const payload = buildJsonResult({
      ok: false,
      reason: 'x',
      touchedFiles: ['scripts/summarize-eslint.js'],
      missing: ['__tests__/scripts/summarize-eslint.test.ts'],
      hints: ['Expected summary companion test for scripts/summarize-eslint.js: __tests__/scripts/summarize-eslint.test.ts'],
    })
    expect(payload.contractVersion).toBe(OUTPUT_CONTRACT_VERSION)
    expect(payload.ok).toBe(false)
    expect(payload.touchedCount).toBe(1)
    expect(payload.missingCount).toBe(1)
    expect(payload.hintCount).toBe(1)
  })
})
