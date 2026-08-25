/**
 * Regression tests for scripts/index-status.js
 *
 * The indexing monitor read the travel list as `res.data || res.items || res.rows`
 * while `/api/travels/` answers `{count, next, results}`. The list came back empty,
 * the report printed "Всего проверено: 0" and exited 0 — a green report that had
 * checked nothing. It stayed invisible while indexing fell 291/306 → 203/306.
 *
 * The second blind spot was the scope itself (#1559): the monitor only ever knew
 * about one author's `/travels/`, 310 of the 673 URLs in sitemap.xml, so 17 city
 * pages outside the index went unnoticed for months. `--section` covers the rest.
 * Widening the run also made it outlive its own credentials, which is what the
 * token-source tests below are about.
 */

jest.mock('@/scripts/lib/google-token', () => ({
  getAccessToken: jest.fn(),
  authMode: () => 'oauth',
}))

const { getAccessToken } = require('@/scripts/lib/google-token')

const {
  SECTIONS,
  TOKEN_MAX_AGE_MS,
  classify,
  classifyUrl,
  createTokenSource,
  parseArgs,
  parseSitemap,
  pickListRows,
  resolveSection,
} = require('@/scripts/index-status')

describe('pickListRows', () => {
  it('reads the current API envelope {count, next, results}', () => {
    const rows = pickListRows({
      count: 306,
      next: 'https://metravel.by/api/travels/?page=2',
      previous: null,
      results: [{ id: 1 }, { id: 2 }],
    })
    expect(rows).toEqual([{ id: 1 }, { id: 2 }])
  })

  it('still reads the legacy shapes', () => {
    expect(pickListRows({ data: [{ id: 3 }] })).toEqual([{ id: 3 }])
    expect(pickListRows({ items: [{ id: 4 }] })).toEqual([{ id: 4 }])
    expect(pickListRows({ rows: [{ id: 5 }] })).toEqual([{ id: 5 }])
    expect(pickListRows([{ id: 6 }])).toEqual([{ id: 6 }])
  })

  it('prefers results over the legacy keys when both are present', () => {
    expect(pickListRows({ results: [{ id: 7 }], data: [{ id: 8 }] })).toEqual([{ id: 7 }])
  })

  it('returns an empty list for unknown or malformed payloads', () => {
    expect(pickListRows({ count: 0 })).toEqual([])
    expect(pickListRows({ results: 'nope' })).toEqual([])
    expect(pickListRows(null)).toEqual([])
    expect(pickListRows('')).toEqual([])
  })
})

describe('parseArgs', () => {
  it('defaults to the author section and the production property', () => {
    const args = parseArgs(['node', 'index-status.js'])
    expect(args.section).toBe('articles')
    expect(args.site).toBe('sc-domain:metravel.by')
    expect(args.json).toBe(false)
    expect(args.limit).toBe(0)
  })

  it('reads the flags used by the SEO routine', () => {
    const args = parseArgs(['node', 'index-status.js', '--json', '--only-problems', '--limit', '5'])
    expect(args.json).toBe(true)
    expect(args.onlyProblems).toBe(true)
    expect(args.limit).toBe(5)
  })

  it('reads the whole-sitemap section', () => {
    expect(parseArgs(['node', 'index-status.js', '--section', 'all']).section).toBe('all')
  })
})

describe('resolveSection', () => {
  it('still defaults to the owner author, so the daily run means what it did', () => {
    expect(resolveSection(parseArgs(['node', 'index-status.js']))).toEqual({
      section: 'articles',
      userId: '1',
    })
  })

  it('honours an explicit author on the articles section', () => {
    const args = parseArgs(['node', 'index-status.js', '--user-id', '7'])
    expect(resolveSection(args).userId).toBe('7')
  })

  it('covers every declared section', () => {
    expect(SECTIONS).toEqual(['articles', 'travels', 'quests', 'all'])
    for (const section of SECTIONS) {
      const args = parseArgs(['node', 'index-status.js', '--section', section])
      expect(resolveSection(args).section).toBe(section)
    }
  })

  it('drops the author on the sitemap sections instead of pretending to filter', () => {
    expect(resolveSection(parseArgs(['node', 'index-status.js', '--section', 'all'])).userId).toBeNull()
  })

  it('refuses an unknown section rather than falling back to the default', () => {
    const args = parseArgs(['node', 'index-status.js', '--section', 'quets'])
    expect(() => resolveSection(args)).toThrow(/--section expects one of/)
  })

  it('refuses --user-id where it cannot be honoured (SEO-OPS-001)', () => {
    const args = parseArgs(['node', 'index-status.js', '--section', 'quests', '--user-id', '1'])
    expect(() => resolveSection(args)).toThrow(/--user-id works only with --section articles/)
  })
})

