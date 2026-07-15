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
})
