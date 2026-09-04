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
  KIND_LABELS,
  SECTIONS,
  TOKEN_MAX_AGE_MS,
  TRAVELS_PER_PAGE,
  USAGE,
  assertCompleteSummary,
  assertInspectionCanContinue,
  assertKnownSitemapRouteFamilies,
  classify,
  classifyUrl,
  createCheckpointWriter,
  createTokenSource,
  inspect,
  inspectionOutcome,
  listTravels,
  parseArgs,
  parseSitemap,
  pickListRows,
  readCheckpoint,
  resolveSection,
  summarizeItems,
} = require('@/scripts/index-status')

const https = require('https')
const fs = require('fs')
const nodePath = require('path')
const { makeTempDir, removeDir, writeTextFile } = require('./cli-test-utils')
const { EventEmitter } = require('events')

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

  it('defaults the worker pool and leaves the checkpoint off', () => {
    const args = parseArgs(['node', 'index-status.js'])
    expect(args.concurrency).toBe(6)
    expect(args.checkpoint).toBeNull()
  })

  it('refuses --concurrency 0, which would inspect nothing and report a full slice', () => {
    expect(() => parseArgs(['node', 'index-status.js', '--concurrency', '0'])).toThrow(
      /--concurrency expects/,
    )
  })

  // `--checkpoint "$FILE"` with FILE unset expands to an empty string. Every other
  // string flag fails loudly when empty; this one would silently run the full
  // two-hour sweep with no log and nothing to resume from (SEO-OPS-001).
  it('refuses an empty checkpoint path instead of silently running without one', () => {
    expect(() => parseArgs(['node', 'index-status.js', '--checkpoint', ''])).toThrow(
      /--checkpoint expects/,
    )
  })
})

