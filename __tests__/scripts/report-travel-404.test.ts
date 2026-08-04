const {
  parseArgs,
  extractTravelSlug,
  gluedPrefix,
  buildKnownMatchers,
  classifySlug,
  digestRawLog,
  buildReport,
  formatReport,
  verifyLive,
  readToken,
  collectDraftSlugs,
  fetchDrafts,
  annotateDrafts,
  requestedHours,
  windowHours,
} = require('@/scripts/report-travel-404')

const KNOWN = {
  noiseSlugs: ['mock', 'test'],
  noisePatterns: ['^definitely-not-a-real-slug'],
  intentional404: [{ slug: 'gdansk-i-sopot', ticket: 1197, reason: 'слаг занят непубличной статьёй' }],
}

const ctx = (overrides: Record<string, unknown> = {}) => ({
  since: '24h',
  source: 'fixture.log',
  redirectFrom: new Map([['liniya-stalina', 'liniia-stalina-chto-posmotret-i-kak-doekhat']]),
  known: buildKnownMatchers(KNOWN),
  ...overrides,
})

const logLine = (request: string, status: number, time = '2026-08-04T09:00:00+00:00') =>
  `{"time":"${time}","request":"${request}","status":${status},"route_family":"other"}`

describe('report-travel-404 / разбор запроса', () => {
  it('достаёт слаг и игнорирует query, hash и хвостовой слэш', () => {
    expect(extractTravelSlug('GET /travels/liniya-stalina HTTP/2.0')).toMatchObject({ slug: 'liniya-stalina' })
    expect(extractTravelSlug('GET /travels/vena/?utm=1#x HTTP/1.1')).toMatchObject({ slug: 'vena', nested: false })
  })

  it('не считает своими чужие маршруты и методы', () => {
    expect(extractTravelSlug('GET /api/travels/637/ HTTP/1.1')).toBeNull()
    expect(extractTravelSlug('GET /quests/1/krakow-dragon HTTP/1.1')).toBeNull()
    expect(extractTravelSlug('POST /travels/vena HTTP/1.1')).toBeNull()
    expect(extractTravelSlug('GET /travels/ HTTP/1.1')).toBeNull()
  })

  it('поднимает признаки битого адреса вместо того чтобы падать', () => {
    expect(extractTravelSlug('GET /travels/vena/foto HTTP/1.1')).toMatchObject({ slug: 'vena', nested: true })
    expect(extractTravelSlug('GET /travels/%E0%A4%A HTTP/1.1')).toMatchObject({ undecodable: true })
  })

  it('декодирует percent-кодирование', () => {
    expect(extractTravelSlug('GET /travels/%D0%B2%D0%B5%D0%BD%D0%B0 HTTP/1.1')).toMatchObject({ slug: 'вена' })
  })
})

describe('report-travel-404 / склейки', () => {
  it('вырезает из склейки первый адрес — он и есть настоящий мёртвый слаг', () => {
    expect(
      gluedPrefix(
        'dvorets-moniushko-vankovichei-v-smilovichakh-istoriia-legendy-i-poleznaia-informatsiia-dlia-turistov-dvorets-moniushko-vankovichei-v-smilovichakh-odn'
      )
    ).toBe('dvorets-moniushko-vankovichei-v-smilovichakh-istoriia-legendy-i-poleznaia-informatsiia-dlia-turistov')
  })

  it('не считает склейкой обычные длинные слаги', () => {
    expect(gluedPrefix('chto-posmotret-v-kutaisi-peshchery-kanony-monastyri-i-interesnye-mesta-riadom-s-batumi')).toBeNull()
    expect(gluedPrefix('liniia-stalina-chto-posmotret-i-kak-doekhat')).toBeNull()
  })

  it('подсказывает, что первый адрес уже покрыт манифестом', () => {
    const head = 'usadba-trabutishki-i-golubye-ozera'
    const first = `${head}-kak-doekhat`
    const withManifest = ctx({ redirectFrom: new Map([[first, 'usadba-trabutishki-i-golubye-ozera-marshrut']]) })
    const entry = { slug: `${first}-${head}-odn`, nested: false, undecodable: false }
    expect(classifySlug(entry, withManifest)).toMatchObject({
      bucket: 'malformed',
      note: expect.stringContaining('уже в манифесте'),
    })
  })
})

