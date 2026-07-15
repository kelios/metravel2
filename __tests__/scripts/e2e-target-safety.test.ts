const {
  DEFAULT_LOCAL_E2E_API_URL,
  isMetravelProductionUrl,
  resolveE2EAuthMode,
  resolveE2ETargets,
} = require('@/scripts/e2e-target-safety')

describe('e2e target safety', () => {
  it('defaults API traffic to the local backend', () => {
    expect(resolveE2ETargets({})).toMatchObject({
      apiUrl: DEFAULT_LOCAL_E2E_API_URL,
      authMode: 'guest',
      productionTarget: false,
    })
  })

  it.each([
    'https://metravel.by',
    'https://api.metravel.by/v1',
  ])('recognizes production hosts: %s', (url) => {
    expect(isMetravelProductionUrl(url)).toBe(true)
  })

  it('blocks a production API target in the default regression suite', () => {
    expect(() => resolveE2ETargets({ E2E_API_URL: 'https://metravel.by' })).toThrow(
      /Production E2E targets are blocked/,
    )
  })

  it('blocks a production browser target even when the API target is local', () => {
    expect(() => resolveE2ETargets({ BASE_URL: 'https://metravel.by' })).toThrow(
      /Production E2E targets are blocked/,
    )
  })

  it('allows production only for the explicitly enabled read-only smoke suite', () => {
    expect(resolveE2ETargets({
      BASE_URL: 'https://metravel.by',
      E2E_SUITE: 'production-smoke',
      E2E_ALLOW_PRODUCTION_API: '1',
    })).toMatchObject({ productionTarget: true, suite: 'production-smoke' })
  })

  it('rejects malformed targets before Playwright starts', () => {
    expect(() => resolveE2ETargets({ E2E_API_URL: 'metravel.local' })).toThrow(
      /valid http\(s\) URL/,
    )
  })

  it('requires explicit mutation opt-in for the live-contract suite', () => {
    expect(() => resolveE2ETargets({
      E2E_SUITE: 'live-contract',
      E2E_API_URL: 'http://127.0.0.1:8000',
    })).toThrow(/E2E_ALLOW_LIVE_MUTATIONS=1/)

    expect(resolveE2ETargets({
      E2E_SUITE: 'live-contract',
      E2E_API_URL: 'http://127.0.0.1:8000',
      E2E_ALLOW_LIVE_MUTATIONS: '1',
    })).toMatchObject({ suite: 'live-contract', authMode: 'required', productionTarget: false })
  })

  it('rejects ambiguous auth modes and guest live-contract runs', () => {
    expect(() => resolveE2EAuthMode({ E2E_AUTH_MODE: 'optional' })).toThrow(/guest or required/)
    expect(() => resolveE2EAuthMode({
      E2E_SUITE: 'live-contract',
      E2E_AUTH_MODE: 'guest',
    })).toThrow(/requires E2E_AUTH_MODE=required/)
  })
})
