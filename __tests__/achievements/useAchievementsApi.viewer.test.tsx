import React from 'react'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { queryKeys } from '@/api/queryKeys'
import { useAuthStore } from '@/stores/authStore'
import {
  fetchTravelPeerBadges, fetchUserAchievements, grantPeerBadge,
  type GrantResult, type PeerBadgeReceived, type PublicAchievements,
} from '@/api/achievements'
import { MOCK_PEER_CATALOG, MOCK_PUBLIC_ACHIEVEMENTS } from '@/api/achievementsMock'
import { useGrantPeerBadge, useTravelPeerBadges, useUserAchievements } from '@/hooks/useAchievementsApi'

jest.mock('@/api/achievements', () => ({
  fetchTravelPeerBadges: jest.fn(), fetchUserAchievements: jest.fn(), grantPeerBadge: jest.fn(),
}))
jest.mock('@/i18n/useLocaleRevision', () => ({ useLocaleRevision: () => 'ru' }))
jest.mock('@/stores/authStore', () => ({
  useAuthStore: jest.requireActual('zustand').create(() => ({
    isAuthenticated: false, userId: null, authReady: true,
  })),
}))

const received = (viewer: string | null): PeerBadgeReceived[] => [{
  badge: MOCK_PEER_CATALOG[0], count: 2, grantedByMe: viewer === 'A',
}]
const author = (viewer: string | null): PublicAchievements => ({
  ...MOCK_PUBLIC_ACHIEVEMENTS, peerReceived: received(viewer),
})
const deferred = <T,>() => {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}
const setViewer = (viewer: string | null) => {
  act(() => { useAuthStore.setState({ isAuthenticated: viewer != null, userId: viewer, authReady: true }) })
}
let client: QueryClient
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
)
const useReads = () => ({ user: useUserAchievements(104), travel: useTravelPeerBadges(44) })

beforeEach(() => {
  jest.resetAllMocks()
  useAuthStore.setState({ isAuthenticated: false, userId: null, authReady: true })
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  jest.mocked(fetchUserAchievements).mockImplementation(async (_id, _locale, options) =>
    author(options?.authenticated ? useAuthStore.getState().userId : null))
  jest.mocked(fetchTravelPeerBadges).mockImplementation(async (_id, options) =>
    received(options?.authenticated ? useAuthStore.getState().userId : null))
})
afterEach(() => { client.clear() })

it.each([
  { authReady: false, isAuthenticated: false, userId: null },
  { authReady: false, isAuthenticated: true, userId: 'A' },
  { authReady: true, isAuthenticated: true, userId: null },
  { authReady: true, isAuthenticated: true, userId: '' },
])('waits for a resolved viewer before either personalized read: %j', async state => {
  useAuthStore.setState(state)
  const { result } = renderHook(useReads, { wrapper })
  expect(fetchUserAchievements).not.toHaveBeenCalled()
  expect(fetchTravelPeerBadges).not.toHaveBeenCalled()
  expect(result.current.user.fetchStatus).toBe('idle')
  expect(result.current.travel.fetchStatus).toBe('idle')

  setViewer('A')
  await waitFor(() => expect(result.current.user.isSuccess && result.current.travel.isSuccess).toBe(true))
  expect(fetchUserAchievements).toHaveBeenCalledWith(104, 'ru', { authenticated: true })
  expect(fetchTravelPeerBadges).toHaveBeenCalledWith(44, { authenticated: true })
})

it('separates guest, reader A and reader B without relying on a global identity cache reset', async () => {
  const { result } = renderHook(useReads, { wrapper })
  await waitFor(() => expect(result.current.user.isSuccess && result.current.travel.isSuccess).toBe(true))
  expect(fetchUserAchievements).toHaveBeenLastCalledWith(104, 'ru', { authenticated: false })
  expect(fetchTravelPeerBadges).toHaveBeenLastCalledWith(44, { authenticated: false })

  for (const viewer of ['A', 'B', null]) {
    setViewer(viewer)
    await waitFor(() => {
      expect(result.current.user.data).toEqual(author(viewer))
      expect(result.current.travel.data).toEqual(received(viewer))
    })
  }
  for (const viewer of [null, 'A', 'B']) {
    expect(client.getQueryData(queryKeys.achievementsUser(104, viewer, 'ru'))).toEqual(author(viewer))
    expect(client.getQueryData(queryKeys.achievementsTravelPeer(44, viewer))).toEqual(received(viewer))
  }
  // The final guest uses its warm anonymous entry, never A's grantedByMe state.
  expect(fetchUserAchievements).toHaveBeenCalledTimes(3)
  expect(fetchTravelPeerBadges).toHaveBeenCalledTimes(3)
})

