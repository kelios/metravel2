import React from 'react'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import i18n from '@/i18n/instance'
import { SUPPORTED_LOCALES, type SupportedLocale } from '@/i18n/config'
import { queryKeys } from '@/api/queryKeys'
import { dropQueryCacheForIdentityChange } from '@/api/identityQueryCache'
import { useAuthStore } from '@/stores/authStore'
import {
  fetchBadgeCatalog, fetchMyAchievements, fetchUserAchievements,
  fetchMyRareAwards, fetchUserRareAwards, grantPeerBadge, grantRareAward,
  type MyAchievements, type PublicAchievements, type GrantResult,
} from '@/api/achievements'
import { MOCK_BADGES, MOCK_MY_ACHIEVEMENTS, MOCK_PUBLIC_ACHIEVEMENTS, MOCK_PEER_CATALOG, MOCK_RARE_AWARDS } from '@/api/achievementsMock'
import {
  useBadgeCatalog, useMyAchievements, useUserAchievements,
  useMyRareAwards, useUserRareAwards, useGrantPeerBadge, useGrantRareAward,
} from '@/hooks/useAchievementsApi'

jest.mock('@/api/achievements', () => ({
  fetchBadgeCatalog: jest.fn(), fetchMyAchievements: jest.fn(), fetchUserAchievements: jest.fn(),
  fetchMyRareAwards: jest.fn(), fetchUserRareAwards: jest.fn(),
  grantPeerBadge: jest.fn(), grantRareAward: jest.fn(),
}))
jest.mock('@/stores/authStore', () => ({
  useAuthStore: jest.requireActual('zustand').create(() => ({ isAuthenticated: true, userId: 'owner-A', authReady: true })),
}))

const catalog = (locale: SupportedLocale) => [{ ...MOCK_BADGES[0], description: `description-${locale}` }]
const mine = (locale: SupportedLocale): MyAchievements => ({
  ...MOCK_MY_ACHIEVEMENTS,
  earned: [{ ...MOCK_MY_ACHIEVEMENTS.earned[0], badge: catalog(locale)[0] }],
})
const publicData = (locale: SupportedLocale): PublicAchievements => ({
  ...MOCK_PUBLIC_ACHIEVEMENTS,
  earned: [{ ...MOCK_PUBLIC_ACHIEVEMENTS.earned[0], badge: catalog(locale)[0] }],
  peerReceived: [{ badge: MOCK_PEER_CATALOG[0], count: 2, grantedByMe: false }],
})
const deferred = <T,>() => {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}
let client: QueryClient
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
)
const switchLocale = async (locale: SupportedLocale) => {
  await act(async () => { await i18n.changeLanguage(locale) })
}
const useAllReads = () => ({ catalog: useBadgeCatalog(), mine: useMyAchievements(), user: useUserAchievements(104) })

beforeEach(async () => {
  jest.resetAllMocks()
  useAuthStore.setState({ isAuthenticated: true, userId: 'owner-A', authReady: true })
  await i18n.changeLanguage('ru')
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  jest.mocked(fetchBadgeCatalog).mockImplementation(async locale => catalog(locale!))
  jest.mocked(fetchMyAchievements).mockImplementation(async locale => mine(locale!))
  jest.mocked(fetchUserAchievements).mockImplementation(async (_id, locale) => publicData(locale!))
})
afterEach(async () => {
  client.clear()
  await switchLocale('ru')
})

it.each(SUPPORTED_LOCALES)('captures the applied %s locale in every query and request', async locale => {
  await switchLocale(locale)
  const { result } = await renderHook(useAllReads, { wrapper })
  await waitFor(() => expect(result.current.mine.data?.earned[0].badge.description).toBe(`description-${locale}`))
  expect(result.current.catalog.data).toEqual(catalog(locale))
  expect(result.current.user.data).toEqual(publicData(locale))
  expect(fetchBadgeCatalog).toHaveBeenCalledWith(locale)
  expect(fetchMyAchievements).toHaveBeenCalledWith(locale)
  expect(fetchUserAchievements).toHaveBeenCalledWith(104, locale, { authenticated: true })
  expect(client.getQueryData(queryKeys.achievementsBadges(locale))).toEqual(catalog(locale))
  expect(client.getQueryData(queryKeys.achievementsMe('owner-A', locale))).toEqual(mine(locale))
  expect(client.getQueryData(queryKeys.achievementsUser(104, 'owner-A', locale))).toEqual(publicData(locale))
})