describe('checkpoint', () => {
  let dir: string

  beforeEach(() => {
    dir = makeTempDir('index-status-ckpt-')
  })

  afterEach(() => {
    removeDir(dir)
  })

  const file = () => nodePath.join(dir, 'run.jsonl')

  it('returns nothing when there is no checkpoint to resume from', () => {
    expect(readCheckpoint(null).size).toBe(0)
    expect(readCheckpoint(file()).size).toBe(0)
  })

  it('reuses settled verdicts and never a failed inspection', () => {
    writeTextFile(
      file(),
      [
        JSON.stringify({ url: 'https://metravel.by/a', verdict: 'PASS', coverageState: 'Indexed' }),
        JSON.stringify({ url: 'https://metravel.by/b', verdict: 'NEUTRAL', coverageState: 'Crawled' }),
        // The retry is exactly what a resume is for: a transient HTTP 500 must not
        // freeze into the slice as a verdict nobody will ever re-check.
        JSON.stringify({ url: 'https://metravel.by/c', verdict: 'ERROR', coverageState: 'HTTP 500' }),
        JSON.stringify({ url: 'https://metravel.by/d', verdict: 'UNKNOWN', coverageState: 'Unknown' }),
        JSON.stringify({ verdict: 'PASS', coverageState: 'Indexed' }),
        '',
      ].join('\n'),
    )
    const rows = readCheckpoint(file())
    expect([...rows.keys()]).toEqual(['https://metravel.by/a', 'https://metravel.by/b'])
  })

  it('lets a later verdict win over an earlier one for the same URL', () => {
    writeTextFile(
      file(),
      [
        JSON.stringify({ url: 'https://metravel.by/a', verdict: 'NEUTRAL', coverageState: 'Crawled' }),
        JSON.stringify({ url: 'https://metravel.by/a', verdict: 'PASS', coverageState: 'Indexed' }),
        '',
      ].join('\n'),
    )
    expect(readCheckpoint(file()).get('https://metravel.by/a').verdict).toBe('PASS')
  })

  it('drops a torn last line without losing the record appended after it', () => {
    // A run killed mid-write leaves half a line and no newline. Appending straight
    // onto it would glue the next record to the torn one and lose both.
    const settled = JSON.stringify({
      url: 'https://metravel.by/a',
      verdict: 'PASS',
      coverageState: 'Indexed',
    })
    writeTextFile(file(), `${settled}\n{"url":"https://metravel.by/b","verd`)
    expect([...readCheckpoint(file()).keys()]).toEqual(['https://metravel.by/a'])

    const write = createCheckpointWriter(file())
    write({ url: 'https://metravel.by/c', verdict: 'PASS', coverageState: 'Indexed' })
    expect([...readCheckpoint(file()).keys()]).toEqual([
      'https://metravel.by/a',
      'https://metravel.by/c',
    ])
  })

  it('creates the checkpoint directory and appends one line per verdict', () => {
    const nested = nodePath.join(dir, 'deep', 'run.jsonl')
    const write = createCheckpointWriter(nested)
    write({ url: 'https://metravel.by/a', verdict: 'PASS', coverageState: 'Indexed' })
    write({ url: 'https://metravel.by/b', verdict: 'FAIL', coverageState: 'Excluded' })
    expect(fs.readFileSync(nested, 'utf8').trimEnd().split('\n')).toHaveLength(2)
    expect([...readCheckpoint(nested).keys()]).toEqual([
      'https://metravel.by/a',
      'https://metravel.by/b',
    ])
  })

  it('is a no-op writer when no checkpoint was asked for', () => {
    expect(() => createCheckpointWriter(null)({ url: 'x', verdict: 'PASS' })).not.toThrow()
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

  it('classifies country landings separately from quest details and city landings', () => {
    expect(classifyUrl('/quests/country/poland')).toBe('quest-country')
    expect(classifyUrl('/quests/1/krakow-dragon')).toBe('quest-page')
    expect(classifyUrl('/quests/krakow')).toBe('quest-city')
    expect(KIND_LABELS['quest-country']).toContain('/quests/country/<')
    expect(USAGE).toContain('every quest, city, and country page')
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
<url><loc>https://metravel.by/quests/country/poland</loc></url>
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
      '/quests/country/poland',
      '/travels/staryy-i-novyy-zamki-v-grodno',
    ])
    expect(rows[4].url).toBe('https://metravel.by/travels/staryy-i-novyy-zamki-v-grodno')
  })

  it('labels each URL with its kind', () => {
    expect(parseSitemap(xml).map((r) => r.kind)).toEqual([
      'static',
      'quest-city',
      'quest-page',
      'quest-country',
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

describe('sitemap classifier coverage', () => {
  it('accepts each stable route-family shape from the production sitemap', () => {
    expect(() =>
      assertKnownSitemapRouteFamilies([
        { pathname: '/about' },
        { pathname: '/quests' },
        { pathname: '/quests/scenario' },
        { pathname: '/quests/krakow' },
        { pathname: '/quests/1/krakow-dragon' },
        { pathname: '/quests/country/poland' },
        { pathname: '/travels/minsk' },
        { pathname: '/travelsby' },
      ]),
    ).not.toThrow()
  })

  it('fails closed when the sitemap introduces an unknown nested or top-level family', () => {
    expect(() =>
      assertKnownSitemapRouteFamilies([
        { pathname: '/travels/minsk' },
        { pathname: '/quests/foo/bar' },
        { pathname: '/travels/foo/bar' },
        { pathname: '/stories/new-family' },
      ]),
    ).toThrow(/\/quests\/foo\/bar, \/stories\/new-family, \/travels\/foo\/bar/)
  })

  it('keeps the fail-closed check wired into the real sitemap loader before section filtering', () => {
    const source = fs.readFileSync(nodePath.join(process.cwd(), 'scripts/index-status.js'), 'utf8')
    expect(source).toContain('assertKnownSitemapRouteFamilies(sitemap)')
    expect(source.indexOf('assertKnownSitemapRouteFamilies(sitemap)')).toBeLessThan(
      source.indexOf('const kinds = SECTION_KINDS[section]'),
    )
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

describe('inspection result semantics', () => {
  it('keeps request failures and unknown payloads out of the Google not-indexed count', () => {
    expect(inspectionOutcome('PASS')).toBe('indexed')
    expect(inspectionOutcome('NEUTRAL')).toBe('notIndexed')
    expect(inspectionOutcome('FAIL')).toBe('notIndexed')
    expect(inspectionOutcome('ERROR')).toBe('unchecked')
    expect(inspectionOutcome('UNKNOWN')).toBe('unchecked')

    const summary = summarizeItems([
      { kind: 'travel', verdict: 'PASS', coverageState: 'Indexed' },
      { kind: 'travel', verdict: 'NEUTRAL', coverageState: 'Discovered' },
      { kind: 'quest-city', verdict: 'ERROR', coverageState: 'HTTP 500' },
      { kind: 'quest-city', verdict: 'UNKNOWN', coverageState: 'Unknown' },
      { kind: 'quest-country', verdict: 'PASS', coverageState: 'Indexed' },
    ])

    expect(summary).toMatchObject({ total: 5, indexed: 2, notIndexed: 1, unchecked: 2 })
    expect(summary.indexed + summary.notIndexed + summary.unchecked).toBe(summary.total)
    expect(summary.byKind).toEqual({
      travel: { total: 2, indexed: 1, notIndexed: 1, unchecked: 0 },
      'quest-city': { total: 2, indexed: 0, notIndexed: 0, unchecked: 2 },
      'quest-country': { total: 1, indexed: 1, notIndexed: 0, unchecked: 0 },
    })
    expect(summary.problems).toHaveLength(1)
    expect(summary.uncheckedItems).toHaveLength(2)
    expect(() => assertCompleteSummary(summary)).toThrow(/полный срез недействителен/)
    expect(() => assertCompleteSummary({ unchecked: 0, total: 0 })).not.toThrow()
  })

  it('stops on run-wide auth and quota failures after their allowed retry', () => {
    for (const status of [401, 403, 429]) {
      expect(() =>
        assertInspectionCanContinue({ ok: false, status }, 'https://metravel.by/map'),
      ).toThrow(new RegExp(`HTTP ${status}`))
    }
    expect(() =>
      assertInspectionCanContinue({ ok: false, status: 500 }, 'https://metravel.by/map'),
    ).not.toThrow()
  })

  it('times out a stalled URL Inspection request instead of hanging the sitemap run', async () => {
    const request = new EventEmitter()
    request.write = jest.fn()
    request.end = jest.fn(() => request.emit('timeout'))
    request.destroy = jest.fn((error) => request.emit('error', error))
    const requestSpy = jest.spyOn(https, 'request').mockReturnValue(request)

    try {
      await expect(inspect('token', 'sc-domain:metravel.by', 'https://metravel.by/map')).rejects.toThrow(
        /URL Inspection did not answer/,
      )
      expect(requestSpy.mock.calls[0][0].timeout).toBe(30_000)
    } finally {
      requestSpy.mockRestore()
    }
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

describe('listTravels pagination (#1766)', () => {
  const page = (asked: number, total: number, size = TRAVELS_PER_PAGE) => {
    const first = (asked - 1) * size
    return Array.from({ length: Math.max(0, Math.min(size, total - first)) }, (_, i) => ({
      id: first + i + 1,
      url: `/travels/slug-${first + i + 1}`,
      name: `Travel ${first + i + 1}`,
    }))
  }

  const drfApi = (total: number, size = TRAVELS_PER_PAGE) => {
    const pages = Math.max(1, Math.ceil(total / size))
    return jest.fn(async (url: string) => {
      const asked = Number(new URL(url).searchParams.get('page'))
      if (asked > pages) throw new Error(`HTTP 404 ${url}`)
      return {
        count: total,
        next: asked < pages ? `https://metravel.by/api/travels/?page=${asked + 1}` : null,
        results: page(asked, total, size),
      }
    })
  }

  it('stops on the last page when the count is an exact multiple of the page size', async () => {
    const fetchJson = drfApi(300)
    await expect(listTravels('https://metravel.by', 1, { fetchJson })).resolves.toHaveLength(300)
    expect(fetchJson).toHaveBeenCalledTimes(3)
  })

  it('reads every page when the last one is short', async () => {
    const fetchJson = drfApi(320)
    await expect(listTravels('https://metravel.by', 1, { fetchJson })).resolves.toHaveLength(320)
    expect(fetchJson).toHaveBeenCalledTimes(4)
  })

  it('asks for exactly the page size it checks against', async () => {
    const fetchJson = drfApi(320)
    await listTravels('https://metravel.by', 1, { fetchJson })
    for (const [url] of fetchJson.mock.calls) {
      expect(new URL(String(url)).searchParams.get('perPage')).toBe(String(TRAVELS_PER_PAGE))
    }
  })
})