it('keeps delayed A responses out of B entries and preserves the captured credential mode', async () => {
  setViewer('A')
  const pendingUser = deferred<PublicAchievements>()
  const pendingTravel = deferred<PeerBadgeReceived[]>()
  jest.mocked(fetchUserAchievements).mockReturnValueOnce(pendingUser.promise)
  jest.mocked(fetchTravelPeerBadges).mockReturnValueOnce(pendingTravel.promise)
  const { result } = renderHook(useReads, { wrapper })
  await waitFor(() => expect(fetchTravelPeerBadges).toHaveBeenCalledTimes(1))
  setViewer('B')
  await waitFor(() => expect(result.current.user.data).toEqual(author('B')))
  await act(async () => {
    pendingUser.resolve(author('A'))
    pendingTravel.resolve(received('A'))
  })
  expect(result.current.user.data).toEqual(author('B'))
  expect(result.current.travel.data).toEqual(received('B'))
  expect(client.getQueryData(queryKeys.achievementsUser(104, 'A', 'ru'))).toEqual(author('A'))
  expect(client.getQueryData(queryKeys.achievementsTravelPeer(44, 'A'))).toEqual(received('A'))
  expect(jest.mocked(fetchUserAchievements).mock.calls.map(call => call[2])).toEqual([
    { authenticated: true }, { authenticated: true },
  ])
  setViewer(null)
  await waitFor(() => expect(result.current.user.data).toEqual(author(null)))
  expect(fetchUserAchievements).toHaveBeenLastCalledWith(104, 'ru', { authenticated: false })
  expect(fetchTravelPeerBadges).toHaveBeenLastCalledWith(44, { authenticated: false })
})

it.each([
  ['user', 'success'], ['user', 'failure'], ['travel', 'success'], ['travel', 'failure'],
] as const)('isolates a late A %s mutation %s and invalidates every viewer of the public target', async (target, outcome) => {
  setViewer('A')
  const pending = deferred<GrantResult>()
  jest.mocked(grantPeerBadge).mockReturnValueOnce(pending.promise)
  const key = (viewer: string | null, locale = 'ru') => target === 'user'
    ? queryKeys.achievementsUser(104, viewer, locale)
    : queryKeys.achievementsTravelPeer(44, viewer)
  for (const viewer of [null, 'A', 'B']) {
    client.setQueryData(key(viewer), target === 'user' ? author(viewer) : received(viewer))
  }
  if (target === 'user') client.setQueryData(key('B', 'pl'), author('B'))
  client.setQueryData(queryKeys.achievementsMe('B', 'ru'), { private: 'B' })
  client.setQueryData(queryKeys.achievementsTravelPeer(999, 'B'), [])
  const { result } = renderHook(useGrantPeerBadge, { wrapper })
  let mutation!: Promise<unknown>
  act(() => {
    mutation = result.current.mutateAsync({
      badgeSlug: MOCK_PEER_CATALOG[0].slug,
      ...(target === 'user' ? { recipientId: 104 } : { travelId: 44 }),
    }).catch(error => error)
  })
  await waitFor(() => expect(grantPeerBadge).toHaveBeenCalledTimes(1))
  // Only A's originating query is optimistic; B and the guest stay untouched.
  expect(client.getQueryData(key('B'))).toEqual(target === 'user' ? author('B') : received('B'))
  setViewer('B')
  await act(async () => {
    if (outcome === 'success') pending.resolve({ granted: true, count: 99 })
    else pending.reject(new Error('Rejected by server'))
    await mutation
  })
  for (const viewer of [null, 'A', 'B']) {
    expect(client.getQueryState(key(viewer))?.isInvalidated).toBe(true)
    if (viewer !== 'A') expect(client.getQueryData(key(viewer))).toEqual(target === 'user' ? author(viewer) : received(viewer))
  }
  if (target === 'user') expect(client.getQueryState(key('B', 'pl'))?.isInvalidated).toBe(true)
  expect(client.getQueryData(queryKeys.achievementsMe('B', 'ru'))).toEqual({ private: 'B' })
  expect(client.getQueryState(queryKeys.achievementsMe('B', 'ru'))?.isInvalidated).toBe(false)
  expect(client.getQueryState(queryKeys.achievementsTravelPeer(999, 'B'))?.isInvalidated).toBe(false)
})

it.each(['user', 'travel'] as const)('rolls back only the failed badge while another %s award succeeds', async target => {
  setViewer('A')
  const rejected = deferred<GrantResult>()
  const confirmed = deferred<GrantResult>()
  const badges = MOCK_PEER_CATALOG.slice(0, 2)
  const initial = badges.map(badge => ({ badge, count: 0, grantedByMe: false }))
  const key = target === 'user'
    ? queryKeys.achievementsUser(104, 'A', 'ru')
    : queryKeys.achievementsTravelPeer(44, 'A')
  client.setQueryData(key, target === 'user' ? { ...author('A'), peerReceived: initial } : initial)
  jest.mocked(grantPeerBadge)
    .mockReturnValueOnce(rejected.promise)
    .mockReturnValueOnce(confirmed.promise)
  const { result } = renderHook(useGrantPeerBadge, { wrapper })
  const input = (badgeSlug: string) => ({
    badgeSlug, ...(target === 'user' ? { recipientId: 104 } : { travelId: 44 }),
  })
  let first!: Promise<unknown>
  let second!: Promise<unknown>
  act(() => { first = result.current.mutateAsync(input(badges[0].slug)).catch(error => error) })
  await waitFor(() => expect(grantPeerBadge).toHaveBeenCalledTimes(1))
  act(() => { second = result.current.mutateAsync(input(badges[1].slug)) })
  await waitFor(() => expect(grantPeerBadge).toHaveBeenCalledTimes(2))
  await act(async () => {
    confirmed.resolve({ granted: true, count: 10 })
    await second
    rejected.reject(new Error('First badge rejected'))
    await first
  })
  const cached = client.getQueryData<PublicAchievements | PeerBadgeReceived[]>(key)!
  const awards = Array.isArray(cached) ? cached : cached.peerReceived
  expect(awards).toEqual([initial[0], { ...initial[1], count: 10, grantedByMe: true }])
})
