import fs from 'node:fs'
import path from 'node:path'

const {
  LIVE_CONTRACT_SPECS,
  PRODUCTION_SMOKE_SPECS,
  getE2ESuiteSelection,
} = require('@/scripts/e2e-suite-classification')

describe('e2e suite classification', () => {
  it('keeps live mutations out of the default regression suite', () => {
    expect(getE2ESuiteSelection('')).toEqual({
      testIgnore: [...LIVE_CONTRACT_SPECS, ...PRODUCTION_SMOKE_SPECS],
    })
  })

  it('selects only the requested special-purpose suite', () => {
    expect(getE2ESuiteSelection('live-contract')).toEqual({ testMatch: LIVE_CONTRACT_SPECS })
    expect(getE2ESuiteSelection('production-smoke')).toEqual({ testMatch: PRODUCTION_SMOKE_SPECS })
  })

  it('runs Google authorization only in the production smoke suite', () => {
    expect(PRODUCTION_SMOKE_SPECS).toContain('google-signin.spec.ts')
    expect(getE2ESuiteSelection('')).toEqual(
      expect.objectContaining({ testIgnore: expect.arrayContaining(['google-signin.spec.ts']) }),
    )
    expect(getE2ESuiteSelection('production-smoke')).toEqual(
      expect.objectContaining({ testMatch: expect.arrayContaining(['google-signin.spec.ts']) }),
    )
  })

  it('keeps the public mobile CLS companion separate from the complete audit', () => {
    const companion = 'travel-cls-production-smoke.spec.ts'
    const original = 'cls-audit.spec.ts'
    expect(PRODUCTION_SMOKE_SPECS).toContain(companion)
    expect(PRODUCTION_SMOKE_SPECS).not.toContain(original)
    expect(LIVE_CONTRACT_SPECS).not.toContain(companion)
    expect(LIVE_CONTRACT_SPECS).not.toContain(original)
    expect(getE2ESuiteSelection('').testIgnore).toContain(companion)
    expect(getE2ESuiteSelection('').testIgnore).not.toContain(original)
    expect(getE2ESuiteSelection('production-smoke').testMatch).toContain(companion)
    expect(getE2ESuiteSelection('production-smoke').testMatch).not.toContain(original)
  })

  it('classifies unique, existing specs without overlap', () => {
    const all = [...LIVE_CONTRACT_SPECS, ...PRODUCTION_SMOKE_SPECS]
    expect(new Set(all).size).toBe(all.length)
    expect(all.filter((file: string) => !fs.existsSync(path.resolve(__dirname, '../../e2e', file)))).toEqual([])
  })

  it('keeps real cold-trip acceptance in production smoke without dropping planned-trip regression', () => {
    const companion = 'trips-cold-hydration.spec.ts'
    const original = 'planned-trips.spec.ts'
    expect(PRODUCTION_SMOKE_SPECS).toContain(companion)
    expect(LIVE_CONTRACT_SPECS).not.toContain(companion)
    expect(getE2ESuiteSelection('').testIgnore).toContain(companion)
    expect(getE2ESuiteSelection('').testIgnore).not.toContain(original)
    expect(getE2ESuiteSelection('production-smoke').testMatch).toContain(companion)
    expect(getE2ESuiteSelection('production-smoke').testMatch).not.toContain(original)
  })

  it('keeps live-contract prerequisites fail-closed instead of downgrading to smoke', () => {
    const weakFallback = /falling back to (?:a )?ui smoke|running a minimal smoke|(?:was |were )?not exercised|skipping:/i
    const violations = LIVE_CONTRACT_SPECS.filter((file: string) => {
      const source = fs.readFileSync(path.resolve(__dirname, '../../e2e', file), 'utf8')
      return weakFallback.test(source)
    })

    expect(violations).toEqual([])
  })
})
