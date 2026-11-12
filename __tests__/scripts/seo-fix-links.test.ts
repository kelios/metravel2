/**
 * Batch-exit regression for scripts/seo-fix-links.js (#1655).
 *
 * A caught detail GET used to print a warning and continue without incrementing
 * the final failure count, so an entirely unreadable batch exited 0.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

jest.mock('@/scripts/lib/metravel-tool-session', () => ({
  ...jest.requireActual('@/scripts/lib/metravel-tool-session'),
  publicRequest: jest.fn(),
}))
const { publicRequest } = require('@/scripts/lib/metravel-tool-session')

const { getJson, listTravels, main } = require('@/scripts/seo-fix-links')

describe('seo-fix-links batch exit contract', () => {
  it('rejects a JSON error response instead of treating it as a travel detail', async () => {
    const base = 'https://metravel.by/api'
    publicRequest.mockResolvedValueOnce({ ok: false, status: 503 })
    await expect(getJson('/travels/41/', base)).rejects.toThrow('HTTP 503')
    expect(publicRequest).toHaveBeenCalledWith(base, `${base}/travels/41/`)
  })

  it('counts caught detail GET failures and prints the summary before failing', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const getJson = jest.fn().mockRejectedValue(new Error('GET unavailable'))

    try {
      await expect(
        main(['node', 'script', '--dry-run'], {
          loadSlugMap: () => new Map([['old-slug', 'new-slug']]),
          listTravels: jest.fn().mockResolvedValue([
            { id: 41, name: 'Первая статья' },
            { id: 42, name: 'Вторая статья' },
          ]),
          getJson,
        }),
      ).rejects.toThrow('2 of 2 published travels failed')

      expect(getJson).toHaveBeenCalledTimes(2)
      expect(warnSpy).toHaveBeenCalledTimes(2)
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('2 failed'))
    } finally {
      warnSpy.mockRestore()
      logSpy.mockRestore()
    }
  })
})

/**
 * Пагинация автора (#1755).
 *
 * DRF отвечает на страницу за последней не пустым списком, а HTTP 404 «Invalid
 * page», поэтому конец перечисления обязан считаться ДО запроса следующей
 * страницы. Признака «страница недобрала строк» для этого не хватает: при
 * количестве статей, кратном размеру страницы, последняя страница полна.
 */
describe('seo-fix-links author pagination', () => {
  const page = (index: number, total: number, size = 100) => {
    const first = (index - 1) * size
    const rows = Array.from({ length: Math.max(0, Math.min(size, total - first)) }, (_, i) => ({
      id: first + i + 1,
    }))
    return rows
  }

  /** DRF: {count, next, results}; страница за последней — 404, как на проде. */
  const drfApi = (total: number, size = 100) => {
    const pages = Math.max(1, Math.ceil(total / size))
    return jest.fn(async (urlPath: string) => {
      const asked = Number(new URLSearchParams(urlPath.split('?')[1]).get('page'))
      if (asked > pages) throw new Error(`HTTP 404 /travels/?page=${asked}`)
      return {
        count: total,
        next: asked < pages ? `https://metravel.by/api/travels/?page=${asked + 1}` : null,
        results: page(asked, total, size),
      }
    })
  }

  it('stops on the last page when the count is an exact multiple of the page size', async () => {
    const getJsonStub = drfApi(300)

    await expect(listTravels(1, { getJson: getJsonStub })).resolves.toHaveLength(300)
    expect(getJsonStub).toHaveBeenCalledTimes(3)
  })

  it('reads every page when the last one is short', async () => {
    const getJsonStub = drfApi(320)

    await expect(listTravels(1, { getJson: getJsonStub })).resolves.toHaveLength(320)
    expect(getJsonStub).toHaveBeenCalledTimes(4)
  })

  it('asks for exactly the page size it checks against', async () => {
    const getJsonStub = drfApi(320)

    await listTravels(1, { getJson: getJsonStub })

    for (const [urlPath] of getJsonStub.mock.calls) {
      expect(new URLSearchParams(String(urlPath).split('?')[1]).get('perPage')).toBe('100')
    }
  })

  it('falls back to total for a legacy envelope without the next cursor', async () => {
    const getJsonStub = jest.fn(async (urlPath: string) => {
      const asked = Number(new URLSearchParams(urlPath.split('?')[1]).get('page'))
      if (asked > 2) throw new Error(`HTTP 404 /travels/?page=${asked}`)
      return { total: 200, data: page(asked, 200) }
    })

    await expect(listTravels(1, { getJson: getJsonStub })).resolves.toHaveLength(200)
    expect(getJsonStub).toHaveBeenCalledTimes(2)
  })

  it('does not mistake a null count for an exhausted list', async () => {
    const getJsonStub = jest.fn(async (urlPath: string) => {
      const asked = Number(new URLSearchParams(urlPath.split('?')[1]).get('page'))
      if (asked > 2) throw new Error(`HTTP 404 /travels/?page=${asked}`)
      return { total: null, count: null, data: page(asked, 150) }
    })

    await expect(listTravels(1, { getJson: getJsonStub })).resolves.toHaveLength(150)
  })
})

