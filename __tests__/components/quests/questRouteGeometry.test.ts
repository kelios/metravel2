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

// Encode fixture coordinates at the provider's documented precision; production
// decoding stays the real shared polyline6 decoder used by both map engines.
const encodeShape6 = (track: Array<[number, number]>): string => {
  let previousLat = 0
  let previousLng = 0
  const encodeDelta = (delta: number) => {
    let value = delta < 0 ? ~(delta << 1) : delta << 1
    let encoded = ''
    while (value >= 0x20) {
      encoded += String.fromCharCode((0x20 | (value & 0x1f)) + 63)
      value >>>= 5
    }
    return encoded + String.fromCharCode(value + 63)
  }
  return track.map(([lng, lat]) => {
    const nextLat = Math.round(lat * 1e6)
    const nextLng = Math.round(lng * 1e6)
    const encoded = encodeDelta(nextLat - previousLat) + encodeDelta(nextLng - previousLng)
    previousLat = nextLat
    previousLng = nextLng
    return encoded
  }).join('')
}

const makeWaypoints = (count: number) => Array.from({ length: count }, (_, index) => ({
  lat: (52000003 + index * 997) / 1e6,
  lng: (24000001 + index * 1001) / 1e6,
}))

const makeValhallaBody = (locations: Array<{ lat: number; lon: number }>) => ({
  trip: {
    legs: locations.slice(1).map((point, index) => ({
      shape: encodeShape6([[locations[index].lon, locations[index].lat], [point.lon, point.lat]]),
    })),
    summary: { length: (locations.length - 1) * 0.123, time: (locations.length - 1) * 17 },
  },
})

