const {
  detectPageType,
  parseSitemapUrls,
  validateCanonical,
  validateHomeAssets,
  validatePageResult,
  validateSitemapResponse,
  validateTravelHtml,
} = require('@/scripts/post-deploy-seo-check')

describe('post-deploy SEO check helpers', () => {
  it('classifies page types by URL', () => {
    expect(detectPageType('https://metravel.by/')).toBe('home')
    expect(detectPageType('https://metravel.by/travels/test')).toBe('travel')
    expect(detectPageType('https://metravel.by/article/1')).toBe('article')
    expect(detectPageType('https://metravel.by/login')).toBe('auth')
  })

  it('parses sitemap loc entries', () => {
    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset>',
      '<url><loc>https://metravel.by/</loc></url>',
      '<url><loc>https://metravel.by/travels/test</loc></url>',
      '</urlset>',
    ].join('')

    expect(parseSitemapUrls(xml)).toEqual([
      'https://metravel.by/',
      'https://metravel.by/travels/test',
    ])
  })

  it('detects canonical mismatch', () => {
    const issues = validateCanonical(
      'https://metravel.by/travels/other',
      '<link rel="canonical" href="https://metravel.by/travels/other"/>',
      'https://metravel.by/travels/test'
    )

    expect(issues.some((issue: any) => issue.code === 'canonical.mismatch')).toBe(true)
  })

  it('requires home mobile assets', () => {
    const issues = validateHomeAssets('<head></head>')
    expect(issues.map((issue: any) => issue.code)).toEqual(
      expect.arrayContaining(['icon.apple-touch.missing', 'manifest.missing'])
    )
  })

  it('requires SSR travel h1 and article schema', () => {
    const issues = validateTravelHtml('<html><head></head><body></body></html>')
    expect(issues.map((issue: any) => issue.code)).toEqual(
      expect.arrayContaining(['travel.h1.count', 'travel.h1.marker', 'travel.schema.article'])
    )
  })

  it('fails when sitemap sends X-Robots-Tag noindex', () => {
    const result = validateSitemapResponse({
      url: 'https://metravel.by/sitemap.xml',
      finalUrl: 'https://metravel.by/sitemap.xml',
      status: 200,
      headers: {
        'content-type': 'application/xml; charset=utf-8',
        'x-robots-tag': 'noindex, nofollow',
      },
      body: '<?xml version="1.0" encoding="UTF-8"?><urlset></urlset>',
    })

    expect(result.issues.map((issue: any) => issue.code)).toContain('sitemap.xrobots.noindex')
  })

  it('accepts a valid sitemap response', () => {
    const result = validateSitemapResponse({
      url: 'https://metravel.by/sitemap.xml',
      finalUrl: 'https://metravel.by/sitemap.xml',
      status: 200,
      headers: {
        'content-type': 'application/xml; charset=utf-8',
      },
      body: '<?xml version="1.0" encoding="UTF-8"?><urlset><url><loc>https://metravel.by/</loc></url></urlset>',
    })

    expect(result.issues).toEqual([])
  })

  it('accepts a valid travel page HTML', () => {
    const html = [
      '<!DOCTYPE html>',
      '<html lang="ru">',
      '<head>',
      '<title>Travel title | Metravel</title>',
      '<meta name="description" content="1234567890 1234567890 1234567890 1234567890 1234567890 1234567890 1234567890 1234567890"/>',
      '<link rel="canonical" href="https://metravel.by/travels/test"/>',
      '<meta property="og:title" content="Travel title | Metravel"/>',
      '<meta property="og:description" content="1234567890 1234567890 1234567890 1234567890 1234567890 1234567890 1234567890 1234567890"/>',
      '<meta property="og:image" content="https://metravel.by/image.jpg"/>',
      '<meta property="og:url" content="https://metravel.by/travels/test"/>',
      '<meta property="og:type" content="article"/>',
      '<meta name="twitter:card" content="summary_large_image"/>',
      '<meta name="twitter:title" content="Travel title | Metravel"/>',
      '<meta name="twitter:description" content="1234567890 1234567890 1234567890 1234567890 1234567890 1234567890 1234567890 1234567890"/>',
      '<meta name="twitter:image" content="https://metravel.by/image.jpg"/>',
      '<script type="application/ld+json">{"@context":"https://schema.org","@type":"Article","headline":"Travel title | Metravel"}</script>',
      '</head>',
      '<body><h1 data-ssg-travel-h1="true">Travel title</h1></body>',
      '</html>',
    ].join('')

    const result = validatePageResult({
      url: 'https://metravel.by/travels/test',
      finalUrl: 'https://metravel.by/travels/test',
      status: 200,
      headers: {},
      body: html,
    })

    expect(result.issues).toEqual([])
  })
})
