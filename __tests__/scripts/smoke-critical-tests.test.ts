import fs from 'node:fs'
import path from 'node:path'

const { SMOKE_CRITICAL_TESTS } = require('@/scripts/smoke-critical-tests')

describe('smoke-critical-tests', () => {
  it('keeps a compact product-facing critical matrix', () => {
    expect(SMOKE_CRITICAL_TESTS).toHaveLength(10)
    expect(SMOKE_CRITICAL_TESTS.every((file: string) => !file.startsWith('__tests__/scripts/'))).toBe(true)
  })

  it('covers the critical product domains', () => {
    expect(SMOKE_CRITICAL_TESTS).toEqual(expect.arrayContaining([
      '__tests__/app/export.test.tsx',
      '__tests__/app/subscriptions.test.tsx',
      '__tests__/components/profile.test.tsx',
      '__tests__/api/travels.test.ts',
      '__tests__/stores/authStore.test.ts',
      '__tests__/components/MapPage/useRouting.safety.test.ts',
      '__tests__/utils/questAdapters.test.ts',
      '__tests__/utils/placesCatalog.test.ts',
      '__tests__/utils/filterQuery.test.ts',
      '__tests__/hooks/useTheme.test.tsx',
    ]))
  })

  it('contains only unique, resolvable test files', () => {
    expect(new Set(SMOKE_CRITICAL_TESTS).size).toBe(SMOKE_CRITICAL_TESTS.length)
    const missing = SMOKE_CRITICAL_TESTS.filter(
      (file: string) => !fs.existsSync(path.resolve(__dirname, '../..', file)),
    )
    expect(missing).toEqual([])
  })
})