it('keeps warm RU → delayed PL → EN → RU responses in their own locale entries', async () => {
  const pendingCatalog = deferred<ReturnType<typeof catalog>>()
  const pendingMine = deferred<MyAchievements>()
  const pendingUser = deferred<PublicAchievements>()
  jest.mocked(fetchBadgeCatalog).mockImplementation(locale => locale === 'pl' ? pendingCatalog.promise : Promise.resolve(catalog(locale!)))
  jest.mocked(fetchMyAchievements).mockImplementation(locale => locale === 'pl' ? pendingMine.promise : Promise.resolve(mine(locale!)))
  jest.mocked(fetchUserAchievements).mockImplementation((_id, locale) => locale === 'pl' ? pendingUser.promise : Promise.resolve(publicData(locale!)))
  const { result } = await renderHook(useAllReads, { wrapper })
  await waitFor(() => expect(result.current.user.data).toEqual(publicData('ru')))
  await switchLocale('pl')
  await waitFor(() => expect(fetchMyAchievements).toHaveBeenCalledWith('pl'))
  expect(result.current.mine.data).toBeUndefined()
  await switchLocale('en')
  await waitFor(() => expect(result.current.user.data).toEqual(publicData('en')))
  await switchLocale('ru')
  expect(result.current.mine.data).toEqual(mine('ru'))
  await act(async () => {
    pendingCatalog.resolve(catalog('pl')); pendingMine.resolve(mine('pl')); pendingUser.resolve(publicData('pl'))
  })
  expect(result.current.catalog.data).toEqual(catalog('ru'))
  expect(result.current.mine.data).toEqual(mine('ru'))
  expect(result.current.user.data).toEqual(publicData('ru'))
  expect(client.getQueryData(queryKeys.achievementsMe('owner-A', 'pl'))).toEqual(mine('pl'))
  expect(fetchMyAchievements).toHaveBeenCalledTimes(3)
})

it('seeds rare awards only from the active locale and retains neutral rare prose', async () => {
  const ru = { ...mine('ru'), rareAwards: [{ ...MOCK_RARE_AWARDS[0], reason: 'RU source' }] }
  const pl = { ...mine('pl'), rareAwards: [{ ...MOCK_RARE_AWARDS[0], reason: 'server prose' }] }
  client.setQueryData(queryKeys.achievementsMe('owner-A', 'ru'), ru)
  client.setQueryData(queryKeys.achievementsMe('owner-A', 'pl'), pl)
  client.setQueryData(queryKeys.achievementsUser(104, 'owner-A', 'pl'), { ...publicData('pl'), rareAwards: pl.rareAwards })
  await switchLocale('pl')
  const { result } = await renderHook(() => ({ mine: useMyRareAwards(), user: useUserRareAwards(104) }), { wrapper })
  expect(result.current.mine.data).toEqual(pl.rareAwards)
  expect(result.current.user.data).toEqual(pl.rareAwards)
  expect(client.getQueryData(queryKeys.achievementsRareMe('owner-A', 'pl'))).toEqual(pl.rareAwards)
  expect(fetchMyRareAwards).not.toHaveBeenCalled()
  expect(fetchUserRareAwards).not.toHaveBeenCalled()
})

