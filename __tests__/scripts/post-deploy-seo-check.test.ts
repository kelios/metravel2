const {
  detectPageType,
  parseSitemapUrls,
  validateCanonical,
  validateCorePageH1,
  validateHomeAssets,
  validatePageResult,
  validateRobots,
  validateSitemapResponse,
  validateTravelHtml,
  hasVisibleTravelSsgH1,
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

  it('rejects hidden, clipped, and duplicate travel H1 contracts', () => {
    const hidden = '<style>.ssg-travel-h1{position:absolute;width:1px;height:1px;clip:rect(0,0,0,0)}</style><h1 class="ssg-travel-h1">Travel title</h1>'
    expect(hasVisibleTravelSsgH1(hidden)).toBe(false)
    expect(validateTravelHtml(hidden).map((issue: any) => issue.code)).toContain('travel.h1.hidden')

    const visibleDuplicate = '<h1 class="ssg-travel-h1">Travel title</h1><h1>Duplicate</h1>'
    expect(hasVisibleTravelSsgH1(visibleDuplicate)).toBe(true)
    expect(validateTravelHtml(visibleDuplicate).map((issue: any) => issue.code)).toContain('travel.h1.count')

    const hiddenByLaterRule = '<style>.ssg-travel-h1{color:#111}html.ready .ssg-travel-h1{display:none}</style><h1 class="ssg-travel-h1">Travel title</h1>'
    expect(hasVisibleTravelSsgH1(hiddenByLaterRule)).toBe(false)
  })

  it.each(['/map', '/articles', '/contact'])(
    'requires exactly one raw H1 on %s',
    (path) => {
      expect(validateCorePageH1('<main></main>', `https://metravel.by${path}`)).toEqual([
        expect.objectContaining({ code: 'page.h1.count' }),
      ])
      expect(
        validateCorePageH1('<main><h1>Page title</h1></main>', `https://metravel.by${path}`),
      ).toEqual([])
      expect(
        validateCorePageH1(
          '<main><h1>Page title</h1><h1>Duplicate</h1></main>',
          `https://metravel.by${path}`,
        ),
      ).toEqual([expect.objectContaining({ code: 'page.h1.count' })])
    },
  )

  it('does not impose the core-page H1 contract on unrelated routes', () => {
    expect(validateCorePageH1('<main></main>', 'https://metravel.by/about')).toEqual([])
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
      '<body><h1 class="ssg-travel-h1">Travel title</h1></body>',
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

  it('fails when a checked URL redirects before the final HTML', () => {
    const html = [
      '<!DOCTYPE html>',
      '<html lang="ru">',
      '<head>',
      '<title>About | Metravel</title>',
      '<meta name="description" content="1234567890 1234567890 1234567890 1234567890 1234567890 1234567890 1234567890 1234567890"/>',
      '<link rel="canonical" href="https://metravel.by/about"/>',
      '<meta property="og:title" content="About | Metravel"/>',
      '<meta property="og:description" content="1234567890 1234567890 1234567890 1234567890 1234567890 1234567890 1234567890 1234567890"/>',
      '<meta property="og:image" content="https://metravel.by/image.jpg"/>',
      '<meta property="og:url" content="https://metravel.by/about"/>',
      '<meta property="og:type" content="website"/>',
      '<meta name="twitter:card" content="summary_large_image"/>',
      '<meta name="twitter:title" content="About | Metravel"/>',
      '<meta name="twitter:description" content="1234567890 1234567890 1234567890 1234567890 1234567890 1234567890 1234567890 1234567890"/>',
      '<meta name="twitter:image" content="https://metravel.by/image.jpg"/>',
      '</head>',
      '<body></body>',
      '</html>',
    ].join('')

    const result = validatePageResult({
      url: 'https://metravel.by/about/',
      finalUrl: 'https://metravel.by/about',
      status: 200,
      headers: {},
      body: html,
    })

    expect(result.issues.map((issue: any) => issue.code)).toContain('http.redirect')
  })

  describe('robots expectations', () => {
    const CLOSED = '<meta name="robots" content="noindex, nofollow"/>'
    const OPEN = '<meta name="robots" content="max-image-preview:large"/>'
    const codes = (html: string, pageType: string, url: string) =>
      validateRobots(html, pageType, url).map((issue: any) => issue.code)

    // The articles section is closed end to end by generate-seo-pages.js and is
    // absent from the sitemap, but the gate hardcodes /articles into its core
    // queue — so it used to report the intended state as robots.noindex on
    // every deploy.
    it.each([
      ['https://metravel.by/articles', 'page'],
      ['https://metravel.by/articles/', 'page'],
      ['https://metravel.by/article', 'page'],
      ['https://metravel.by/article/1', 'article'],
      ['https://metravel.by/places', 'page'],
    ])('accepts noindex on the deliberately closed %s', (url, pageType) => {
      expect(codes(CLOSED, pageType, url)).toEqual([])
    })

    it('still rejects noindex on routes that must stay indexable', () => {
      expect(codes(CLOSED, 'map', 'https://metravel.by/map')).toEqual(['robots.noindex'])
      expect(codes(CLOSED, 'travel', 'https://metravel.by/travels/test')).toEqual([
        'robots.noindex',
      ])
      expect(codes(CLOSED, 'home', 'https://metravel.by/')).toEqual(['robots.noindex'])
    })

    // The mirror defect: /places reached the 2026-08-08 audit precisely because
    // a closed route was live and indexable with no sitemap entry.
    it('rejects a closed route that quietly reopens', () => {
      expect(codes(OPEN, 'page', 'https://metravel.by/articles')).toEqual([
        'robots.closed.indexable',
      ])
      expect(codes('<title>x</title>', 'article', 'https://metravel.by/article/1')).toEqual([
        'robots.closed.indexable',
      ])
    })

    // #1762: страновой лендинг квестов идёт в выдачу, только если собирает
    // больше одного города, — на 04.09.2026 это 13 адресов из 32, а остальные
    // 19 несут `noindex, follow`. Все 32 лежат в sitemap.xml, который этот гейт
    // обходит целиком, поэтому без исключения деплой падал бы девятнадцатью
    // `robots.noindex`. Кто именно из них обязан быть закрыт, здесь неизвестно:
    // это знает каталог, и сверяет verify-static-quest-seo.js до деплоя.
    it('leaves the quest country family to the build-time gate, in both directions', () => {
      expect(codes(CLOSED, 'page', 'https://metravel.by/quests/country/france')).toEqual([])
      expect(codes(OPEN, 'page', 'https://metravel.by/quests/country/belarus')).toEqual([])
      expect(codes('<title>x</title>', 'page', 'https://metravel.by/quests/country/poland')).toEqual([])
    })

    it('does not extend that exception to the rest of the quests section', () => {
      expect(codes(CLOSED, 'page', 'https://metravel.by/quests')).toEqual(['robots.noindex'])
      expect(codes(CLOSED, 'page', 'https://metravel.by/quests/country')).toEqual(['robots.noindex'])
      expect(codes(CLOSED, 'page', 'https://metravel.by/quests/grodno')).toEqual(['robots.noindex'])
      expect(codes(CLOSED, 'page', 'https://metravel.by/quests/94/luninets-railway')).toEqual([
        'robots.noindex',
      ])
    })

    it('keeps the auth contract and falls back to strict when the URL is unknown', () => {
      expect(codes('<title>x</title>', 'auth', 'https://metravel.by/login')).toEqual([
        'robots.auth',
      ])
      expect(validateRobots(CLOSED, 'page', undefined).map((i: any) => i.code)).toEqual([
        'robots.noindex',
      ])
    })
  })
})
