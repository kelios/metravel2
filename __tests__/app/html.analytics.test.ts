import { getAnalyticsInlineScript } from '@/utils/analyticsInlineScript'

describe('getAnalyticsInlineScript', () => {
  it('contains delayed GA bootstrap logic', () => {
    const script = getAnalyticsInlineScript(0, 'G-TEST123456')
    expect(script).toContain('bootstrapGa()')
    expect(script).toContain('bootstrapMetrika()')
    expect(script).toContain('ga-disable-')
    expect(script).toContain('gtag/js?id=')
    expect(script).toContain('G-TEST123456')
  })

  it('respects explicit analytics opt-out via ga-disable flag', () => {
    const script = getAnalyticsInlineScript(0, 'G-TEST123456')
    expect(script).toContain("window['ga-disable-' + GA_ID]")
    expect(script).toContain("!window['ga-disable-' + GA_ID]")
  })

  it('schedules analytics bootstrap shortly after page load', () => {
    const script = getAnalyticsInlineScript(12345678, 'G-TEST123456')
    expect(script).toContain("window.addEventListener('load', scheduleAfterLoad, { once: true })")
    expect(script).toContain('loadTimer = setTimeout(trigger, 1000);')
    expect(script).toContain("metrikaScript.src = 'https://mc.yandex.ru/metrika/tag.js';")
    expect(script).toContain('webvisor: METRIKA_WEBVISOR_ENABLED')
  })
})
