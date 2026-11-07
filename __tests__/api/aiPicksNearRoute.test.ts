/**
 * #2911: клиент `POST /ai/near-route` — тело запроса, прореживание точек, нормализация
 * `lat/lng` в карточке, пустой маршрут без запроса.
 */
import { AI_NEAR_ROUTE_MAX_POINTS, fetchNearRoute, thinRoutePoints } from '@/api/aiPicks'
import { fetchWithTimeout } from '@/utils/fetchWithTimeout'

jest.mock('@/utils/fetchWithTimeout', () => ({ fetchWithTimeout: jest.fn() }))

const mockedFetch = fetchWithTimeout as jest.MockedFunction<typeof fetchWithTimeout>
const jsonResponse = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body }) as unknown as Response

beforeEach(() => mockedFetch.mockReset())

describe('fetchNearRoute (#2911)', () => {
  it('POST с точками, лимитом и локалью; карточки с lat/lng, кривые записи отброшены', async () => {
    mockedFetch.mockResolvedValue(
      jsonResponse(200, {
        items: [
          { type: 'quest', source_id: 1, title: 'Квест по Гродно', url: 'https://metravel.by/quests/1', snippet: 'квест', score: null, city: 'Гродно', country: 'Беларусь', lat: 53.68, lng: 23.83, cover: null, distance_km: 0 },
          { type: 'travel', source_id: 11, title: 'Лида', url: 'https://metravel.by/travels/lida', snippet: '', score: null, city: 'Лида', country: null, lat: 'x', lng: null, cover: 'https://cdn/lida.jpg' },
          { type: 'travel', source_id: 0, title: 'мимо', url: 'https://metravel.by/travels/x' },
        ],
        took_ms: 2,
      }),
    )
    const signal = new AbortController().signal
    const items = await fetchNearRoute({ points: [{ lat: 53.9, lng: 27.56 }, { lat: 53.68, lng: 23.83 }], locale: 'be', limit: 8, signal })
    expect(mockedFetch).toHaveBeenCalledTimes(1)
    const [url, init] = mockedFetch.mock.calls[0]
    expect(String(url)).toMatch(/\/ai\/near-route$/)
    expect(init).toMatchObject({ method: 'POST', signal })
    expect(JSON.parse(String(init?.body))).toEqual({ points: [{ lat: 53.9, lng: 27.56 }, { lat: 53.68, lng: 23.83 }], limit: 8, locale: 'be' })
    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({ type: 'quest', source_id: 1, path: '/quests/1', lat: 53.68, lng: 23.83, cover: null })
    expect(items[1]).toMatchObject({ source_id: 11, lat: null, lng: null, cover: 'https://cdn/lida.jpg' })
  })

  it('пустой маршрут — пустой список без запроса; ошибка службы пробрасывается', async () => {
    expect(await fetchNearRoute({ points: [], locale: 'ru', limit: 8 })).toEqual([])
    expect(mockedFetch).not.toHaveBeenCalled()
    mockedFetch.mockResolvedValue(jsonResponse(503, { error: 'busy' }))
    await expect(fetchNearRoute({ points: [{ lat: 1, lng: 2 }], locale: 'ru', limit: 8 })).rejects.toMatchObject({ status: 503 })
  })

  it('больше 50 точек — равномерная выборка с сохранением концов', () => {
    const points = Array.from({ length: 120 }, (_, i) => ({ lat: i, lng: 0 }))
    const thinned = thinRoutePoints(points)
    expect(thinned).toHaveLength(AI_NEAR_ROUTE_MAX_POINTS)
    expect(thinned[0]).toBe(points[0])
    expect(thinned[thinned.length - 1]).toBe(points[119])
    const short = points.slice(0, 3)
    expect(thinRoutePoints(short)).toBe(short)
  })
})
