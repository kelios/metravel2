import { fetchValhallaRouteGeometry } from '@/api/external/valhallaRouting'

const track: Array<[number, number]> = [[19.9383, 50.0614], [19.93, 50.068], [19.9091, 50.0751]]
const shape = 'odon~Aw~|_e@o{KveOwzLfyg@'
const originalFetch = global.fetch

beforeEach(() => {
  global.fetch = jest.fn()
})
afterEach(() => {
  global.fetch = originalFetch
})

it('preserves the real GET adapter, car costing, kilometer units, caller headers and signal', async () => {
  const controller = new AbortController()
  const headers = { Accept: 'application/json' }
  jest.mocked(global.fetch).mockResolvedValue({
    ok: true,
    json: async () => ({ trip: { legs: [{ shape }], summary: { length: 3.5, time: 2520 } } }),
  } as Response)

  const result = await fetchValhallaRouteGeometry([track[0], track[2]], 'car', { signal: controller.signal, headers })

  expect(result).toEqual({ ok: true, coords: track, distanceM: 3500, durationS: 2520 })
  expect(global.fetch).toHaveBeenCalledTimes(1)
  const [url, init] = jest.mocked(global.fetch).mock.calls[0]
  const request = JSON.parse(new URL(String(url)).searchParams.get('json')!)
  expect(request).toEqual({
    locations: [{ lat: 50.0614, lon: 19.9383 }, { lat: 50.0751, lon: 19.9091 }],
    costing: 'auto',
    directions_options: { units: 'kilometers' },
  })
  expect(init).toEqual({ signal: controller.signal, headers })
})

