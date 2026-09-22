import React, { type ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query'
import type { ApiQuestBundle } from '@/api/quests'
import { queryKeys } from '@/api/queryKeys'
import { useQuestBundle } from '@/hooks/useQuestsApi'
import { useQuestRatingMeta } from '@/hooks/useQuestRatingMeta'
import { useQuestCompletionMeta } from '@/hooks/useQuestCompletionMeta'
import { useQuestPioneerMeta } from '@/hooks/useQuestPioneerMeta'
import { useQuestReview } from '@/hooks/useQuestReview'
import { refreshQuestsCatalogCompletion, refreshQuestsCatalogIdentity, resetQuestsCatalogCompletion } from '@/api/questsCatalogInvalidation'
import { dropQueryCacheForIdentityChange } from '@/api/identityQueryCache'
import { writeCachedQuestBundle } from '@/api/questBundleCache'

jest.mock('@/api/quests', () => ({
  fetchQuestByQuestId: jest.fn(), fetchQuestsByCity: jest.fn(), fetchQuestsList: jest.fn(),
}))
jest.mock('@/api/questBundleCache', () => ({ writeCachedQuestBundle: jest.fn() }))
jest.mock('@/hooks/useNetworkStatus', () => ({ useNetworkStatus: () => ({ isConnected: true }) }))
jest.mock('@/context/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: true, userId: 'A' }) }))
jest.mock('@/api/questReview', () => ({ getUserQuestReview: jest.fn().mockResolvedValue(null), submitQuestReview: jest.fn() }))
jest.mock('@/utils/questReviewAnalytics', () => ({ trackQuestReviewSubmit: jest.fn() }))
jest.mock('@/utils/questReturnVisit', () => ({ markQuestReviewLeft: jest.fn(), questRetentionOwnerId: () => 'A' }))

const { fetchQuestByQuestId, fetchQuestsByCity, fetchQuestsList } = jest.requireMock('@/api/quests')
const { submitQuestReview } = jest.requireMock('@/api/questReview')
const base: ApiQuestBundle = {
  id: 7, quest_id: 'quest-a', title: 'Quest A', city: { id: 11, name: 'City', lat: 1, lng: 2 },
  cover_url: 'https://example.test/cover.jpg', storage_key: 'quest-a', steps: [], intro: null,
  finale: { text: 'Done', video_url: null, poster_url: null },
  rating_avg: 4.5, rating_count: 8, completions_count: 12, is_completed_by_me: false,
  first_completer: { id: 42, name: 'Pioneer', avatar: null },
}

function useDetail(slug = 'quest-a') {
  const detail = useQuestBundle(slug)
  return {
    ...detail,
    rating: useQuestRatingMeta(slug, detail.bundle?.id),
    completion: useQuestCompletionMeta(slug, detail.bundle?.id),
    pioneer: useQuestPioneerMeta(slug, detail.bundle?.id),
  }
}

describe('single-quest metadata (#1992)', () => {
  let client: QueryClient
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  beforeEach(() => {
    jest.clearAllMocks()
    client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
    fetchQuestByQuestId.mockResolvedValue(base)
    fetchQuestsByCity.mockResolvedValue([{ id: 7, quest_id: 'quest-a', tags: { loop: true } }])
  })
  afterEach(() => { client.clear(); onlineManager.setOnline(true) })

  it('cold detail and all three real metadata hooks share one pending bundle, never the full catalog', async () => {
    let resolve!: (bundle: ApiQuestBundle) => void
    fetchQuestByQuestId.mockReturnValue(new Promise<ApiQuestBundle>((done) => { resolve = done }))
    const { result } = renderHook(() => useDetail(), { wrapper })
    await waitFor(() => expect(fetchQuestByQuestId).toHaveBeenCalledTimes(1))
    expect(result.current.loading).toBe(true)
    expect(result.current.rating).toEqual({ ratingAvg: null, ratingCount: 0 })
    expect(result.current.completion).toEqual({ isCompletedByMe: false, completionsCount: 0 })
    expect(result.current.pioneer).toBeNull()
    expect(fetchQuestsByCity).not.toHaveBeenCalled()
    expect(fetchQuestsList).not.toHaveBeenCalled()
    await act(async () => resolve(base))
    await waitFor(() => expect(result.current.bundle?.tags).toEqual(['loop']))
    expect(result.current.rating).toEqual({ ratingAvg: 4.5, ratingCount: 8 })
    expect(result.current.completion.completionsCount).toBe(12)
    expect(result.current.pioneer).toEqual(base.first_completer)
    expect(fetchQuestsByCity).toHaveBeenCalledWith(11)
    expect(fetchQuestsList).not.toHaveBeenCalled()
    expect(client.getQueryState(queryKeys.quests())).toBeUndefined()
  })

  it('preserves classification loading and uses addressed cover fallback for legacy bundles', async () => {
    fetchQuestByQuestId.mockResolvedValue({ ...base, cover_url: null })
    let resolve!: (value: unknown[]) => void
    fetchQuestsByCity.mockReturnValue(new Promise<unknown[]>((done) => { resolve = done }))
    const { result } = renderHook(() => useDetail(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.bundle?.tags).toBeUndefined()
    await act(async () => resolve([{ id: 7, quest_id: 'quest-a', tags: {}, cover_url: base.cover_url }]))
    await waitFor(() => expect(result.current.bundle?.coverUrl).toBe(base.cover_url))
    expect(result.current.bundle?.tags).toEqual([])
    expect(fetchQuestsList).not.toHaveBeenCalled()
  })

  it('bundle-supplied tags avoid even the city lookup and opened cached bundles persist offline', async () => {
    client.setQueryData(queryKeys.questBundle('quest-a'), { ...base, tags: { bike: true } })
    const { result } = renderHook(() => useDetail(), { wrapper })
    expect(result.current.bundle?.tags).toEqual(['bike'])
    expect(fetchQuestByQuestId).not.toHaveBeenCalled()
    expect(fetchQuestsByCity).not.toHaveBeenCalled()
    expect(writeCachedQuestBundle).toHaveBeenCalledWith('quest-a', expect.objectContaining({ quest_id: 'quest-a' }))
  })

  it('offline transport still runs its durable fallback; missing city cache releases the map', async () => {
    onlineManager.setOnline(false)
    fetchQuestsByCity.mockRejectedValue(new Error('offline'))
    const { result } = renderHook(() => useDetail(), { wrapper })
    await waitFor(() => expect(result.current.bundle?.tags).toEqual([]))
    expect(result.current.rating.ratingCount).toBe(8)
    expect(fetchQuestsList).not.toHaveBeenCalled()
  })

  it('bundle error retains the route error and never fans out into either catalog', async () => {
    fetchQuestByQuestId.mockRejectedValue(new Error('Not found'))
    const { result } = renderHook(() => useDetail(), { wrapper })
    await waitFor(() => expect(result.current.error).toBe('Not found'))
    expect(result.current.bundle).toBeNull()
    expect(result.current.rating.ratingCount).toBe(0)
    expect(fetchQuestsByCity).not.toHaveBeenCalled()
    expect(fetchQuestsList).not.toHaveBeenCalled()
  })

  it('identity changes scrub immediately and wait for logout credentials before reloading metadata', async () => {
    fetchQuestByQuestId.mockResolvedValue({ ...base, is_completed_by_me: true, user_rating: 5 })
    const { result } = renderHook(() => useDetail(), { wrapper })
    await waitFor(() => expect(result.current.completion.isCompletedByMe).toBe(true))
    let release!: () => void
    const credentials = new Promise<void>((resolve) => { release = resolve })
    fetchQuestByQuestId.mockResolvedValue(base)
    let refresh!: Promise<void>
    let drop!: Promise<void>
    act(() => {
      refresh = refreshQuestsCatalogIdentity(client, () => true, credentials)
      drop = dropQueryCacheForIdentityChange(client, () => true, credentials)
    })
    await waitFor(() => expect(result.current.completion.isCompletedByMe).toBe(false))
    expect(result.current.bundle?.title).toBe('Quest A')
    expect(client.getQueryData(queryKeys.questBundle('quest-a'))).not.toHaveProperty('user_rating')
    expect(fetchQuestByQuestId).toHaveBeenCalledTimes(1)
    await act(async () => { release(); await Promise.all([refresh, drop]) })
    expect(fetchQuestByQuestId).toHaveBeenCalledTimes(2)
    expect(fetchQuestsList).not.toHaveBeenCalled()
  })

  it('late guest bundle cannot overwrite the signed-in completion after identity refresh', async () => {
    let resolveGuest!: (bundle: ApiQuestBundle) => void
    fetchQuestByQuestId.mockImplementationOnce(() => new Promise<ApiQuestBundle>((resolve) => { resolveGuest = resolve }))
      .mockResolvedValueOnce({ ...base, is_completed_by_me: true })
    const { result } = renderHook(() => useDetail(), { wrapper })
    await waitFor(() => expect(fetchQuestByQuestId).toHaveBeenCalledTimes(1))
    await act(async () => refreshQuestsCatalogIdentity(client, () => true))
    await act(async () => resolveGuest(base))
    await waitFor(() => expect(result.current.completion.isCompletedByMe).toBe(true))
    expect(fetchQuestByQuestId).toHaveBeenCalledTimes(2)
  })

  it('completion ACK refreshes the opened bundle, deduplicates repeat saves and supports restart', async () => {
    const { result } = renderHook(() => useDetail(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    fetchQuestByQuestId.mockResolvedValue({ ...base, completions_count: 13, is_completed_by_me: true,
      first_completer: { id: 99, name: 'New pioneer', avatar: null } })
    await act(async () => refreshQuestsCatalogCompletion(client, 'quest-a'))
    await waitFor(() => expect(result.current.completion.completionsCount).toBe(13))
    expect(result.current.completion.isCompletedByMe).toBe(true)
    expect(result.current.pioneer?.id).toBe(99)
    await act(async () => refreshQuestsCatalogCompletion(client, 'quest-a'))
    expect(fetchQuestByQuestId).toHaveBeenCalledTimes(2)
    act(() => resetQuestsCatalogCompletion(client, 'quest-a'))
    await waitFor(() => expect(result.current.completion.isCompletedByMe).toBe(false))
    await act(async () => refreshQuestsCatalogCompletion(client, 'quest-a'))
    expect(fetchQuestByQuestId).toHaveBeenCalledTimes(3)
    expect(fetchQuestsList).not.toHaveBeenCalled()
  })

  // #2033: очередь выбрасывает копию сброшенного прохождения и снимает отметку
  // «Пройден» — в том числе на старте приложения, когда бандл квеста ещё грузится.
  // Отмена первой загрузки откатывает запрос в pending без повтора: экран висел бы.
  it('completion reset without a cached mark leaves the cold bundle load alone', async () => {
    let resolve!: (bundle: ApiQuestBundle) => void
    fetchQuestByQuestId.mockReturnValue(new Promise<ApiQuestBundle>((done) => { resolve = done }))
    const { result } = renderHook(() => useDetail(), { wrapper })
    await waitFor(() => expect(fetchQuestByQuestId).toHaveBeenCalledTimes(1))

    act(() => resetQuestsCatalogCompletion(client, 'quest-a'))
    await act(async () => resolve(base))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.bundle?.title).toBe('Quest A')
    expect(fetchQuestByQuestId).toHaveBeenCalledTimes(1)
  })

  it('saving a review refreshes real rating hooks through the bundle key', async () => {
    submitQuestReview.mockResolvedValue({ id: 1, rating: 5, liked: '', disliked: '' })
    const { result } = renderHook(() => ({ detail: useDetail(), review: useQuestReview({ questId: 7, questSlug: 'quest-a' }) }), { wrapper })
    await waitFor(() => expect(result.current.detail.rating.ratingCount).toBe(8))
    await waitFor(() => expect(result.current.review.isLoading).toBe(false))
    fetchQuestByQuestId.mockResolvedValue({ ...base, rating_count: 9, rating_avg: 4.6 })
    act(() => result.current.review.submit({ rating: 5, liked: '', disliked: '' }))
    await waitFor(() => expect(result.current.detail.rating).toEqual({ ratingAvg: 4.6, ratingCount: 9 }))
    expect(fetchQuestByQuestId).toHaveBeenCalledTimes(2)
    expect(fetchQuestsList).not.toHaveBeenCalled()
  })
})
