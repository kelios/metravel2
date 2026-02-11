const {
  VALIDATOR_CONTRACT_VERSION,
  normalizeErrors,
  buildResult,
  emitResult,
} = require('@/scripts/validator-output')

describe('validator-output', () => {
  it('normalizes mixed error inputs', () => {
    const normalized = normalizeErrors([
      { code: 'A', field: 'x', message: 'm1' },
      'plain error',
      { field: 'y' },
    ])
    expect(normalized).toEqual([
      { code: 'A', field: 'x', message: 'm1' },
      { code: 'VALIDATION_ERROR', field: 'unknown', message: 'plain error' },
      { code: 'VALIDATION_ERROR', field: 'y', message: 'Validation error' },
    ])
  })

  it('builds success and failure result payload', () => {
    expect(buildResult({ file: 'a.txt', errors: [] })).toEqual({
      contractVersion: VALIDATOR_CONTRACT_VERSION,
      ok: true,
      file: 'a.txt',
      errorCount: 0,
      errors: [],
    })

    const result = buildResult({
      errors: [{ code: 'E', field: 'f', message: 'bad' }],
      extra: { requested: true },
    })
    expect(result.contractVersion).toBe(VALIDATOR_CONTRACT_VERSION)
    expect(result.ok).toBe(false)
    expect(result.errorCount).toBe(1)
    expect(result.requested).toBe(true)
  })

  it('emits text/json and returns proper exit code', () => {
    const okResult = buildResult({ errors: [] })
    const failResult = buildResult({ errors: [{ code: 'E', field: 'f', message: 'bad' }] })

    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    const writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true)

    expect(emitResult({ result: okResult, output: 'text', successMessage: 'OK' })).toBe(0)
    expect(emitResult({ result: failResult, output: 'text', failurePrefix: 'Fail' })).toBe(1)
    expect(emitResult({ result: okResult, output: 'json' })).toBe(0)
    expect(emitResult({ result: failResult, output: 'json' })).toBe(1)

    logSpy.mockRestore()
    writeSpy.mockRestore()
  })
})
