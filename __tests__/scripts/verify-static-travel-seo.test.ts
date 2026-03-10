const {
  extractItems,
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
      '<meta property="og:image" content="https://metravel.by/travel-image/123/conversions/hero-detail_hd.jpg"/>',
      '<meta name="twitter:image" content="https://metravel.by/travel-image/123/conversions/hero-detail_hd.jpg"/>',
      '<link rel="canonical" href="https://metravel.by/travels/energylandia-polskii-disneilend"/>',
      '</head><body></body></html>',
    ].join('')

    expect(getTitle(html)).toBe('Energylandia | Metravel')
    expect(getMetaContent(html, 'property', 'og:image')).toContain('hero-detail_hd')
    expect(verifyTravelHtml(html, 'energylandia-polskii-disneilend')).toEqual([])
  })

  it('verifyTravelHtml reports missing SSR meta fields', () => {
    const html = [
      '<!DOCTYPE html><html><head>',
      '<title data-rh="true">Metravel</title>',
      '<link rel="canonical" href="https://metravel.by/travels/wrong-slug"/>',
      '</head><body></body></html>',
    ].join('')

    expect(verifyTravelHtml(html, 'energylandia-polskii-disneilend')).toEqual([
      'generic-or-missing <title>',
      'missing description',
      'missing og:title',
      'missing og:image',
      'missing twitter:image',
      'bad canonical: https://metravel.by/travels/wrong-slug',
    ])
  })
})
