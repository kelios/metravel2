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
