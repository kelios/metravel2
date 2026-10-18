import { readSyncImport } from '@/utils/syncImport'

// #2465: Metro's web `import()` of a registered module carries it in `_result`.
const withResult = <T,>(result: unknown) => Object.assign(Promise.resolve(result as T), { _result: result })

describe('readSyncImport', () => {
  it('returns the module Metro already evaluated', () => {
    const module = { default: () => null }
    expect(readSyncImport(withResult<typeof module>(module))).toBe(module)
  })

  it('returns null while the chunk is still loading or outside Metro', () => {
    expect(readSyncImport(withResult<object>(new Promise(() => {})))).toBeNull()
    expect(readSyncImport(Promise.resolve({ default: 1 }))).toBeNull()
    expect(readSyncImport(withResult<object>(undefined))).toBeNull()
  })
})
