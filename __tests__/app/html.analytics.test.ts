import { getAnalyticsInlineScript } from '@/utils/analyticsInlineScript'

describe('getAnalyticsInlineScript', () => {
  it('bootstraps GA even without saved consent (opt-out model)', () => {
    const script = getAnalyticsInlineScript(0, 'G-TEST123456')
    expect(script).toContain('bootstrapGa()')
    expect(script).toContain('ga-disable-')
    expect(script).toContain('gtag/js?id=')
    expect(script).toContain('G-TEST123456')
  })

  it('respects explicit analytics opt-out via ga-disable flag', () => {
    const script = getAnalyticsInlineScript(0, 'G-TEST123456')
    expect(script).toContain("window['ga-disable-' + GA_ID]")
    expect(script).toContain("!window['ga-disable-' + GA_ID]")
  })
})