describe('report-travel-404 / классификация', () => {
  const classify = (slug: string, extra: Record<string, unknown> = {}) =>
    classifySlug({ slug, nested: false, undecodable: false, ...extra }, ctx())

  it('сломанный редирект важнее всех прочих признаков', () => {
    expect(classify('liniya-stalina').bucket).toBe('regression')
  })

  it('делит шум, намеренные 404 и id-адреса', () => {
    expect(classify('mock').bucket).toBe('noise')
    expect(classify('definitely-not-a-real-slug-xyz123').bucket).toBe('noise')
    expect(classify('gdansk-i-sopot')).toMatchObject({ bucket: 'expected', note: expect.stringContaining('#1197') })
    expect(classify('637').bucket).toBe('id-url')
  })

  it('битые ссылки не уходят в кандидаты на редирект', () => {
    expect(classify('5-zagreb-...').bucket).toBe('malformed')
    expect(classify('vena', { nested: true }).bucket).toBe('malformed')
    expect(classify('vena', { undecodable: true }).bucket).toBe('malformed')
  })

  it('всё остальное — кандидат на ручную сверку', () => {
    expect(classify('gruziya-peshchera-sataplia').bucket).toBe('candidate')
  })
})

describe('report-travel-404 / отчёт', () => {
  const raw = [
    logLine('GET /travels/gruziya-peshchera-sataplia HTTP/2.0', 404, '2026-08-03T20:00:00+00:00'),
    logLine('GET /travels/gruziya-peshchera-sataplia HTTP/2.0', 404, '2026-08-04T06:00:00+00:00'),
    logLine('GET /travels/mock HTTP/1.1', 404),
    logLine('GET /travels/liniya-stalina HTTP/1.1', 404),
    logLine('GET /travels/vena HTTP/1.1', 301),
    logLine('GET /api/travels/637/ HTTP/1.1', 404),
    logLine('GET /gallery/1.jpg HTTP/1.1', 200, '2026-08-04T08:00:00+00:00'),
  ].join('\n')

  it('считает окно, повторы и раскладывает по корзинам', () => {
    const report = buildReport(digestRawLog(raw), ctx())
    expect(report.window).toMatchObject({ totalRequests: 7, from: '2026-08-03T20:00:00+00:00' })
    expect(report.total404).toBe(4)
    expect(report.buckets.candidate).toHaveLength(1)
    expect(report.buckets.candidate[0]).toMatchObject({ slug: 'gruziya-peshchera-sataplia', count: 2 })
    expect(report.buckets.regression).toHaveLength(1)
    expect(report.buckets.noise).toHaveLength(1)
    expect(report.needsHuman).toBe(true)
  })

  it('не тащит в отчёт успешные ответы и API-маршруты', () => {
    const slugs = buildReport(digestRawLog(raw), ctx()).rows.map((r: { slug: string }) => r.slug)
    expect(slugs).not.toContain('vena')
    expect(slugs).not.toContain('637')
  })

  it('помечает окно урезанным, когда контейнер пересоздавался', () => {
    const short = [
      logLine('GET /travels/mock HTTP/1.1', 404, '2026-08-04T00:00:00+00:00'),
      logLine('GET /travels/mock HTTP/1.1', 404, '2026-08-04T09:00:00+00:00'),
    ].join('\n')
    expect(buildReport(digestRawLog(short), ctx()).window.truncated).toBe(true)
    expect(buildReport(digestRawLog(raw), ctx({ since: '2h' })).window.truncated).toBe(false)
  })

  it('чистый лог не требует человека', () => {
    const clean = digestRawLog(logLine('GET /travels/vena HTTP/1.1', 200))
    const report = buildReport(clean, ctx())
    expect(report.needsHuman).toBe(false)
    expect(formatReport(report, ctx())).toContain('Новых мёртвых адресов и сломанных редиректов нет')
  })
})