it('refreshes derived rare data after an invalidated consolidated response changes', async () => {
  const initialAwards = [MOCK_RARE_AWARDS[0]]
  const updatedAwards = [...initialAwards, MOCK_RARE_AWARDS[1]]
  const ownKey = queryKeys.achievementsMe('owner-A', 'ru')
  const userKey = queryKeys.achievementsUser(104, 'owner-A', 'ru')
  client.setQueryData(ownKey, { ...mine('ru'), rareAwards: initialAwards })
  client.setQueryData(userKey, { ...publicData('ru'), rareAwards: initialAwards })
  jest.mocked(fetchMyAchievements).mockResolvedValue({ ...mine('ru'), rareAwards: updatedAwards })
  jest.mocked(fetchUserAchievements).mockResolvedValue({ ...publicData('ru'), rareAwards: updatedAwards })
  const { result } = await renderHook(() => ({ mine: useMyRareAwards(), user: useUserRareAwards(104) }), { wrapper })
  expect(result.current.mine.data).toEqual(initialAwards)
  await act(async () => {
    await client.invalidateQueries({ queryKey: queryKeys.achievementsMeAll('owner-A') })
    await client.invalidateQueries({ queryKey: queryKeys.achievementsUserAll(104) })
  })
  await waitFor(() => expect(result.current.mine.data).toEqual(updatedAwards))
  expect(result.current.user.data).toEqual(updatedAwards)
  expect(client.getQueryData(queryKeys.achievementsRareMe('owner-A', 'ru'))).toEqual(updatedAwards)
  expect(client.getQueryData(queryKeys.achievementsRareUser(104, 'ru'))).toEqual(updatedAwards)
  expect(fetchMyRareAwards).not.toHaveBeenCalled()
  expect(fetchUserRareAwards).not.toHaveBeenCalled()
})

it('invalidates all warmed consolidated and rare locale copies after a rare grant, retaining other owners', async () => {
  for (const locale of SUPPORTED_LOCALES) {
    client.setQueryData(queryKeys.achievementsMe('owner-A', locale), mine(locale))
    client.setQueryData(queryKeys.achievementsRareMe('owner-A', locale), [])
    client.setQueryData(queryKeys.achievementsUser(104, 'owner-A', locale), publicData(locale))
    client.setQueryData(queryKeys.achievementsRareUser(104, locale), [])
    client.setQueryData(queryKeys.achievementsMe('owner-B', locale), mine(locale))
    client.setQueryData(queryKeys.achievementsUser(999, 'owner-A', locale), publicData(locale))
  }
  const { result } = await renderHook(useGrantRareAward, { wrapper })
  await act(async () => { await result.current.mutateAsync({ userId: 104, awardSlug: 'rare', reason: 'reason' }) })
  for (const locale of SUPPORTED_LOCALES) {
    for (const key of [queryKeys.achievementsMe('owner-A', locale), queryKeys.achievementsRareMe('owner-A', locale), queryKeys.achievementsUser(104, 'owner-A', locale), queryKeys.achievementsRareUser(104, locale)]) {
      expect(client.getQueryState(key)?.isInvalidated).toBe(true)
    }
    expect(client.getQueryState(queryKeys.achievementsMe('owner-B', locale))?.isInvalidated).toBe(false)
    expect(client.getQueryState(queryKeys.achievementsUser(999, 'owner-A', locale))?.isInvalidated).toBe(false)
  }
  expect(grantRareAward).toHaveBeenCalledTimes(1)
})

it('rolls a failed peer toggle back only in its original locale and invalidates all locale copies', async () => {
  const pending = deferred<GrantResult>()
  jest.mocked(grantPeerBadge).mockReturnValue(pending.promise)
  for (const locale of SUPPORTED_LOCALES) client.setQueryData(queryKeys.achievementsUser(104, 'owner-A', locale), publicData(locale))
  const { result } = await renderHook(useGrantPeerBadge, { wrapper })
  let mutation!: Promise<unknown>
  await act(() => { mutation = result.current.mutateAsync({ recipientId: 104, badgeSlug: MOCK_PEER_CATALOG[0].slug }).catch(error => error) })
  await waitFor(() => expect(client.getQueryData<PublicAchievements>(queryKeys.achievementsUser(104, 'owner-A', 'ru'))?.peerReceived[0].count).toBe(3))
  await switchLocale('pl')
  await act(async () => { pending.reject(new Error('grant failed')); await mutation })
  expect(client.getQueryData(queryKeys.achievementsUser(104, 'owner-A', 'ru'))).toEqual(publicData('ru'))
  expect(client.getQueryData(queryKeys.achievementsUser(104, 'owner-A', 'pl'))).toEqual(publicData('pl'))
  for (const locale of SUPPORTED_LOCALES) expect(client.getQueryState(queryKeys.achievementsUser(104, 'owner-A', locale))?.isInvalidated).toBe(true)
})

