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

  it('classifies unique, existing specs without overlap', () => {
    const all = [...LIVE_CONTRACT_SPECS, ...PRODUCTION_SMOKE_SPECS]
    expect(new Set(all).size).toBe(all.length)
    expect(all.filter((file: string) => !fs.existsSync(path.resolve(__dirname, '../../e2e', file)))).toEqual([])
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
