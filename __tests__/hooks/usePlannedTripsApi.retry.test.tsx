import { cleanup, renderHook, waitFor } from '@testing-library/react-native'
import { Platform } from 'react-native'

import { ApiError } from '@/api/client'
import { queryKeys } from '@/api/queryKeys'
import { useAuthStore } from '@/stores/authStore'
import { getSecureItem } from '@/utils/secureStorage'
import { createQueryWrapper } from '../helpers/testQueryClient'

jest.mock('@/utils/secureStorage', () => ({
  ...jest.requireActual('@/utils/secureStorage'),
  getSecureItem: jest.fn(),
  removeSecureItems: jest.fn(async () => undefined),
}))

// Keep the real request adapter, HTTP client and timeout transport. In
// particular, DEV's 404/501/offline fixtures must not turn a failure into data.
const originalTripsMock = process.env.EXPO_PUBLIC_TRIPS_MOCK
const originalDev = __DEV__
process.env.EXPO_PUBLIC_TRIPS_MOCK = 'false'
global.__DEV__ = false
const {
  useMyPlannedTrips,
  usePlannedTrip,
  useCommunityTrips,
  useTripRouteElevation,
  useRouteTemplates,
  useTripSuggestions,
} = require('@/hooks/usePlannedTripsApi') as typeof import('@/hooks/usePlannedTripsApi')

const mockedGetSecureItem = jest.mocked(getSecureItem)
const originalPlatform = Platform.OS
const originalAuth = useAuthStore.getState()
const tripId = 1806
const endpoint = `/trips/planned/${tripId}/`

const response = (status: number, body: unknown): Response => ({
  ok: status >= 200 && status < 300,
  status,
  statusText: '',
  text: async () => JSON.stringify(body),
  json: async () => body,
} as Response)

const namedError = (name: string, message: string): Error =>
  Object.assign(new Error(message), { name })

