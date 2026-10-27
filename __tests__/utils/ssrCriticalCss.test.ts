const { resolveSsrCriticalCssHref } = require('@/utils/ssr/criticalCss')

// #2768: серверный ответ ссылается на общий файл critical CSS (тот же, что у
// статики, #2762) только по имени, которое дала сборка; иначе +html оставляет инлайн.
describe('SSR critical CSS link', () => {
  it('links the shared file only in the server runtime with a valid build-provided name', () => {
    const fileName = 'critical-0123456789abcdef.css'
    expect(resolveSsrCriticalCssHref({ EXPO_PUBLIC_WEB_RUNTIME_SSR: 'true', METRAVEL_SSR_CRITICAL_CSS: fileName }))
      .toBe(`/_expo/static/css/${fileName}`)
    expect(resolveSsrCriticalCssHref({ EXPO_PUBLIC_WEB_RUNTIME_SSR: 'false', METRAVEL_SSR_CRITICAL_CSS: fileName })).toBeNull()
    expect(resolveSsrCriticalCssHref({ EXPO_PUBLIC_WEB_RUNTIME_SSR: 'true' })).toBeNull()
    for (const bad of ['../critical-0123456789abcdef.css', 'critical-0123.css', 'https://x/critical-0123456789abcdef.css']) {
      expect(resolveSsrCriticalCssHref({ EXPO_PUBLIC_WEB_RUNTIME_SSR: 'true', METRAVEL_SSR_CRITICAL_CSS: bad })).toBeNull()
    }
  })
})