/**
 * #3330: ссылка через 301 стояла в `recommendation`, а инструмент читал только
 * `description` и печатал «0». Все шаги — переписывание, проверка порчи, откат
 * и живая проверка полноты — идут по одному списку полей.
 */
describe('seo-fix-links: every link field of an article (#3330)', () => {
  const {
    TRAVEL_LINK_FIELDS, findUnhandledLinkFields, rewriteLinks, rewriteTravelFields, scanTravelLinks,
  } = require('@/scripts/lib/travelBodyLinks')
  const { classifyAddress, detectRegression, redirectTargetSlug } = require('@/scripts/seo-fix-links')

  const slugMap = new Map([['old-slug', 'new-slug'], ['old-two', 'new-two']])
  const pace = async () => {}
  const article = (overrides: Record<string, unknown> = {}) => ({
    id: 41,
    slug: 'article-41',
    name: 'Первая статья',
    user: { id: 1, name: 'Юля' },
    publish: true,
    moderation: true,
    gallery: [],
    coordsMeTravel: [],
    description: '<p>Текст без ссылок на переименованные статьи, достаточно длинный.</p>',
    recommendation: null,
    plus: null,
    minus: null,
    ...overrides,
  })
  const silence = () => {
    const spies = [
      jest.spyOn(console, 'log').mockImplementation(() => {}),
      jest.spyOn(console, 'warn').mockImplementation(() => {}),
      jest.spyOn(console, 'error').mockImplementation(() => {}),
    ]
    return { log: spies[0], restore: () => spies.forEach((spy) => spy.mockRestore()) }
  }
  const printed = (spy: jest.SpyInstance) => spy.mock.calls.map((call) => String(call[0])).join('\n')

  it('walks the four rich-text fields the upsert accepts', () => {
    expect([...TRAVEL_LINK_FIELDS]).toEqual(['description', 'recommendation', 'plus', 'minus'])
  })

  it('reads relative and own-host addresses and leaves foreign ones alone', () => {
    const html = [
      '<a href="/travels/old-slug">a</a>',
      '<a href="https://metravel.by/travels/old-slug">b</a>',
      'текст:https://www.metravel.by/travels/old-two.',
      '<a href="https://example.com/travels/old-slug">чужой сайт</a>',
      '<a href="/blog/travels/old-slug">чужой раздел</a>',
      '<a href="https://dev.metravel.by/travels/old-slug">дев</a>',
    ].join(' ')

    expect(scanTravelLinks(html).map((link: { slug: string }) => link.slug)).toEqual(['old-slug', 'old-slug', 'old-two'])
    const { html: out, count } = rewriteLinks(html, slugMap)
    expect(count).toBe(3)
    expect(out).toContain('href="/travels/new-slug"')
    expect(out).toContain('https://metravel.by/travels/new-slug"')
    expect(out).toContain('https://www.metravel.by/travels/new-two.')
    expect(out).toContain('https://example.com/travels/old-slug')
    expect(out).toContain('/blog/travels/old-slug')
    expect(out).toContain('https://dev.metravel.by/travels/old-slug')
  })

  it('never rewrites an address it could not read to its end', () => {
    const html = '<a href="/travels/old-slug_draft">x</a>'
    expect(scanTravelLinks(html)).toEqual([expect.objectContaining({ slug: 'old-slug', partial: true })])
    expect(rewriteLinks(html, slugMap)).toEqual({ html, count: 0 })
  })

  it('rewrites recommendation, plus and minus and reports the count per field', () => {
    const detail = article({
      recommendation: '<a href="/travels/old-slug">1</a> <a href="/travels/old-two">2</a>',
      plus: 'https://metravel.by/travels/old-slug',
      minus: '<a href="/travels/current-slug">живая</a>',
    })

    expect(rewriteTravelFields(detail, slugMap)).toEqual({
      changes: {
        recommendation: '<a href="/travels/new-slug">1</a> <a href="/travels/new-two">2</a>',
        plus: 'https://metravel.by/travels/new-slug',
      },
      counts: { recommendation: 2, plus: 1 },
      total: 3,
    })
  })

  it('names a link sitting in a field the tool does not rewrite, ignoring derived copies', () => {
    const detail = article({
      url: '/travels/article-41',
      rich_text: { description: { safe_html: '<a href="/travels/old-slug">x</a>' } },
      coordsMeTravel: [{ note: 'см. /travels/old-slug' }],
      teaser: '<a href="/travels/old-two">y</a>',
    })
    expect(findUnhandledLinkFields(detail)).toEqual(['coordsMeTravel[].note', 'teaser'])
  })

  it('dry-run counts links in every field and splits them by field and by author', async () => {
    const out = silence()
    const report = path.join(os.tmpdir(), `seo-fix-links-dry-${process.pid}.json`)
    const details: Record<string, unknown> = {
      '/travels/41/': article({ recommendation: '<a href="/travels/old-slug">1</a><a href="/travels/old-two">2</a>' }),
      '/travels/42/': article({ id: 42, user: { id: 7 }, description: '<a href="/travels/old-slug">x</a>', plus: '/travels/old-two' }),
      '/travels/43/': article({ id: 43 }),
    }
    try {
      await main(['node', 'script', '--dry-run', '--user-id', 'all', '--report', report], {
        pace,
        loadSlugMap: () => slugMap,
        listTravels: jest.fn().mockResolvedValue([{ id: 41 }, { id: 42 }, { id: 43 }]),
        getJson: jest.fn(async (urlPath: string) => details[urlPath]),
      })

      expect(printed(out.log)).toContain('Dry-run: 2 article(s), 4 link(s).')
      expect(JSON.parse(fs.readFileSync(report, 'utf8'))).toMatchObject({
        mode: 'dry-run',
        scannedArticles: 3,
        totals: {
          occurrences: 4,
          articles: 2,
          byField: { recommendation: 2, description: 1, plus: 1 },
          byAuthor: { 'author-1': { occurrences: 2, articles: 1 }, guest: { occurrences: 2, articles: 1 } },
        },
        articles: [
          { id: 41, authorId: 1, links: 2, byField: { recommendation: 2 } },
          { id: 42, authorId: 7, links: 2, byField: { description: 1, plus: 1 } },
        ],
      })
    } finally {
      out.restore()
      fs.rmSync(report, { force: true })
    }
  })

  it('apply sends every rewritten field in one PUT and keeps the rest of the article', async () => {
    const out = silence()
    const before = article({
      recommendation: '<p>Советуем: <a href="/travels/old-slug">маршрут</a></p>',
      plus: '<p>Плюсы: /travels/old-two</p>',
      minus: '<p>Минусы без ссылок</p>',
    })
    const after = { ...before, recommendation: '<p>Советуем: <a href="/travels/new-slug">маршрут</a></p>', plus: '<p>Плюсы: /travels/new-two</p>' }
    const request = jest.fn().mockResolvedValue({ status: 200, text: '{}' })
    const restore = jest.fn()
    try {
      await main(['node', 'script', '--apply'], {
        pace,
        loadSlugMap: () => slugMap,
        listTravels: jest.fn().mockResolvedValue([{ id: 41 }]),
        getJson: jest.fn().mockResolvedValueOnce(before).mockResolvedValueOnce(after),
        saveBackup: jest.fn(() => '/tmp/41-backup.json'),
        request,
        restore,
      })

      expect(request).toHaveBeenCalledTimes(1)
      expect(request.mock.calls[0][2]).toMatchObject({
        id: 41,
        description: before.description,
        recommendation: after.recommendation,
        plus: after.plus,
        minus: before.minus,
      })
      expect(restore).not.toHaveBeenCalled()
      expect(printed(out.log)).toContain('2 link(s) rewritten: recommendation 1, plus 1')
    } finally {
      out.restore()
    }
  })

  it('rolls an article back when a stale link survives the write in any field', async () => {
    const out = silence()
    const before = article({ recommendation: '<a href="/travels/old-slug">маршрут</a>' })
    const restore = jest.fn()
    try {
      await expect(main(['node', 'script', '--apply'], {
        pace,
        loadSlugMap: () => slugMap,
        listTravels: jest.fn().mockResolvedValue([{ id: 41 }]),
        // the write silently did nothing: the re-read is the old article
        getJson: jest.fn().mockResolvedValue(before),
        saveBackup: jest.fn(() => '/tmp/41-backup.json'),
        request: jest.fn().mockResolvedValue({ status: 200, text: '{}' }),
        restore,
      })).rejects.toThrow('1 of 1 published travels failed')

      expect(restore).toHaveBeenCalledWith(41)
    } finally {
      out.restore()
    }
  })

  it('holds an echoed field to the same bar: a collapsed plus is a regression', () => {
    const before = article({ recommendation: '<a href="/travels/old-slug">x</a>', plus: 'П'.repeat(400) })
    const after = { ...before, recommendation: '<a href="/travels/new-slug">x</a>', plus: 'П'.repeat(100) }
    expect(detectRegression(before, after, slugMap)).toEqual(['plus shrank 400 → 100'])
  })

  it('measures a rewritten field against its expected length: a much shorter new slug is not a collapse (#264)', () => {
    const longOld = 'marshrut-na-odin-den-dvorec-stanislava-varshickogo-zamok-morsko-peshchera-stefanova-dzyura-dzyadova-peshchera'
    const shortNew = 'zamok-bekovets-i-dvorets-varshitskogo-marshrut'
    const map = new Map([[longOld, shortNew]])
    const field = (slug: string) =>
      `<p>Замок "Бековец"&nbsp;<a href="https://metravel.by/travels/${slug}" rel="noopener noreferrer" target="_blank">https://metravel.by/travels/${slug}</a></p>`
    const before = article({ recommendation: field(longOld) })
    const after = { ...before, recommendation: field(shortNew) }
    expect(after.recommendation.length).toBeLessThan(Math.floor(before.recommendation.length * 0.9))
    expect(detectRegression(before, after, map)).toEqual([])
    // the bar still holds against the expected text: a rewritten field that came back cut is caught
    const cut = { ...before, recommendation: '<p>Замок</p>' }
    expect(detectRegression(before, cut, map)).toEqual([`recommendation shrank ${field(shortNew).length} → ${cut.recommendation.length}`])
  })

  it('stops the batch and rolls back when a rewritten field comes back with mangled text', async () => {
    const out = silence()
    const first = article({ recommendation: '<p>Маршрут: <a href="/travels/old-slug">тут</a></p>' })
    const mangled = { ...first, recommendation: '<p>Маршру��: <a href="/travels/new-slug">тут</a></p>' }
    const getJsonStub = jest.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(mangled)
    const request = jest.fn().mockResolvedValue({ status: 200, text: '{}' })
    const restore = jest.fn()
    try {
      await expect(main(['node', 'script', '--apply'], {
        pace,
        loadSlugMap: () => slugMap,
        listTravels: jest.fn().mockResolvedValue([{ id: 41 }, { id: 42 }]),
        getJson: getJsonStub,
        saveBackup: jest.fn(() => '/tmp/41-backup.json'),
        request,
        restore,
      })).rejects.toThrow('1 of 2 published travels failed')

      expect(restore).toHaveBeenCalledWith(41)
      // the second article was never read, let alone written
      expect(getJsonStub).toHaveBeenCalledTimes(2)
      expect(request).toHaveBeenCalledTimes(1)
    } finally {
      out.restore()
    }
  })

  it('reads the redirect target only off an article address of the own site', () => {
    expect(redirectTargetSlug('/travels/new-slug')).toBe('new-slug')
    expect(redirectTargetSlug('https://metravel.by/travels/new-slug?utm=1')).toBe('new-slug')
    expect(redirectTargetSlug('https://metravel.by/travelsby')).toBeNull()
    expect(redirectTargetSlug('https://example.com/travels/new-slug')).toBeNull()
    expect(redirectTargetSlug('')).toBeNull()
  })

  it('classifies a live answer against the mirror', () => {
    expect(classifyAddress('live', { status: 200, location: '' }, slugMap)).toEqual({ state: 'ok', status: 200 })
    expect(classifyAddress('old-slug', { status: 301, location: '/travels/new-slug' }, slugMap))
      .toEqual({ state: 'stale', status: 301, to: 'new-slug' })
    expect(classifyAddress('renamed-in-editor', { status: 301, location: '/travels/current' }, slugMap))
      .toEqual({ state: 'missing', status: 301, to: 'current' })
    expect(classifyAddress('old-slug', { status: 301, location: '/travels/renamed-again' }, slugMap))
      .toEqual({ state: 'mismatch', status: 301, to: 'renamed-again', mirrorTo: 'new-slug' })
    expect(classifyAddress('hub', { status: 301, location: 'https://metravel.by/travelsby' }, slugMap))
      .toMatchObject({ state: 'unmappable' })
    expect(classifyAddress('gone', { status: 404, location: '' }, slugMap)).toEqual({ state: 'not-found', status: 404 })
    expect(classifyAddress('busy', { status: 503, location: '' }, slugMap)).toEqual({ state: 'unverified', status: 503 })
    expect(classifyAddress('down', null, slugMap)).toEqual({ state: 'unverified', status: null })
  })

  describe('--check: the live completeness proof', () => {
    const details: Record<string, unknown> = {
      '/travels/41/': article({
        description: '<a href="/travels/live-one">200</a> <a href="/travels/old-slug">301 из зеркала</a>',
        recommendation: '<a href="/travels/renamed-in-editor">301 мимо зеркала</a> <a href="/travels/live-one">200</a>',
      }),
      '/travels/42/': article({ id: 42, user: { id: 7 }, minus: 'https://metravel.by/travels/gone-article и /travels/renamed-in-editor' }),
    }
    const answers: Record<string, { status: number; location: string }> = {
      'live-one': { status: 200, location: '' },
      'old-slug': { status: 301, location: '/travels/new-slug' },
      'renamed-in-editor': { status: 301, location: 'https://metravel.by/travels/current-name' },
      'gone-article': { status: 404, location: '' },
    }
    const run = (argv: string[], extra: Record<string, unknown> = {}) => {
      const probeAddress = jest.fn(async (slug: string) => answers[slug])
      const appendRedirects = jest.fn()
      const request = jest.fn()
      const promise = main(['node', 'script', '--check', ...argv], {
        pace,
        loadSlugMap: () => slugMap,
        listTravels: jest.fn().mockResolvedValue([{ id: 41 }, { id: 42 }]),
        getJson: jest.fn(async (urlPath: string) => details[urlPath]),
        probeAddress,
        appendRedirects,
        request,
        ...extra,
      })
      return { promise, probeAddress, appendRedirects, request }
    }

    it('probes each address once and fails while any of them is not a 200', async () => {
      const out = silence()
      const report = path.join(os.tmpdir(), `seo-fix-links-check-${process.pid}.json`)
      try {
        const { promise, probeAddress, appendRedirects, request } = run(['--report', report])
        await expect(promise).rejects.toThrow('3 of 4 internal address(es) do not answer 200')

        expect(probeAddress.mock.calls.map((call) => call[0]).sort())
          .toEqual(['gone-article', 'live-one', 'old-slug', 'renamed-in-editor'])
        expect(request).not.toHaveBeenCalled()
        expect(appendRedirects).not.toHaveBeenCalled()
        expect(JSON.parse(fs.readFileSync(report, 'utf8'))).toMatchObject({
          mode: 'check',
          addresses: 4,
          states: { ok: 1, stale: 1, missing: 1, 'not-found': 1 },
          redirects: {
            occurrences: 3,
            articles: 2,
            byField: { description: 1, recommendation: 1, minus: 1 },
            byAuthor: { 'author-1': { occurrences: 2, articles: 1 }, guest: { occurrences: 1, articles: 1 } },
          },
          missingFromMirror: [{ from: 'renamed-in-editor', to: 'current-name' }],
          mirrorUpdated: false,
        })
      } finally {
        out.restore()
        fs.rmSync(report, { force: true })
      }
    })

    it('--update-mirror appends only the redirects the mirror lacks', async () => {
      const out = silence()
      try {
        const { promise, appendRedirects } = run(['--update-mirror'])
        await expect(promise).rejects.toThrow('do not answer 200')
        expect(appendRedirects).toHaveBeenCalledWith([{ from: 'renamed-in-editor', to: 'current-name' }])
      } finally {
        out.restore()
      }
    })

    it('passes only when every address answers 200', async () => {
      const out = silence()
      try {
        const { promise } = run([], { probeAddress: jest.fn().mockResolvedValue({ status: 200, location: '' }) })
        await expect(promise).resolves.toBeUndefined()
        expect(printed(out.log)).toContain('Every internal address in these articles answers 200')
      } finally {
        out.restore()
      }
    })

    it('does not read an unanswered probe as a clean address', async () => {
      const out = silence()
      try {
        const probeAddress = jest.fn().mockRejectedValue(new Error('timeout'))
        const { promise } = run([], { probeAddress })
        await expect(promise).rejects.toThrow('4 of 4 internal address(es) do not answer 200')
        // each address got its one retry before being called unverified
        expect(probeAddress).toHaveBeenCalledTimes(8)
      } finally {
        out.restore()
      }
    })

    it('retries an address once, so a single timed-out render is not a finding', async () => {
      const out = silence()
      try {
        const probeAddress = jest.fn()
          .mockRejectedValueOnce(new Error('timeout'))
          .mockResolvedValue({ status: 200, location: '' })
        const { promise } = run([], { probeAddress })
        await expect(promise).resolves.toBeUndefined()
        expect(probeAddress).toHaveBeenCalledTimes(5)
      } finally {
        out.restore()
      }
    })

    it('stays red for a link in a field it cannot rewrite even when all addresses are live', async () => {
      const out = silence()
      try {
        const { promise } = run([], {
          getJson: jest.fn(async () => article({ teaser: '<a href="/travels/live-one">x</a>' })),
          probeAddress: jest.fn().mockResolvedValue({ status: 200, location: '' }),
        })
        await expect(promise).rejects.toThrow('carry links in fields this tool does not rewrite')
      } finally {
        out.restore()
      }
    })
  })

  it('refuses to write for every author at once and to update the mirror outside --check', async () => {
    await expect(main(['node', 'script', '--apply', '--user-id', 'all'], { pace })).rejects.toThrow('--user-id all cannot be combined with --apply')
    await expect(main(['node', 'script', '--dry-run', '--update-mirror'], { pace })).rejects.toThrow('--update-mirror requires --check')
    await expect(main(['node', 'script', '--apply', '--report', 'x.json'], { pace })).rejects.toThrow('--report cannot be combined with --apply')
  })

  it('asks for every author when the scope is "all"', async () => {
    const getJsonStub = jest.fn(async (_urlPath: string) => ({ count: 1, next: null, results: [{ id: 1 }] }))
    await listTravels('all', { getJson: getJsonStub })
    const where = JSON.parse(new URLSearchParams(String(getJsonStub.mock.calls[0][0]).split('?')[1]).get('where') as string)
    expect(where).toEqual({ publish: 1, moderation: 1 })
  })
})