describe('quest Valhalla routes across the public ten-location limit', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    mockedServerRoute.mockResolvedValue(makeResponse(directFallbackBody))
    mockedValhallaRoute.mockImplementation(async ({ locations }) => makeResponse(makeValhallaBody(locations)))
  })

  it.each([
    [2, [2]],
    [9, [9]],
    [10, [10]],
    [11, [10, 2]],
    [12, [10, 3]],
    [19, [10, 10]],
    [20, [10, 10, 2]],
    [28, [10, 10, 10]],
  ])('routes all %i locations without losing or duplicating a segment', async (count, sizes) => {
    const waypoints = makeWaypoints(count as number)
    const result = await buildQuestRouteGeometry(waypoints)
    const requests = mockedValhallaRoute.mock.calls.map(([body]) => body.locations)

    expect(requests.map((chunk) => chunk.length)).toEqual(sizes)
    const restored = requests.flatMap((chunk, index) => index ? chunk.slice(1) : chunk)
    expect(restored).toEqual(waypoints.map(({ lat, lng }) => ({ lat, lon: lng })))
    requests.slice(1).forEach((chunk, index) => {
      expect(chunk[0]).toEqual(requests[index][requests[index].length - 1])
    })
    expect(result.source).toBe('routed')
    expect(result.provider).toBe('valhalla')
    expect(result.track).toEqual(waypoints.map(({ lat, lng }) => [lng, lat]))
    expect(result.distanceM).toBeCloseTo((waypoints.length - 1) * 123)
    expect(result.durationS).toBe((waypoints.length - 1) * 17)
  })

  it('preserves repeated start locations, loop closure and six-decimal coordinates', async () => {
    const waypoints = makeWaypoints(11)
    waypoints.splice(1, 0, { ...waypoints[0] })
    waypoints.push({ ...waypoints[0] })
    const original = JSON.parse(JSON.stringify(waypoints))
    const result = await buildQuestRouteGeometry(waypoints)
    const requests = mockedValhallaRoute.mock.calls.map(([body]) => body.locations)

    expect(requests.map((chunk) => chunk.length)).toEqual([10, 4])
    expect(requests[0][0]).toEqual(requests[0][1])
    expect(requests[1][3]).toEqual(requests[0][0])
    expect(result.track).toEqual(waypoints.map(({ lat, lng }) => [lng, lat]))
    expect(waypoints).toEqual(original)
  })

  it.each(['foot', 'bike'] as const)('keeps the %s profile, units and cancellation signal in every request', async (routeMode) => {
    const controller = new AbortController()
    await buildQuestRouteGeometry(makeWaypoints(20), { routeMode, signal: controller.signal })
    expect(mockedValhallaRoute).toHaveBeenCalledTimes(3)
    mockedValhallaRoute.mock.calls.forEach(([body, init]) => {
      expect(body.costing).toBe(routeMode === 'bike' ? 'bicycle' : 'pedestrian')
      expect(body.directions_options).toEqual({ units: 'kilometers' })
      expect(init?.signal).toBe(controller.signal)
    })
  })

  it.each([400, 429, 503])('does not report a partially routed result if the second request returns %i', async (status) => {
    const waypoints = makeWaypoints(20)
    mockedValhallaRoute.mockImplementationOnce(async ({ locations }) => makeResponse(makeValhallaBody(locations)))
      .mockResolvedValueOnce(makeResponse({}, { ok: false, status }))

    const result = await buildQuestRouteGeometry(waypoints)

    expect(mockedValhallaRoute).toHaveBeenCalledTimes(2)
    expect(result).toMatchObject({ source: 'direct', track: waypoints.map(({ lat, lng }) => [lng, lat]) })
    expect(result.provider).toBeUndefined()
    expect(result.error).toEqual(expect.any(String))
  })

  it('rejects a network failure without exposing a partial routed track', async () => {
    mockedValhallaRoute.mockImplementationOnce(async ({ locations }) => makeResponse(makeValhallaBody(locations)))
      .mockRejectedValueOnce(new Error('network unavailable'))
    const result = await buildQuestRouteGeometry(makeWaypoints(20))
    expect(result.source).toBe('direct')
    expect(result.error).toBe('network unavailable')
    expect(mockedValhallaRoute).toHaveBeenCalledTimes(2)
  })

  it.each(['missing-leg', 'empty-leg', 'invalid-coordinate'] as const)('rejects an incomplete successful response: %s', async (fault) => {
    mockedValhallaRoute.mockImplementationOnce(async ({ locations }) => {
      const body = makeValhallaBody(locations)
      if (fault === 'missing-leg') body.trip.legs.splice(4, 1)
      if (fault === 'empty-leg') body.trip.legs[4].shape = ''
      if (fault === 'invalid-coordinate') body.trip.legs[4].shape = encodeShape6([[24, 91], [24.1, 91.1]])
      return makeResponse(body)
    })
    const result = await buildQuestRouteGeometry(makeWaypoints(12))
    expect(result.source).toBe('direct')
    expect(result.error).toEqual(expect.any(String))
    expect(mockedValhallaRoute).toHaveBeenCalledTimes(1)
  })

  it('estimates absent or nonfinite metrics per chunk instead of propagating NaN/Infinity', async () => {
    mockedValhallaRoute.mockImplementation(async ({ locations }) => {
      const body = makeValhallaBody(locations)
      body.trip.summary = { length: Infinity, time: -1 }
      return makeResponse(body)
    })
    const result = await buildQuestRouteGeometry(makeWaypoints(12))
    expect(result.source).toBe('routed')
    expect(result.distanceM).toBeGreaterThan(0)
    expect(Number.isFinite(result.distanceM)).toBe(true)
    expect(result.durationS).toBeGreaterThan(0)
    expect(Number.isFinite(result.durationS)).toBe(true)
  })

  it('honours a deadline that expires after the first response and never starts the second request', async () => {
    const controller = new AbortController()
    mockedValhallaRoute.mockImplementationOnce(async ({ locations }) => {
      const response = makeResponse(makeValhallaBody(locations))
      response.json = jest.fn(async () => {
        controller.abort()
        return makeValhallaBody(locations)
      })
      return response
    })
    await expect(buildQuestRouteGeometry(makeWaypoints(20), { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' })
    expect(mockedValhallaRoute).toHaveBeenCalledTimes(1)
  })

  it('propagates an AbortError from a later request rather than returning a direct fallback', async () => {
    const error = Object.assign(new Error('cancelled'), { name: 'AbortError' })
    mockedValhallaRoute.mockImplementationOnce(async ({ locations }) => makeResponse(makeValhallaBody(locations)))
      .mockRejectedValueOnce(error)
    await expect(buildQuestRouteGeometry(makeWaypoints(20))).rejects.toBe(error)
    expect(mockedValhallaRoute).toHaveBeenCalledTimes(2)
  })

  it.each([
    { waypoints: [] },
    { waypoints: [points[0]] },
    { waypoints: [{ lat: NaN, lng: 24 }, points[0]] },
  ])('keeps zero/one valid location as a non-routed degenerate route: $waypoints', async ({ waypoints }) => {
    const result = await buildQuestRouteGeometry(waypoints)
    expect(result.source).toBe('direct')
    expect(mockedServerRoute).not.toHaveBeenCalled()
    expect(mockedValhallaRoute).not.toHaveBeenCalled()
  })
})