it('does not start requests for an already aborted caller', async () => {
  const controller = new AbortController()
  controller.abort()
  await expect(fetchValhallaRouteGeometry(track, 'foot', { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' })
  expect(global.fetch).not.toHaveBeenCalled()
})

it.each([
  { points: [] },
  { points: [track[0]] },
  { points: [[19, 91], track[1]] as Array<[number, number]> },
])('rejects invalid/degenerate input before contacting the provider: $points', async ({ points }) => {
  await expect(fetchValhallaRouteGeometry(points, 'foot')).rejects.toBeInstanceOf(Error)
  expect(global.fetch).not.toHaveBeenCalled()
})

it('returns the actual non-OK response unread for the caller localized status policy', async () => {
  const response = { ok: false, status: 429, text: jest.fn(), json: jest.fn() } as unknown as Response
  jest.mocked(global.fetch).mockResolvedValue(response)
  expect(await fetchValhallaRouteGeometry(track, 'bike')).toEqual({ ok: false, response })
  expect(response.text).not.toHaveBeenCalled()
  expect(response.json).not.toHaveBeenCalled()
})

it('propagates malformed JSON without returning partial successful geometry', async () => {
  jest.mocked(global.fetch).mockResolvedValue({ ok: true, json: async () => { throw new Error('Malformed JSON') } } as Response)
  await expect(fetchValhallaRouteGeometry(track, 'foot')).rejects.toThrow('Malformed JSON')
})

it.each(['_', '?', '\u0000', '______?'])('rejects a leg with a valid prefix followed by malformed encoding %j', async (tail) => {
  jest.mocked(global.fetch).mockResolvedValue({
    ok: true,
    json: async () => ({ trip: { legs: [{ shape: shape + tail }], summary: { length: 3.5, time: 2520 } } }),
  } as Response)

  expect(await fetchValhallaRouteGeometry([track[0], track[2]], 'foot')).toEqual({ ok: false })
})

// Captured published Baku route: intro and first step share the same coordinate.
// Keep this real12location input (including its zero-distance first segment).
const bakuPoints: Array<[number, number]> = [
  [
    49.836294,
    40.368764
  ],
  [
    49.836294,
    40.368764
  ],
  [
    49.834464,
    40.3687047
  ],
  [
    49.833221,
    40.366393
  ],
  [
    49.832614,
    40.366373
  ],
  [
    49.832377,
    40.365865
  ],
  [
    49.833269,
    40.36409
  ],
  [
    49.83467,
    40.365389
  ],
  [
    49.835646,
    40.365397
  ],
  [
    49.836351,
    40.366444
  ],
  [
    49.83717,
    40.36682
  ],
  [
    49.837273,
    40.366148
  ]
]
const encodeFixtureShape6 = (points: Array<[number, number]>): string => {
  let lat = 0, lng = 0
  const delta = (value: number) => {
    let rest = value < 0 ? ~(value << 1) : value << 1
    let out = ''
    while (rest >= 32) { out += String.fromCharCode((32 | (rest & 31)) + 63); rest >>>= 5 }
    return out + String.fromCharCode(rest + 63)
  }
  return points.map(([nextLng, nextLat]) => {
    const y = Math.round(nextLat * 1e6), x = Math.round(nextLng * 1e6)
    const encoded = delta(y - lat) + delta(x - lng)
    lat = y; lng = x
    return encoded
  }).join('')
}

it('routes all12 real Baku input locations when the duplicate first leg has one complete vertex', async () => {
  const requests: Array<Array<{ lat: number; lon: number }>> = []
  jest.mocked(global.fetch).mockImplementation(async url => {
    const { locations } = JSON.parse(new URL(String(url)).searchParams.get('json')!) as { locations: Array<{ lat: number; lon: number }> }
    requests.push(locations)
    let movingLegs = 0
    const legs = locations.slice(1).map((point, index) => {
      const previous = locations[index]
      const same = previous.lon === point.lon && previous.lat === point.lat
      if (!same) movingLegs += 1
      return { shape: encodeFixtureShape6(same ? [[point.lon, point.lat]] : [[previous.lon, previous.lat], [point.lon, point.lat]]) }
    })
    return { ok: true, json: async () => ({ trip: { legs, summary: { length: movingLegs * 0.123, time: movingLegs * 17 } } }) } as Response
  })
  const result = await fetchValhallaRouteGeometry(bakuPoints, 'foot')
  expect(result.ok).toBe(true)
  expect(requests.map(chunk => chunk.length)).toEqual([10, 3])
  expect(requests.flatMap((chunk, index) => index ? chunk.slice(1) : chunk)).toEqual(bakuPoints.map(([lon, lat]) => ({ lon, lat })))
  if (!result.ok) throw new Error('Expected complete routed Baku geometry')
  expect(result.coords).toEqual(bakuPoints.slice(1).map(([lon, lat]) => [Math.round(lon * 1e6) / 1e6, Math.round(lat * 1e6) / 1e6]))
  expect(result.distanceM).toBeCloseTo(1230)
  expect(result.durationS).toBe(170)
})

it('accepts a one-vertex leg between distinct inputs only with explicit numeric zero distance and time', async () => {
  jest.mocked(global.fetch).mockResolvedValue({ ok: true, json: async () => ({ trip: {
    legs: [{ shape: encodeFixtureShape6([track[0]]), summary: { length: 0, time: 0 } }, { shape: encodeFixtureShape6([track[0], track[2]]) }],
    summary: { length: 3.5, time: 2520 },
  } }) } as Response)
  expect(await fetchValhallaRouteGeometry(track, 'foot')).toEqual({ ok: true, coords: [track[0], track[2]], distanceM: 3500, durationS: 2520 })
})

it.each([
  undefined, { length: 1, time: 0 }, { length: 0, time: 1 }, { length: null, time: 0 },
  { length: 0, time: null }, { length: '0', time: 0 }, { length: 0, time: '0' },
  { length: 0 }, { time: 0 }, { length: NaN, time: 0 }, { length: 0, time: Infinity },
])('rejects a single-vertex nonzero or unproven leg with summary %j', async summary => {
  jest.mocked(global.fetch).mockResolvedValue({ ok: true, json: async () => ({ trip: {
    legs: [{ shape: encodeFixtureShape6([track[0]]), summary }], summary: { length: 3.5, time: 2520 },
  } }) } as Response)
  expect(await fetchValhallaRouteGeometry([track[0], track[2]], 'foot')).toEqual({ ok: false })
})

it('does not return a healthy route when every leg collapses to only one overall coordinate', async () => {
  jest.mocked(global.fetch).mockResolvedValue({ ok: true, json: async () => ({ trip: {
    legs: [{ shape: encodeFixtureShape6([track[0]]) }], summary: { length: 0, time: 0 },
  } }) } as Response)
  expect(await fetchValhallaRouteGeometry([track[0], track[0]], 'foot')).toEqual({ ok: false })
})