describe('classifyUrl', () => {
  it('tells a quest page apart from the city page that lists it', () => {
    expect(classifyUrl('/quests/1/krakow-dragon')).toBe('quest-page')
    expect(classifyUrl('/quests/krakow')).toBe('quest-city')
  })

  it('keeps the catalog routes out of the city pages', () => {
    // `/quests` lists every city and `/quests/scenario` groups quests by scenario:
    // counted as city pages they would inflate the section by two non-existent cities.
    expect(classifyUrl('/quests')).toBe('static')
    expect(classifyUrl('/quests/scenario')).toBe('static')
  })

  it('classifies articles and the remaining routes', () => {
    expect(classifyUrl('/travels/staryy-i-novyy-zamki-v-grodno')).toBe('travel')
    expect(classifyUrl('/map')).toBe('static')
    expect(classifyUrl('/')).toBe('static')
  })
})

describe('parseSitemap', () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>https://metravel.by/quests</loc></url>
<url><loc>https://metravel.by/quests/rome</loc></url>
<url><loc>https://metravel.by/quests/1/krakow-dragon</loc></url>
<url><loc>
  https://metravel.by/travels/staryy-i-novyy-zamki-v-grodno
</loc></url>
<url><loc>https://metravel.by/quests/rome</loc></url>
<url><loc>not a url</loc></url>
</urlset>`

  it('reads every <loc> once, whitespace and duplicates included', () => {
    const rows = parseSitemap(xml)
    expect(rows.map((r) => r.pathname)).toEqual([
      '/quests',
      '/quests/rome',
      '/quests/1/krakow-dragon',
      '/travels/staryy-i-novyy-zamki-v-grodno',
    ])
    expect(rows[3].url).toBe('https://metravel.by/travels/staryy-i-novyy-zamki-v-grodno')
  })

  it('labels each URL with its kind', () => {
    expect(parseSitemap(xml).map((r) => r.kind)).toEqual([
      'static',
      'quest-city',
      'quest-page',
      'travel',
    ])
  })

  it('normalizes a trailing slash, so /map/ is classified as /map', () => {
    expect(parseSitemap('<loc>https://metravel.by/map/</loc>')[0].pathname).toBe('/map')
    expect(parseSitemap('<loc>https://metravel.by/</loc>')[0].pathname).toBe('/')
  })

  it('returns an empty list for an empty or broken sitemap, never a fake row', () => {
    expect(parseSitemap('')).toEqual([])
    expect(parseSitemap(null)).toEqual([])
    expect(parseSitemap('<html>404</html>')).toEqual([])
  })
})

describe('createTokenSource', () => {
  beforeEach(() => {
    let minted = 0
    getAccessToken.mockReset()
    getAccessToken.mockImplementation(async () => ({ accessToken: `token-${++minted}` }))
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('mints once and reuses the token inside its lifetime', async () => {
    const getToken = createTokenSource()
    expect(await getToken()).toBe('token-1')
    expect(await getToken()).toBe('token-1')
    expect(getAccessToken).toHaveBeenCalledTimes(1)
  })

  it('re-mints before Google expires the token, so a long run cannot end in HTTP 401 rows', async () => {
    // Google answers `expires_in: 3599`, and `--section all` inspects 673 URLs at
    // ~6.7 s each — over an hour. A token taken once at the start dies mid-run and
    // every remaining URL would be filed as «не в индексе» on an auth failure.
    expect(TOKEN_MAX_AGE_MS).toBeLessThan(3599 * 1000)

    let clock = 1_000_000
    jest.spyOn(Date, 'now').mockImplementation(() => clock)
    const getToken = createTokenSource()

    expect(await getToken()).toBe('token-1')
    clock += TOKEN_MAX_AGE_MS - 1
    expect(await getToken()).toBe('token-1')
    clock += 1
    expect(await getToken()).toBe('token-2')
  })

  it('refreshes on demand when a 401 says the token is already dead', async () => {
    const getToken = createTokenSource()
    expect(await getToken()).toBe('token-1')
    expect(await getToken(true)).toBe('token-2')
  })

  it('drops the dead token when a refresh fails, so the next call takes the run down', async () => {
    const getToken = createTokenSource()
    expect(await getToken()).toBe('token-1')

    getAccessToken.mockRejectedValueOnce(new Error('OAuth refresh failed (400)'))
    await expect(getToken(true)).rejects.toThrow('OAuth refresh failed')

    // Not the stale token again: the next URL has to reach the same failure
    // instead of collecting one HTTP 401 row after another.
    getAccessToken.mockRejectedValueOnce(new Error('OAuth refresh failed (400)'))
    await expect(getToken()).rejects.toThrow('OAuth refresh failed')
  })
})

describe('classify', () => {
  it('maps an indexed URL inspection result', () => {
    const info = classify({
      inspectionResult: {
        indexStatusResult: {
          verdict: 'PASS',
          coverageState: 'Страница отправлена и проиндексирована',
          lastCrawlTime: '2026-08-04T00:00:00Z',
        },
      },
    })
    expect(info.verdict).toBe('PASS')
    expect(info.coverageState).toBe('Страница отправлена и проиндексирована')
  })

  it('falls back to UNKNOWN on an empty response instead of throwing', () => {
    expect(classify({}).verdict).toBe('UNKNOWN')
    expect(classify(null).coverageState).toBe('Unknown')
  })
})
