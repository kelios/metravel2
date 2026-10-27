import type { ImmutableRequest } from 'expo-server'
import { loadTravelRoute, projectTravelLoaderPayload, resolveTravelLoaderSegment } from '@/components/travel/details/travelRouteLoader'
import { setResponseHeaders } from 'expo-server'

jest.mock('expo-server', () => ({ setResponseHeaders: jest.fn() }))

const request = (signal = new AbortController().signal) => ({ signal } as ImmutableRequest)
const article = {
  id: 42, slug: 'demo', name: 'Путешествие', publish: 1, moderation: 1,
  description: '<p>Legacy body</p>', gallery: [],
  rich_text: { description: { safe_html: '<p>Canonical body</p>', plain_text: 'Canonical body' } },
}
const graph = { schema_version: 2, state: 'available', locale: 'ru', view: 'travel', travel_id: 42,
  publication_id: 'a'.repeat(64), corpus_revision: 'b'.repeat(64), source_revision: 'c'.repeat(64), content_revision: 'd'.repeat(64),
  quests: [], related: [{ path: '/travels/another', name: 'Another article' }] }

describe('travel route loader', () => {
  const oldEnv = { api: process.env.EXPO_PUBLIC_API_URL, ssr: process.env.EXPO_PUBLIC_WEB_RUNTIME_SSR, internalApi: process.env.SSR_API_ORIGIN }
  const oldFetch = global.fetch
  const fetchMock = jest.fn()

  beforeEach(() => {
    jest.useFakeTimers()
    process.env.EXPO_PUBLIC_API_URL = 'http://localhost:8000'
    process.env.EXPO_PUBLIC_WEB_RUNTIME_SSR = 'true'
    delete process.env.SSR_API_ORIGIN
    global.fetch = fetchMock
    jest.mocked(setResponseHeaders).mockClear()
    fetchMock.mockReset().mockImplementation(async (url: string) => ({ ok: true, status: 200,
      json: async () => url.includes('/quests/web/discovery/') ? graph : article }))
  })

  afterEach(() => {
    global.fetch = oldFetch
    if (oldEnv.api === undefined) delete process.env.EXPO_PUBLIC_API_URL
    else process.env.EXPO_PUBLIC_API_URL = oldEnv.api
    if (oldEnv.ssr === undefined) delete process.env.EXPO_PUBLIC_WEB_RUNTIME_SSR
    else process.env.EXPO_PUBLIC_WEB_RUNTIME_SSR = oldEnv.ssr
    if (oldEnv.internalApi === undefined) delete process.env.SSR_API_ORIGIN
    else process.env.SSR_API_ORIGIN = oldEnv.internalApi
    jest.useRealTimers()
  })

  it('keeps static shell generation and the rollout-off path network free', async () => {
    await expect(loadTravelRoute(undefined, { param: '[param]' })).resolves.toBeNull()
    process.env.EXPO_PUBLIC_WEB_RUNTIME_SSR = 'false'
    await expect(loadTravelRoute(request(), { param: 'demo' })).resolves.toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fetches one detail and one bounded discovery read for both wrappers, anonymously, and releases timeouts', async () => {
    const signal = new AbortController().signal
    const [first, second] = await Promise.all([
      loadTravelRoute(request(signal), { param: 'demo' }),
      loadTravelRoute(request(signal), { param: 'demo' }),
    ])
    expect(first).toBe(second)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:8000/api/travels/by-slug/demo/', expect.objectContaining({
      credentials: 'omit', headers: { Accept: 'application/json' },
    }))
    expect(fetchMock.mock.calls[1][0]).toBe('http://localhost:8000/api/quests/web/discovery/?lang=ru&view=travel&travel_id=42')
    expect(first?.linkGraph).toEqual(graph)
    expect(setResponseHeaders).toHaveBeenCalledWith({ 'X-Metravel-Travel-Graph-State': 'available' })
    expect(jest.getTimerCount()).toBe(0)
  })

  it('leaves numeric author previews to the credential-aware client query', async () => {
    await expect(loadTravelRoute(request(), { param: '42' })).resolves.toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('preserves an explicit /api base for canonical public slugs', async () => {
    process.env.EXPO_PUBLIC_API_URL = 'http://localhost:8000/api/'
    await loadTravelRoute(request(), { param: 'demo' })
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:8000/api/travels/by-slug/demo/')
  })

  it('uses internal transport with build-owned public Host and protocol for Django', async () => {
    process.env.EXPO_PUBLIC_API_URL = 'https://metravel.by'
    process.env.SSR_API_ORIGIN = 'http://app:8000'
    await loadTravelRoute(request(), { param: 'demo' })
    expect(fetchMock).toHaveBeenCalledWith('http://app:8000/api/travels/by-slug/demo/', expect.objectContaining({
      credentials: 'omit',
      headers: { Accept: 'application/json', Host: 'metravel.by', 'X-Forwarded-Proto': 'https' },
    }))
  })

  it('does not contact the internal API without a valid public host contract', async () => {
    process.env.EXPO_PUBLIC_API_URL = ''
    process.env.SSR_API_ORIGIN = 'http://app:8000'
    await expect(loadTravelRoute(request(), { param: 'demo' })).rejects.toMatchObject({ httpStatus: 503 })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each(['null', 'undefined', '0', '..%2Fsecret', 'bad%ZZ', '[param]', '9007199254740992'])(
    'rejects invalid route segment %s without an API request', async (param) => {
      expect(resolveTravelLoaderSegment(param)).toBeNull()
      await expect(loadTravelRoute(request(), { param })).rejects.toMatchObject({ httpStatus: 404 })
      expect(fetchMock).not.toHaveBeenCalled()
    },
  )

  it('does not turn a missing/private article or an upstream failure into a cached success', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404 })
    await expect(loadTravelRoute(request(), { param: 'missing' })).rejects.toMatchObject({ httpStatus: 404 })
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ...article, publish: 0 }) })
    await expect(loadTravelRoute(request(), { param: 'private' })).rejects.toMatchObject({ httpStatus: 404 })
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ...article, publication_status: 'draft' }) })
    await expect(loadTravelRoute(request(), { param: 'unpublished' })).rejects.toMatchObject({ httpStatus: 404 })
    fetchMock.mockResolvedValueOnce({ ok: false, status: 502 })
    await expect(loadTravelRoute(request(), { param: 'down' })).rejects.toMatchObject({ httpStatus: 503 })
    expect(jest.getTimerCount()).toBe(0)
  })

  it('projects one canonical body, only cover media, and no unrelated API fields', () => {
    const cover = { id: 1, src: '/gallery/1?w=720' }
    const raw = { ...article, private_notes: 'do not serialize', media: { cover, gallery: [{ id: 2, src: 'x'.repeat(50000) }] } }
    const result = projectTravelLoaderPayload(raw, 'demo')
    expect(result.travel.description).toBe('<p>Canonical body</p>')
    expect(result.travel.rich_text?.description).toBeUndefined()
    expect(result.travel.media).toEqual({ cover })
    expect(result.travel).not.toHaveProperty('private_notes')
    expect(result.mediaPartial).toBe(true)
    expect(result.serverDescriptionSanitized).toBe(true)
    expect(JSON.stringify(result).length).toBeLessThan(JSON.stringify(raw).length / 10)
    expect(raw.media.gallery).toHaveLength(1)
  })

  it('preserves source metadata when the canonical sanitized body differs from legacy editorial HTML', () => {
    const raw = { ...article, name: 'Минск', countryName: 'Беларусь',
      description: '<p>Прогулка по набережной.</p>',
      rich_text: { description: { safe_html: '<p>Canonical body differs</p>', plain_text: 'Canonical body differs' } },
    }
    const { buildTravelSeoDescription } = require('@/utils/travelSeoDescription')
    const result = projectTravelLoaderPayload(raw, 'demo')
    expect(result.travel.description).toBe('<p>Canonical body differs</p>')
    expect(result.travel.meta_description).toBe(buildTravelSeoDescription(raw, raw.description, undefined))
  })

  it('builds FAQPage from the source description because safe_html drops the FAQ markers', () => {
    const faqHtml = '<section data-faq="metravel-seo"><details><summary>Где парковка?</summary><p>У входа.</p></details></section>'
    const raw = { ...article, description: `<p>Текст.</p>${faqHtml}`,
      rich_text: { description: { safe_html: '<p>Текст.</p><section><details><summary>Где парковка?</summary><p>У входа.</p></details></section>', plain_text: '' } },
    }
    const { buildTravelFaqJsonLd } = require('@/utils/travelFaq')
    expect(buildTravelFaqJsonLd(raw.rich_text.description.safe_html)).toBeNull()
    expect(projectTravelLoaderPayload(raw, 'demo').faqJsonLd).toEqual(buildTravelFaqJsonLd(raw.description))
    expect(projectTravelLoaderPayload(raw, 'demo').faqJsonLd).toMatchObject({ '@type': 'FAQPage', mainEntity: [{ name: 'Где парковка?' }] })
    expect(projectTravelLoaderPayload(article, 'demo').faqJsonLd).toBeNull()
  })

  it('retains the HD cover needed by metadata when there is no gallery image', () => {
    const hd = 'https://metravel.by/travel-image/42/conversions/cover-detail_hd.jpg'
    const result = projectTravelLoaderPayload({ ...article, travel_image_detail_hd_url: hd }, 'demo')
    expect(result.travel).toHaveProperty('travel_image_detail_hd_url', hd)
  })

  it.each([
    ['refresh_pending', 3, 'pending'], ['selection_pending', 3, 'pending'], ['publication_unavailable', null, 'pending'],
    ['refresh_pending', null, 'error'],
    ['refresh_pending', 31, 'error'], ['refresh_failed', 4, 'error'], ['publication_corrupt', 1, 'error'],
  ])('keeps article body on graph %s, with honest %s-second state %s and no-store', async (errorCode, age, state) => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => article })
      .mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({ schema_version: 2,
        state: 'temporary_failure', locale: 'ru', view: 'travel', travel_id: 42, error_code: errorCode,
        source_checked_at: 123, source_age_seconds: age, quests: [], related: [] }) })
    const payload = await loadTravelRoute(request(), { param: 'demo' })
    expect(payload?.travel.description).toBe('<p>Canonical body</p>')
    expect(payload?.linkGraph).toMatchObject({ state, sourceAgeSeconds: age })
    expect(payload?.linkGraph).not.toHaveProperty('quests')
    expect(setResponseHeaders).toHaveBeenCalledWith({ 'Cache-Control': 'no-store', 'Retry-After': '5', 'X-Metravel-Travel-Graph-State': state })
    expect(jest.getTimerCount()).toBe(0)
  })

  it('marks malformed selected data as error without copying untrusted fields or hiding the article', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => article })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ...graph, travel_id: 7, private_notes: 'secret' }) })
    const payload = await loadTravelRoute(request(), { param: 'demo' })
    expect(payload?.travel.name).toBe(article.name)
    expect(payload?.linkGraph).toMatchObject({ state: 'error', errorCode: 'invalid_graph_response' })
    expect(JSON.stringify(payload)).not.toContain('secret')
  })

  it('keeps a typed concurrent withdrawal distinct from malformed API/schema data', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => article })
      .mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({ schema_version: 2, state: 'unavailable',
        locale: 'ru', view: 'travel', travel_id: 42, error_code: 'unavailable', quests: [], related: [] }) })
    expect((await loadTravelRoute(request(), { param: 'demo' }))?.linkGraph)
      .toMatchObject({ state: 'error', errorCode: 'unavailable' })
  })

  it('does not classify a malformed private failure envelope as a harmless refresh', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => article })
      .mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({ schema_version: 2, state: 'temporary_failure',
        locale: 'ru', view: 'travel', travel_id: 42, error_code: 'refresh_pending', quests: [], related: [],
        source_checked_at: 123, source_age_seconds: 1, answer_pattern: 'PRIVATE' }) })
    const payload = await loadTravelRoute(request(), { param: 'demo' })
    expect(payload?.linkGraph).toMatchObject({ state: 'error', errorCode: 'invalid_graph_response' })
    expect(JSON.stringify(payload)).not.toContain('PRIVATE')
  })
})
