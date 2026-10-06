/**
 * #2269: подсказки браузеру в голове web-страницы — только из единого списка
 * `utils/webResourceHints.ts`, и только на источники, с которых код реально
 * грузит ресурсы. Мёртвая подсказка (`preconnect` на NXDOMAIN-хост
 * `cdn.metravel.by`) или «ручная» `<link rel="preconnect">` в `app/+html.tsx`
 * краснит этот тест.
 */
import fs from 'fs'
import path from 'path'

import { getAnalyticsInlineScript } from '@/utils/analyticsInlineScript'
import { ANALYTICS_ORIGINS, WEB_RESOURCE_HINTS } from '@/utils/webResourceHints'

const htmlSource = fs.readFileSync(path.resolve(process.cwd(), 'app/+html.tsx'), 'utf8')
const SELF_HOSTS = new Set(['metravel.by', 'www.metravel.by'])

describe('web resource hints (#2269)', () => {
  it('app/+html.tsx renders hints only from WEB_RESOURCE_HINTS', () => {
    expect(htmlSource).toMatch(/WEB_RESOURCE_HINTS\.map\(/)
    expect(htmlSource).not.toMatch(/rel=["'](?:preconnect|dns-prefetch)["']/)
    expect(htmlSource).not.toMatch(/cdn\.metravel\.by/)
  })

  it('every hint is a bare https origin, not the page own origin', () => {
    expect(WEB_RESOURCE_HINTS.length).toBeGreaterThan(0)
    for (const hint of WEB_RESOURCE_HINTS) {
      const url = new URL(hint.href)
      expect(url.protocol).toBe('https:')
      expect(url.origin).toBe(hint.href)
      expect(SELF_HOSTS.has(url.hostname)).toBe(false)
    }
    const keys = WEB_RESOURCE_HINTS.map((hint) => `${hint.rel}:${hint.href}`)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('every hinted origin is one the page actually loads from', () => {
    const loaders = [getAnalyticsInlineScript(12345, 'G-TEST'), htmlSource].join('\n')
    for (const hint of WEB_RESOURCE_HINTS) {
      // Источник засчитывается, только если по нему реально строится адрес загрузки.
      const usedByLoader = loaders.includes(`${hint.href}/`)
      expect({ href: hint.href, usedByLoader }).toEqual({ href: hint.href, usedByLoader: true })
    }
  })

  it('analytics loaders take their origins from the same constants', () => {
    const script = getAnalyticsInlineScript(12345, 'G-TEST')
    expect(script).toContain(`${ANALYTICS_ORIGINS.gtag}/gtag/js?id=`)
    expect(script).toContain(`${ANALYTICS_ORIGINS.metrika}/metrika/tag.js`)
    expect(htmlSource).toContain('${ANALYTICS_ORIGINS.metrika}/watch/${METRIKA_ID}')
  })
})
