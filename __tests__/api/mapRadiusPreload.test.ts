/** @jest-environment-options {"url":"https://example.test/map"} */

import { Platform } from 'react-native'
import { fetchTravelsForMap } from '@/api/map/radiusQueries'
import { DEFAULT_MAP_CENTER, DEFAULT_RADIUS_KM, MAP_TRAVELS_PER_PAGE } from '@/constants/mapDefaults'
import { buildMapHeadBootstrapScript } from '@/utils/mapHeadBootstrap'
import { MAP_RADIUS_PRELOAD_GLOBAL, MAP_RADIUS_PRELOAD_TTL_MS } from '@/utils/mapRadiusPreload'
import { MAP_FILTERS_STORAGE_KEY, MAP_LOCATION_STORAGE_KEY, MAP_ROUTE_STORAGE_KEY } from '@/utils/mapStartupStorage'
import { consumeMapStartupLocation, MAP_PRECISE_WEB_LOCATION_OPTIONS } from '@/utils/mapStartupLocation'

const filter = {
  lat: String(DEFAULT_MAP_CENTER.latitude),
  lng: String(DEFAULT_MAP_CENTER.longitude),
  radius: String(DEFAULT_RADIUS_KM),
}

const response = (status = 200, body = '{"data":[{"id":1,"coord":"53.9,27.56"}],"total":1}') => ({
  ok: status === 200,
  status,
  bodyUsed: false,
  text: async () => body,
})

function startBootstrap(
  apiUrl = window.location.origin,
  options: Parameters<typeof buildMapHeadBootstrapScript>[1] = { nodeEnv: 'production' },
) {
  new Function(buildMapHeadBootstrapScript(apiUrl, options))()
}