describe('planned-trip query retry through the real HTTP pipeline', () => {
  let fetchSpy: jest.SpyInstance<ReturnType<typeof fetch>, Parameters<typeof fetch>>
  const clients: ReturnType<typeof createQueryWrapper>['queryClient'][] = []

  const createHarness = () => {
    const harness = createQueryWrapper()
    // The hooks supply their production retry predicate; only backoff is zeroed.
    harness.queryClient.setDefaultOptions({ queries: { retryDelay: 0 } })
    clients.push(harness.queryClient)
    return harness
  }

  const renderTrip = () => {
    const { Wrapper } = createHarness()
    return renderHook(() => usePlannedTrip(tripId), { wrapper: Wrapper })
  }

  const expectPlannedRequests = (count: number) => {
    expect(fetchSpy).toHaveBeenCalledTimes(count)
    for (const [url] of fetchSpy.mock.calls) {
      expect(String(url)).toMatch(new RegExp(`${endpoint}$`))
    }
  }

  beforeEach(() => {
    Platform.OS = 'ios'
    global.__DEV__ = false
    mockedGetSecureItem.mockReset()
    mockedGetSecureItem.mockResolvedValue('test-planned-trip-token')
    useAuthStore.setState({ authReady: true, isAuthenticated: true, userId: '7' })
    // All requests terminate here; no local, dev or production server is used.
    fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async () => {
      throw new Error('Missing planned-trip fetch fixture')
    })
  })

  afterEach(() => {
    cleanup()
    clients.splice(0).forEach((client) => client.clear())
    fetchSpy.mockRestore()
    Platform.OS = originalPlatform
    useAuthStore.setState(originalAuth, true)
  })

  afterAll(() => {
    global.__DEV__ = originalDev
    if (originalTripsMock === undefined) delete process.env.EXPO_PUBLIC_TRIPS_MOCK
    else process.env.EXPO_PUBLIC_TRIPS_MOCK = originalTripsMock
  })

  it.each([400, 401, 403, 404, 409, 410, 422, 429])(
    'settles HTTP %i as an error after exactly one request',
    async (status) => {
      // No session credential means apiClient has no refresh/fallback request
      // of its own; this isolates the React Query retry boundary for HTTP 401.
      if (status === 401) mockedGetSecureItem.mockResolvedValue(null)
      fetchSpy.mockImplementation(async () => response(status, { detail: 'Request rejected' }))

      const { result } = renderTrip()

      await waitFor(() => expect(result.current.isError).toBe(true))
      expect(result.current.fetchStatus).toBe('idle')
      expect(result.current.error).toBeInstanceOf(ApiError)
      expect(result.current.error).toMatchObject({ status })
      expect(result.current.data).toBeUndefined()
      expectPlannedRequests(1)
    },
  )

  it.each([408, 500, 501, 502, 503, 504])(
    'exhausts two retries for HTTP %i, then exposes the terminal server error',
    async (status) => {
      fetchSpy.mockImplementation(async () => response(status, { detail: 'Upstream timeout' }))

      const { result } = renderTrip()

      await waitFor(() => expect(result.current.isError).toBe(true))
      expect(result.current.fetchStatus).toBe('idle')
      expect(result.current.error).toMatchObject({ status, message: 'Upstream timeout' })
      expect(result.current.failureCount).toBe(3)
      expect(result.current.data).toBeUndefined()
      expectPlannedRequests(3)
    },
  )

  it.each([
    'Network request failed',
    'Failed to fetch',
    'Load failed',
    'NetworkError when attempting to fetch resource.',
  ])(
    'retries a real fetch rejection (%s) twice and then settles',
    async (message) => {
      fetchSpy.mockRejectedValue(new TypeError(message))

      const { result } = renderTrip()

      await waitFor(() => expect(result.current.isError).toBe(true))
      expect(result.current.fetchStatus).toBe('idle')
      expect(result.current.failureCount).toBe(3)
      expect(result.current.data).toBeUndefined()
      if (message === 'Network request failed') {
        expect(result.current.error).toBeInstanceOf(ApiError)
        expect(result.current.error).toMatchObject({ status: 0 })
      } else if (message === 'Failed to fetch') {
        // fetchWithTimeout wraps the browser rejection while preserving cause.
        expect(result.current.error).toMatchObject({ cause: { message } })
      } else {
        expect(result.current.error).toBeInstanceOf(TypeError)
        expect(result.current.error).toMatchObject({ message })
      }
      expectPlannedRequests(3)
    },
  )

  it.each([
    namedError('TimeoutError', 'Local request deadline exceeded'),
    new TypeError('Cannot read properties of undefined'),
  ])('does not repeat a local $name: $message', async (error) => {
    fetchSpy.mockRejectedValue(error)

    const { result } = renderTrip()

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.fetchStatus).toBe('idle')
    expect(result.current.error).toBe(error)
    expectPlannedRequests(1)
  })

  it('loads and normalizes a healthy trip with one request', async () => {
    fetchSpy.mockImplementation(async () => response(200, {
      id: tripId,
      title: 'Healthy trip',
      owner: { id: 7, username: 'Organizer' },
    }))

    const { result } = renderTrip()

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toMatchObject({
      id: tripId,
      title: 'Healthy trip',
      isOwner: true,
      organizer: { id: 7 },
    })
    expect(result.current.error).toBeNull()
    expectPlannedRequests(1)
  })

  it('does not retry a DTO normalization error when the browser reports offline', async () => {
    Platform.OS = 'web'
    const onlineSpy = jest.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    // The response succeeds; mapTrip throws afterwards, outside the HTTP
    // client's transport-error conversion. Offline status must not mask it.
    fetchSpy.mockImplementation(async () => response(200, null))
    try {
      const { result } = renderTrip()
      await waitFor(() => expect(result.current.isError).toBe(true))
      expect(result.current.error).toBeInstanceOf(TypeError)
      expect(result.current.fetchStatus).toBe('idle')
      expectPlannedRequests(1)
    } finally {
      onlineSpy.mockRestore()
    }
  })

  it('attaches the same bounded retry policy to all six read hooks', () => {
    useAuthStore.setState({ authReady: false, isAuthenticated: false })
    const { queryClient, Wrapper } = createHarness()
    // Public collections are disabled by a fresh cache, so this wiring check
    // does not need unrelated collection response fixtures.
    queryClient.setQueryData(queryKeys.communityTrips({}), [])
    queryClient.setQueryData(queryKeys.routeTemplates(), [])
    renderHook(() => {
      useMyPlannedTrips()
      usePlannedTrip(null)
      useCommunityTrips()
      useTripRouteElevation(null)
      useRouteTemplates()
      useTripSuggestions(null)
    }, { wrapper: Wrapper })

    const queries = queryClient.getQueryCache().getAll()
    expect(queries).toHaveLength(6)
    const retry = queries[0].options.retry
    expect(typeof retry).toBe('function')
    for (const query of queries) expect(query.options.retry).toBe(retry)
    if (typeof retry !== 'function') throw new Error('Expected query retry predicate')

    expect(retry(0, namedError('AbortError', 'Network request failed'))).toBe(false)
    expect(retry(0, namedError('TimeoutError', 'Network request failed'))).toBe(false)
    expect(retry(0, new TypeError('Cannot read properties of undefined'))).toBe(false)
    expect(retry(0, new TypeError('Network request failed'))).toBe(true)
    expect(retry(2, new TypeError('Network request failed'))).toBe(false)
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
