const {
  countTag,
  extractItems,
  hasArticleJsonLd,
  hasTravelSsgHeading,
  getTitle,
  getMetaContent,
  verifyTravelHtml,
} = require('@/scripts/verify-static-travel-seo')

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
      '<h1 data-ssg-travel-h1="true">Energylandia</h1>',
      '<script type="application/ld+json">{"@context":"https://schema.org","@type":"Article"}</script>',
      '</body></html>',
    ].join('')

    expect(getTitle(html)).toBe('Energylandia | Metravel')
    expect(getMetaContent(html, 'property', 'og:image')).toContain('hero-detail_hd')
    expect(countTag(html, /<meta[^>]*name="description"[^>]*\/?>/gi)).toBe(1)
    expect(hasTravelSsgHeading(html)).toBe(true)
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
      'missing SSR H1 marker',
      'missing Article JSON-LD',
    ])
  })
})
