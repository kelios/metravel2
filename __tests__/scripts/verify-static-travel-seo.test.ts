import fs from 'fs'
import path from 'path'

const {
  countTag,
  extractItems,
  hasArticleJsonLd,
  hasTravelSsgHeading,
  hasVisibleTravelSsgHeading,
  getTitle,
  getMetaContent,
  verifyTravelHtml,
} = require('@/scripts/verify-static-travel-seo')

describe('verify-static-travel-seo network contract', () => {
  const source = fs.readFileSync(
    path.resolve(process.cwd(), 'scripts/verify-static-travel-seo.js'),
    'utf8',
  )

  it('uses the shared fetchJson module instead of a local HTTP client', () => {
    // Retries/backoff/Retry-After and the build User-Agent all come from the
    // shared module; a local copy silently loses them (#1399, pattern of #1394).
    expect(source).toContain("require('./lib/fetchJson')")
    expect(source).not.toMatch(/function\s+fetchJson\s*\(/)
    expect(source).not.toMatch(/\bconst\s+fetchJson\s*=\s*(?:async\s*)?\(/)
    // The removed client called `mod.get(url, …)` through a ternary alias, so
    // the needle must not be tied to the module name; `node:` is the accepted
    // require spelling across scripts/ and must not slip through either.
    expect(source).not.toMatch(/\bhttps?\.get\s*\(/)
    expect(source).not.toMatch(/\.get\s*\(\s*url\b/)
    expect(source).not.toMatch(/\brequire\(['"](?:node:)?https?['"]\)/)
  })
})

describe('verify-static-travel-seo helpers', () => {
  it('extractItems supports collection payload shapes', () => {
    expect(extractItems([{ id: 1 }])).toEqual([{ id: 1 }])
    expect(extractItems({ data: [{ id: 2 }] })).toEqual([{ id: 2 }])
    expect(extractItems({ results: [{ id: 3 }] })).toEqual([{ id: 3 }])
    expect(extractItems({ items: [{ id: 4 }] })).toEqual([{ id: 4 }])
    expect(extractItems(null)).toEqual([])
  })

  it('verifyTravelHtml passes for a fully populated travel page', () => {
    const html = [
      '<!DOCTYPE html><html><head>',
      '<title data-rh="true">Energylandia | Metravel</title>',
      '<meta name="description" content="Путешествие в парк развлечений"/>',
      '<meta property="og:title" content="Energylandia | Metravel"/>',
      '<meta property="og:url" content="https://metravel.by/travels/energylandia-polskii-disneilend"/>',
      '<meta property="og:image" content="https://metravel.by/travel-image/123/conversions/hero-detail_hd.jpg"/>',
      '<meta name="twitter:image" content="https://metravel.by/travel-image/123/conversions/hero-detail_hd.jpg"/>',
      '<link rel="canonical" href="https://metravel.by/travels/energylandia-polskii-disneilend"/>',
      '<h1 class="ssg-travel-h1">Energylandia</h1>',
      '<script type="application/ld+json">{"@context":"https://schema.org","@type":"Article"}</script>',
      '</body></html>',
    ].join('')

    expect(getTitle(html)).toBe('Energylandia | Metravel')
    expect(getMetaContent(html, 'property', 'og:image')).toContain('hero-detail_hd')
    expect(countTag(html, /<meta[^>]*name="description"[^>]*\/?>/gi)).toBe(1)
    expect(hasTravelSsgHeading(html)).toBe(true)
    expect(hasVisibleTravelSsgHeading(html)).toBe(true)
    expect(hasArticleJsonLd(html)).toBe(true)
    expect(verifyTravelHtml(html, 'energylandia-polskii-disneilend')).toEqual([])
  })

  it('verifyTravelHtml reports missing SSR meta fields', () => {
    const html = [
      '<!DOCTYPE html><html><head>',
      '<title data-rh="true">Путешествие | Metravel</title>',
      '<meta name="description" content="Найди место для путешествия и поделись своим опытом."/>',
      '<meta name="description" content="Маршруты, заметки и фото путешествий по Беларуси и не только."/>',
      '<meta property="og:title" content="Путешествие | Metravel"/>',
      '<link rel="canonical" href="https://metravel.by/travels/wrong-slug"/>',
      '</head><body></body></html>',
    ].join('')

    expect(verifyTravelHtml(html, 'energylandia-polskii-disneilend')).toEqual([
      'generic description',
      'duplicate description',
      'missing og:image',
      'missing twitter:image',
      'bad canonical: https://metravel.by/travels/wrong-slug',
      'bad og:url: missing',
      'expected exactly one SSR H1, found 0',
      'missing SSR H1 marker',
      'missing Article JSON-LD',
    ])
  })

  it('rejects hidden and duplicate static travel headings', () => {
    const hidden = '<style>.ssg-travel-h1{position:absolute;width:1px;height:1px;clip:rect(0,0,0,0)}</style><h1 class="ssg-travel-h1">Маршрут</h1>'
    expect(hasTravelSsgHeading(hidden)).toBe(true)
    expect(hasVisibleTravelSsgHeading(hidden)).toBe(false)
    expect(verifyTravelHtml(hidden, 'route')).toContain('hidden or clipped SSR H1')

    const duplicate = '<h1 class="ssg-travel-h1">Маршрут</h1><h1>Дубль</h1>'
    expect(verifyTravelHtml(duplicate, 'route')).toContain('expected exactly one SSR H1, found 2')

    const hiddenByLaterRule = '<style>.ssg-travel-h1{color:#111}html.ready .ssg-travel-h1{display:none}</style><h1 class="ssg-travel-h1">Маршрут</h1>'
    expect(hasVisibleTravelSsgHeading(hiddenByLaterRule)).toBe(false)
  })
})
