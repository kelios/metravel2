import { serverRoute } from '@/api/external/serverRouting'
import { valhallaRoute } from '@/api/external/valhalla'
import { buildQuestRouteGeometry } from '@/components/quests/questRouteGeometry'

jest.mock('@/api/external/serverRouting', () => ({
  serverRoute: jest.fn(),
}))

jest.mock('@/api/external/valhalla', () => ({
  valhallaRoute: jest.fn(),
}))

const mockedServerRoute = jest.mocked(serverRoute)
const mockedValhallaRoute = jest.mocked(valhallaRoute)

const makeResponse = (body: unknown, options: { ok?: boolean; status?: number } = {}) => ({
  ok: options.ok ?? true,
  status: options.status ?? 200,
  json: jest.fn().mockResolvedValue(body),
  text: jest.fn().mockResolvedValue(''),
}) as unknown as Response

const points = [
  { lat: 50.0614, lng: 19.9383 },
  { lat: 50.0751, lng: 19.9091 },
]

describe('quest route geometry transport profile', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('requests the canonical server route with the bike profile for a bike quest', async () => {
    mockedServerRoute.mockResolvedValue(makeResponse({
      geometry: [
        [19.9383, 50.0614],
        [19.9091, 50.0751],
      ],
      distance_m: 3200,
      duration_s: 780,
    }))

    const result = await buildQuestRouteGeometry(points, { routeMode: 'bike' })

    expect(mockedServerRoute).toHaveBeenCalledWith(points, 'bike', { signal: undefined })
    expect(result).toMatchObject({ source: 'routed', provider: 'server', distanceM: 3200, durationS: 780 })
    expect(mockedValhallaRoute).not.toHaveBeenCalled()
  })

  it('uses Valhalla bicycle costing when the server route is unavailable', async () => {
    mockedServerRoute.mockResolvedValue(makeResponse({}, { ok: false, status: 503 }))
    mockedValhallaRoute.mockResolvedValue(makeResponse({ trip: { legs: [] } }))

    const result = await buildQuestRouteGeometry(points, { routeMode: 'bike' })

    expect(mockedValhallaRoute).toHaveBeenCalledWith(
      expect.objectContaining({ costing: 'bicycle' }),
      { signal: undefined },
    )
    expect(result.source).toBe('direct')
  })

  it('keeps the walking profile as the default for ordinary quests', async () => {
    mockedServerRoute.mockResolvedValue(makeResponse({
      geometry: [
        [19.9383, 50.0614],
        [19.9091, 50.0751],
      ],
    }))

    await buildQuestRouteGeometry(points)

    expect(mockedServerRoute).toHaveBeenCalledWith(points, 'foot', { signal: undefined })
  })
})

const roadTrack: Array<[number, number]> = [
  [19.9383, 50.0614],
  [19.93, 50.068],
  [19.9091, 50.0751],
]
// polyline6-кодировка roadTrack — так Valhalla отдаёт геометрию шага.
const roadTrackShape = 'odon~Aw~|_e@o{KveOwzLfyg@'

// Так /api/routing/route/ отвечает на недоступный ORS: HTTP 200, но геометрия —
// прямая через точки квеста.
const directFallbackBody = {
  geometry: [
    [19.9383, 50.0614],
    [19.9091, 50.0751],
  ],
  distance_m: 1845,
  duration_s: 1328,
  provider: 'direct',
  is_optimal: false,
  fallback_reason: 'ors_http_404',
}

describe('quest route geometry on a degraded server response', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('hands the direct-line server fallback over to Valhalla', async () => {
    mockedServerRoute.mockResolvedValue(makeResponse(directFallbackBody))
    mockedValhallaRoute.mockResolvedValue(makeResponse({
      trip: { legs: [{ shape: roadTrackShape }], summary: { length: 3.5, time: 2520 } },
    }))

    const result = await buildQuestRouteGeometry(points)

    expect(mockedValhallaRoute).toHaveBeenCalledWith(
      expect.objectContaining({ costing: 'pedestrian' }),
      { signal: undefined },
    )
    expect(result).toMatchObject({ source: 'routed', provider: 'valhalla', distanceM: 3500, durationS: 2520 })
    expect(result.track).toEqual(roadTrack)
  })

  it('shows an approximate direct line when Valhalla cannot route either', async () => {
    mockedServerRoute.mockResolvedValue(makeResponse(directFallbackBody))
    mockedValhallaRoute.mockResolvedValue(makeResponse({}, { ok: false, status: 503 }))

    const result = await buildQuestRouteGeometry(points)

    expect(result.source).toBe('direct')
    expect(result.provider).toBeUndefined()
    expect(result.track).toEqual(points.map((point) => [point.lng, point.lat]))
  })

  it.each([
    ['provider direct without is_optimal', { provider: 'direct' }],
    ['is_optimal false from a road provider', { provider: 'ors', is_optimal: false }],
  ])('does not accept the server geometry as routed on %s', async (_signal, flags) => {
    mockedServerRoute.mockResolvedValue(makeResponse({ geometry: directFallbackBody.geometry, ...flags }))
    mockedValhallaRoute.mockResolvedValue(makeResponse({}, { ok: false, status: 503 }))

    const result = await buildQuestRouteGeometry(points)

    expect(mockedValhallaRoute).toHaveBeenCalledTimes(1)
    expect(result.source).toBe('direct')
  })

  it('keeps a healthy ORS response as the routed server track', async () => {
    mockedServerRoute.mockResolvedValue(makeResponse({
      geometry: roadTrack,
      distance_m: 3480,
      duration_s: 2505,
      provider: 'ors',
      is_optimal: true,
      fallback_reason: null,
    }))

    const result = await buildQuestRouteGeometry(points)

    expect(result).toMatchObject({ source: 'routed', provider: 'server', distanceM: 3480, durationS: 2505 })
    expect(result.track).toEqual(roadTrack)
    expect(mockedValhallaRoute).not.toHaveBeenCalled()
  })
})