describe('early map radius request', () => {
  const nativePlatform = Platform.OS
  const originalFetch = global.fetch
  const fetchMock = jest.fn()

  beforeEach(() => {
    jest.useFakeTimers()
    ;(Platform as { OS: string }).OS = 'web'
    global.fetch = fetchMock
    fetchMock.mockReset()
    fetchMock.mockResolvedValue(response())
    window.history.replaceState(null, '', '/map')
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
    ;(Platform as { OS: string }).OS = nativePlatform
    global.fetch = originalFetch
    document.head.innerHTML = ''
    window.localStorage.clear()
  })

  it('hands the actual initial GET off once with the same URL, session and normalized result', async () => {
    const baseline = await fetchTravelsForMap(0, MAP_TRAVELS_PER_PAGE, filter, { throwOnError: true })
    const ordinaryUrl = fetchMock.mock.calls[0][0]
    expect(fetchMock.mock.calls[0][1].credentials).toBe('include')
    fetchMock.mockClear()

    startBootstrap()
    startBootstrap()
    const warmed = await fetchTravelsForMap(0, MAP_TRAVELS_PER_PAGE, filter, { throwOnError: true })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(ordinaryUrl, expect.objectContaining({
      method: 'GET',
      credentials: 'include',
    }))
    expect(warmed).toEqual(baseline)
    expect(warmed[0]).toMatchObject({ coord: '53.9,27.56' })
    expect(warmed).toHaveProperty('__total', 1)
    expect((window as unknown as Record<string, unknown>)[MAP_RADIUS_PRELOAD_GLOBAL]).toBeUndefined()

    await fetchTravelsForMap(0, MAP_TRAVELS_PER_PAGE, filter)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it.each([
    ['compact, denied', true, 'denied', '', true, null, false],
    ['compact, denied before shell', true, 'denied', '', true, null, true],
    ['compact, prompt denied', true, 'prompt', '', true, 'denied', false],
    ['compact, prompt granted', true, 'prompt', '', false, 'granted', false],
    ['compact, prompt timed out', true, 'prompt', '', false, 'timeout', false],
    ['compact, granted', true, 'granted', '', false, null, false],
    ['desktop', false, 'denied', '', false, null, false],
    ['coordinate link', true, 'denied', '?lat=54&lng=25', false, null, false],
  ] as const)('paints only a confirmed compact tile (%s)', async (_, matches, state, search, expected, promptOutcome, shellPending) => {
    const matchMedia = window.matchMedia
    const permissions = Object.getOwnPropertyDescriptor(navigator, 'permissions')
    const geolocation = Object.getOwnPropertyDescriptor(navigator, 'geolocation')
    const getCurrentPosition = jest.fn<void, Parameters<Geolocation['getCurrentPosition']>>()
    Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value: () => ({ matches }) })
    Object.defineProperty(navigator, 'permissions', { configurable: true, value: { query: async () => ({ state }) } })
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition } })
    const shell = '<div id="ssg-skeleton"><img data-ssg-map-tile></div>'
    document.body.innerHTML = shellPending ? '' : shell
    if (shellPending) Object.defineProperty(document, 'readyState', { configurable: true, value: 'loading' })
    window.history.replaceState(null, '', '/map' + search)
    let settleRadiusResponse!: (value: ReturnType<typeof response>) => void
    fetchMock.mockReturnValue(new Promise((resolve) => { settleRadiusResponse = resolve }))
    try {
      startBootstrap()
      await jest.advanceTimersByTimeAsync(0)
      if (shellPending) {
        const preload = document.querySelector('link[rel="preload"][as="image"]')
        expect(preload?.getAttribute('href')).toBe('/proxy/tiles/osm/11/1180/658.png')
        expect(preload?.getAttribute('crossorigin')).toBe('anonymous')
        document.body.innerHTML = shell
        await jest.advanceTimersByTimeAsync(0)
      }
      const tile = document.querySelector('img[data-ssg-map-tile]')
      if (promptOutcome) {
        expect(tile?.getAttribute('src')).toBeNull()
        expect(getCurrentPosition).toHaveBeenCalledTimes(1)
        const [success, failure, options] = getCurrentPosition.mock.calls[0]
        expect(options).toEqual(MAP_PRECISE_WEB_LOCATION_OPTIONS)
        const pending = consumeMapStartupLocation()
        expect(pending).toBeDefined()
        expect(consumeMapStartupLocation()).toBeUndefined()
        if (promptOutcome === 'granted') {
          const position = { coords: { latitude: 52.2, longitude: 20.98 }, timestamp: Date.now() } as GeolocationPosition
          success(position)
          await expect(pending).resolves.toEqual({ position })
        } else {
          const error = { code: promptOutcome === 'denied' ? 1 : 3 } as GeolocationPositionError
          failure?.(error)
          await expect(pending).resolves.toEqual({ error })
        }
        await jest.advanceTimersByTimeAsync(0)
      } else {
        expect(getCurrentPosition).not.toHaveBeenCalled()
      }
      expect(tile?.getAttribute('src')).toBe(expected ? '/proxy/tiles/osm/11/1180/658.png' : null)
      expect(tile?.hasAttribute('data-ssg-map-startup-circle')).toBe(expected)
      if (expected) {
        expect(tile?.getAttribute('crossorigin')).toBe('anonymous')
        expect(tile?.parentElement?.style.getPropertyValue('--metravel-map-shell-tile-offset-y')).toMatch(/px$/)
        expect(fetchMock).toHaveBeenCalledTimes(1)
        settleRadiusResponse(response())
        await fetchTravelsForMap(0, MAP_TRAVELS_PER_PAGE, filter, { throwOnError: true })
        expect(fetchMock).toHaveBeenCalledTimes(1)
      }
    } finally {
      if (shellPending) Reflect.deleteProperty(document, 'readyState')
      window.matchMedia = matchMedia
      if (permissions) Object.defineProperty(navigator, 'permissions', permissions)
      else Reflect.deleteProperty(navigator, 'permissions')
      if (geolocation) Object.defineProperty(navigator, 'geolocation', geolocation)
      else Reflect.deleteProperty(navigator, 'geolocation')
      document.body.innerHTML = ''
    }
  })

  it.each([MAP_FILTERS_STORAGE_KEY, MAP_LOCATION_STORAGE_KEY, MAP_ROUTE_STORAGE_KEY, 'userId'])(
    'skips the early request when %s is present',
    (key) => {
      window.localStorage.setItem(key, '')
      startBootstrap()
      expect(fetchMock).not.toHaveBeenCalled()
      expect(document.getElementById('metravel-leaflet-css')).not.toBeNull()
    },
  )

  it.each(['/map?lat=54&lng=25', '/map?radius=100', '/search'])('does not warm %s', (path) => {
    window.history.replaceState(null, '', path)
    startBootstrap()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('skips a different API origin and uses a page-origin proxy for explicit E2E', () => {
    startBootstrap('https://different.test/api')
    expect(fetchMock).not.toHaveBeenCalled()
    startBootstrap('http://127.0.0.1:8085', { nodeEnv: 'production', isE2E: true })
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/^https:\/\/example\.test\/api\/travels\/search_travels_for_map\//),
      expect.objectContaining({ credentials: 'include' }),
    )
  })

  it('escapes configured API data embedded into the head script', () => {
    const script = buildMapHeadBootstrapScript('https://example.test/</script><script>', { nodeEnv: 'production' })
    expect(script).not.toContain('</script>')
    new Function(script)()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('falls back when the active URL differs and cancels the unused prefetch', async () => {
    startBootstrap()
    const preloadSignal = fetchMock.mock.calls[0][1].signal as AbortSignal
    await fetchTravelsForMap(0, MAP_TRAVELS_PER_PAGE, { ...filter, radius: '100' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1][0]).not.toBe(fetchMock.mock.calls[0][0])
    expect(preloadSignal.aborted).toBe(true)
  })

  it('falls back through the ordinary session transport for an unauthorized preload', async () => {
    fetchMock.mockResolvedValueOnce(response(401))
    startBootstrap()
    await fetchTravelsForMap(0, MAP_TRAVELS_PER_PAGE, filter)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1][1].credentials).toBe('include')
  })

  it('falls back through the ordinary query when a preloaded body cannot be read', async () => {
    fetchMock.mockResolvedValueOnce({ ...response(), text: async () => { throw new TypeError('Broken body') } })
    startBootstrap()
    const result = await fetchTravelsForMap(0, MAP_TRAVELS_PER_PAGE, filter)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result[0]).toMatchObject({ coord: '53.9,27.56' })
  })

  it.each([
    ['session', () => window.localStorage.setItem('userId', '42')],
    ['route', () => window.history.replaceState(null, '', '/map?radius=100')],
  ] as const)('falls back when the %s changes while reading the preloaded body', async (_kind, change) => {
    fetchMock.mockResolvedValueOnce({
      ...response(),
      text: async () => {
        change()
        return '{"data":[{"id":2,"coord":"53,27"}],"total":1}'
      },
    })
    startBootstrap()

    const result = await fetchTravelsForMap(0, MAP_TRAVELS_PER_PAGE, filter)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result[0]).toMatchObject({ id: 1, coord: '53.9,27.56' })
  })

  it('expires a prefetched result that has no consumer', async () => {
    startBootstrap()
    const preloadSignal = fetchMock.mock.calls[0][1].signal as AbortSignal
    jest.advanceTimersByTime(MAP_RADIUS_PRELOAD_TTL_MS)
    expect(preloadSignal.aborted).toBe(true)
    await fetchTravelsForMap(0, MAP_TRAVELS_PER_PAGE, filter)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('honors cancellation while consuming the initial response body', async () => {
    const bodyStarted = jest.fn()
    fetchMock.mockImplementationOnce((_url, { signal }: { signal: AbortSignal }) => Promise.resolve({
      ...response(),
      text: () => new Promise<string>((_resolve, reject) => {
        bodyStarted()
        signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
      }),
    }))
    const controller = new AbortController()
    startBootstrap()
    const pending = fetchTravelsForMap(0, MAP_TRAVELS_PER_PAGE, filter, { signal: controller.signal })
    await Promise.resolve()
    expect(bodyStarted).toHaveBeenCalledTimes(1)
    controller.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