it.each(['user', 'travel'] as const)('cannot resurrect a %s cache through late rollback after logout and same-owner login', async target => {
  const pending = deferred<GrantResult>()
  jest.mocked(grantPeerBadge).mockReturnValue(pending.promise)
  const key = target === 'user' ? queryKeys.achievementsUser(104, 'owner-A', 'ru') : queryKeys.achievementsTravelPeer(44, 'owner-A')
  const initial = target === 'user' ? publicData('ru') : publicData('ru').peerReceived
  client.setQueryData(key, initial)
  const { result } = await renderHook(useGrantPeerBadge, { wrapper })
  let mutation!: Promise<unknown>
  await act(() => { mutation = result.current.mutateAsync({ recipientId: 104, ...(target === 'travel' ? { travelId: 44 } : {}), badgeSlug: MOCK_PEER_CATALOG[0].slug }).catch(error => error) })
  await waitFor(() => expect(grantPeerBadge).toHaveBeenCalledTimes(1))
  await act(async () => {
    useAuthStore.setState({ isAuthenticated: false, userId: null })
    await dropQueryCacheForIdentityChange(client, () => true)
    useAuthStore.setState({ isAuthenticated: true, userId: 'owner-A', authReady: true })
  })
  expect(client.getQueryData(key)).toBeUndefined()
  await act(async () => { pending.reject(new Error('late error')); await mutation })
  expect(client.getQueryData(key)).toBeUndefined()
})

it('does not overwrite a recreated public cache when a previous identity mutation succeeds', async () => {
  const pending = deferred<GrantResult>()
  jest.mocked(grantPeerBadge).mockReturnValue(pending.promise)
  const key = queryKeys.achievementsUser(104, 'owner-A', 'ru')
  const newKey = queryKeys.achievementsUser(104, 'owner-B', 'ru')
  client.setQueryData(key, publicData('ru'))
  const { result } = await renderHook(useGrantPeerBadge, { wrapper })
  let mutation!: Promise<unknown>
  await act(() => { mutation = result.current.mutateAsync({ recipientId: 104, badgeSlug: MOCK_PEER_CATALOG[0].slug }) })
  await waitFor(() => expect(grantPeerBadge).toHaveBeenCalledTimes(1))
  await act(async () => {
    useAuthStore.setState({ isAuthenticated: true, userId: 'owner-B' })
    await dropQueryCacheForIdentityChange(client, () => true)
    client.setQueryData(newKey, publicData('ru'))
  })
  await act(async () => { pending.resolve({ granted: true, count: 99 }); await mutation })
  expect(client.getQueryData(newKey)).toEqual(publicData('ru'))
  expect(client.getQueryData(key)).toBeUndefined()
})

it('isolates delayed personal responses across logout and a different owner', async () => {
  const old = deferred<MyAchievements>()
  jest.mocked(fetchMyAchievements).mockReturnValueOnce(old.promise).mockResolvedValue(mine('en'))
  const { result } = await renderHook(useMyAchievements, { wrapper })
  await waitFor(() => expect(fetchMyAchievements).toHaveBeenCalledTimes(1))
  await act(async () => {
    useAuthStore.setState({ isAuthenticated: false, userId: null })
    await dropQueryCacheForIdentityChange(client, () => true)
  })
  expect(result.current.data).toBeUndefined()
  await switchLocale('en')
  await act(() => { useAuthStore.setState({ isAuthenticated: true, userId: 'owner-B' }) })
  await waitFor(() => expect(result.current.data).toEqual(mine('en')))
  await act(async () => { old.resolve(mine('ru')) })
  expect(result.current.data).toEqual(mine('en'))
  expect(client.getQueryData(queryKeys.achievementsMe('owner-A', 'ru'))).toBeUndefined()
  expect(client.getQueryData(queryKeys.achievementsMe('owner-B', 'en'))).toEqual(mine('en'))
})