describe('report-travel-404 / живая проверка', () => {
  const build = () => buildReport(digestRawLog(logLine('GET /travels/liniya-stalina HTTP/1.1', 404)), ctx())
  const buildCandidate = () =>
    buildReport(digestRawLog(logLine('GET /travels/vena-za-1-den-i-venskii-les HTTP/1.1', 404)), ctx())

  it('снимает тревогу, если сейчас прод уже отдаёт редирект', async () => {
    const report = await verifyLive(build(), { origin: 'https://metravel.by', probe: async () => 301 })
    expect(report.buckets.regression).toBeUndefined()
    expect(report.buckets.stale[0]).toMatchObject({ slug: 'liniya-stalina', liveStatus: 301 })
    expect(report.needsHuman).toBe(false)
  })

  it('оставляет тревогу, если адрес мёртв и сейчас', async () => {
    const report = await verifyLive(build(), { origin: 'https://metravel.by', probe: async () => 404 })
    expect(report.buckets.regression[0].note).toContain('прод по-прежнему 404')
    expect(report.needsHuman).toBe(true)
  })

  // Ловушка батча #1234: во время переименования новый адрес секунду отдаёт 404,
  // и обходчик успевает это записать — без живой пробы это ложная волна.
  it('не считает мёртвым адрес, который сейчас открывается', async () => {
    const report = await verifyLive(buildCandidate(), { origin: 'https://metravel.by', probe: async () => 200 })
    expect(report.buckets.candidate).toBeUndefined()
    expect(report.buckets.stale[0].note).toContain('адрес живой')
    expect(report.needsHuman).toBe(false)
  })

  it('оставляет кандидата, если он мёртв и сейчас', async () => {
    const report = await verifyLive(buildCandidate(), { origin: 'https://metravel.by', probe: async () => 404 })
    expect(report.buckets.candidate).toHaveLength(1)
    expect(report.needsHuman).toBe(true)
  })
})

// Четвёртая волна #1255: 61 «мёртвый» адрес оказался черновиками автора.
// Анонимно черновик неотличим от несуществующей статьи — оба дают 404.
describe('report-travel-404 / черновики', () => {
  const draftReport = () =>
    buildReport(
      digestRawLog(
        [
          logLine('GET /travels/boltsano-tirolskii-kharakter HTTP/1.1', 404),
          logLine('GET /travels/gruziya-peshchera-sataplia HTTP/1.1', 404),
        ].join('\n')
      ),
      ctx()
    )

  it('собирает слаги неопубликованных статей из ответа API', () => {
    const drafts = collectDraftSlugs({ items: [{ id: 612, slug: 'boltsano-tirolskii-kharakter' }, { id: 7 }] })
    expect(drafts.get('boltsano-tirolskii-kharakter')).toEqual({ id: 612 })
    expect(drafts.size).toBe(1)
    expect(collectDraftSlugs({}).size).toBe(0)
  })

  it('спрашивает API о неопубликованных с токеном', async () => {
    const calls: Array<{ url: string; token?: string }> = []
    await fetchDrafts({
      origin: 'https://metravel.by',
      token: 'secret',
      fetchJson: async (url: string, opts: { token?: string }) => {
        calls.push({ url, token: opts.token })
        return { items: [] }
      },
    })
    expect(calls[0].token).toBe('secret')
    expect(decodeURIComponent(calls[0].url)).toContain('where={"publish":0}')
  })

  // Недобранный черновик вернётся в кандидаты и снова позовёт человека сверять
  // уже разобранное, поэтому список дочитывается до конца.
  it('дочитывает список черновиков постранично', async () => {
    const pages = [
      { total: 3, items: [{ id: 1, slug: 'a' }, { id: 2, slug: 'b' }] },
      { total: 3, items: [{ id: 3, slug: 'c' }] },
    ]
    let calls = 0
    const drafts = await fetchDrafts({
      origin: 'https://metravel.by',
      perPage: 2,
      fetchJson: async () => pages[calls++],
    })
    expect(calls).toBe(2)
    expect([...drafts.keys()]).toEqual(['a', 'b', 'c'])
  })

  it('уводит кандидата-черновик из находок и снимает тревогу', () => {
    const report = annotateDrafts(draftReport(), new Map([['boltsano-tirolskii-kharakter', { id: 612 }]]))
    expect(report.buckets.draft).toHaveLength(1)
    expect(report.buckets.draft[0].note).toContain('travel id 612')
    expect(report.buckets.candidate.map((r: { slug: string }) => r.slug)).toEqual(['gruziya-peshchera-sataplia'])
    expect(report.needsHuman).toBe(true)
  })

  it('чистит признак «нужен человек», когда черновиками оказались все кандидаты', () => {
    const report = annotateDrafts(
      draftReport(),
      new Map([
        ['boltsano-tirolskii-kharakter', { id: 612 }],
        ['gruziya-peshchera-sataplia', { id: 613 }],
      ])
    )
    expect(report.buckets.candidate).toBeUndefined()
    expect(report.needsHuman).toBe(false)
    expect(formatReport(report, ctx())).toContain('Слаг занят черновиком автора')
  })

  it('не трогает regression: сломанный редирект остаётся громким', () => {
    const report = buildReport(digestRawLog(logLine('GET /travels/liniya-stalina HTTP/1.1', 404)), ctx())
    annotateDrafts(report, new Map([['liniya-stalina', { id: 1 }]]))
    expect(report.buckets.regression).toHaveLength(1)
    expect(report.needsHuman).toBe(true)
  })

  it('без токена говорит вслух, а не прячет кандидатов молча', () => {
    const report = draftReport()
    report.draftCheck = { ok: false, reason: 'нет токена' }
    const text = formatReport(report, ctx())
    expect(text).toContain('Черновики не проверены')
    expect(report.buckets.candidate).toHaveLength(2)
  })

  it('берёт токен из env, затем из .secrets, и не находит его на пустой машине', () => {
    const readFile = (p: string) => {
      if (p.endsWith('mcp_token.json')) return '{"token":"from-secrets"}'
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
    }
    expect(readToken({ env: { METRAVEL_TOKEN: 'from-env' }, readFile })).toMatchObject({ token: 'from-env' })
    expect(readToken({ env: {}, readFile })).toMatchObject({ token: 'from-secrets' })
    expect(
      readToken({
        env: {},
        readFile: () => {
          throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
        },
      })
    ).toBeNull()
  })
})

describe('report-travel-404 / аргументы и окно', () => {
  it('разбирает флаги', () => {
    expect(parseArgs(['node', 's', '--json', '--since', '48h', '--no-verify', '--no-drafts'])).toMatchObject({
      json: true,
      since: '48h',
      verify: false,
      drafts: false,
    })
    expect(parseArgs(['node', 's']).drafts).toBe(true)
    expect(parseArgs(['node', 's', '--all']).since).toBe('')
  })

  it('переводит окно в часы и не выдумывает его для абсолютных дат', () => {
    expect(requestedHours('24h')).toBe(24)
    expect(requestedHours('90m')).toBe(1.5)
    expect(requestedHours('2d')).toBe(48)
    expect(requestedHours('2026-08-03T14:00:00')).toBe(0)
    expect(windowHours('2026-08-04T00:00:00+00:00', '2026-08-04T06:00:00+00:00')).toBe(6)
    expect(windowHours('', '')).toBe(0)
  })
})
