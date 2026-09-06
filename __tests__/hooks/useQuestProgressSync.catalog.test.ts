import { act, renderHook } from '@testing-library/react-native'
import { QueryClient, QueryObserver } from '@tanstack/react-query'
import { setActiveQueryClient } from '@/api/activeQueryClient'
import { queryKeys } from '@/api/queryKeys'
import type { ApiQuestMeta, ApiQuestProgress } from '@/api/quests'
import { QUESTS_LIST_STALE_TIME } from '@/hooks/questsListCachePolicy'

let mockOwnerId: string | null = 'A'
jest.mock('@/stores/authStore', () => ({
  useAuthStore: { getState: () => ({ userId: mockOwnerId, isAuthenticated: mockOwnerId !== null }) },
}))
jest.mock('@/hooks/useNetworkStatus', () => ({ useNetworkStatus: () => ({ isConnected: true }) }))
jest.mock('@/api/quests', () => ({
  fetchQuestProgress: jest.fn(), fetchOrCreateProgress: jest.fn(), updateProgress: jest.fn(),
  deleteProgress: jest.fn().mockResolvedValue(undefined),
}))

const { fetchQuestProgress, fetchOrCreateProgress, updateProgress } = require('@/api/quests') as {
  fetchQuestProgress: jest.Mock; fetchOrCreateProgress: jest.Mock; updateProgress: jest.Mock
}
const { useQuestProgressSync } = require('@/hooks/useQuestsApi') as typeof import('@/hooks/useQuestsApi')
const progress = { id: 42, quest: 1, user: 10, answers: {}, attempts: {}, hints: {}, skipped: {}, completed: false } as ApiQuestProgress
const catalog = (completed: boolean) => [{ quest_id: 'q', is_completed_by_me: completed }] as ApiQuestMeta[]
const pending = { currentIndex: 1, unlockedIndex: 1, answers: { one: 'answer' }, attempts: {}, hints: {}, showMap: false, completed: true }
const flush = async () => { await act(async () => { for (let i = 0; i < 15; i++) await Promise.resolve() }) }

describe('quest completion catalog refresh after server acknowledgement', () => {
  let client: QueryClient
  let fetchCatalog: jest.Mock
  let unsubscribe: () => void
  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    mockOwnerId = 'A'
    fetchQuestProgress.mockResolvedValue(progress)
    fetchOrCreateProgress.mockResolvedValue(progress)
    updateProgress.mockResolvedValue({ ...progress, completed: true })
    client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
    setActiveQueryClient(client)
    client.setQueryData(queryKeys.quests(), catalog(false))
    client.setQueryData(queryKeys.userPointsAll(), ['point'])
    fetchCatalog = jest.fn().mockResolvedValue(catalog(true))
    const observer = new QueryObserver(client, { queryKey: queryKeys.quests(), queryFn: fetchCatalog, staleTime: QUESTS_LIST_STALE_TIME })
    unsubscribe = observer.subscribe(() => undefined)
  })
  afterEach(() => {
    unsubscribe()
    setActiveQueryClient(null)
    client.clear()
    jest.clearAllTimers()
    jest.useRealTimers()
  })
  const mount = async () => {
    const rendered = renderHook(() => useQuestProgressSync('q', true))
    await flush()
    return rendered
  }
  const save = async (result: { current: ReturnType<typeof useQuestProgressSync> }, completed = true) => {
    act(() => result.current.saveProgress({ ...pending, completed }))
    act(() => jest.advanceTimersByTime(2000))
    await flush()
  }

  it('does not refresh while PATCH is pending; refreshes once after ACK and deduplicates repeat saves', async () => {
    const { result, unmount } = await mount()
    let acknowledge!: (value: ApiQuestProgress) => void
    updateProgress.mockImplementationOnce(() => new Promise<ApiQuestProgress>((resolve) => { acknowledge = resolve }))
    await save(result)
    expect(fetchCatalog).not.toHaveBeenCalled()
    acknowledge({ ...progress, completed: true })
    await flush()
    expect(fetchCatalog).toHaveBeenCalledTimes(1)
    await save(result)
    expect(fetchCatalog).toHaveBeenCalledTimes(1)
    expect(client.getQueryState(queryKeys.userPointsAll())?.isInvalidated).toBe(false)
    unmount()
  })

  it('failed PATCH and partial progress do not refresh', async () => {
    const { result, unmount } = await mount()
    updateProgress.mockRejectedValueOnce(new Error('offline'))
    await save(result)
    expect(fetchCatalog).not.toHaveBeenCalled()
    updateProgress.mockResolvedValue({ ...progress, completed: false })
    await save(result, false)
    expect(fetchCatalog).not.toHaveBeenCalled()
    unmount()
  })

  it('unmount flush and in-flight completion acknowledgements share one refresh', async () => {
    const { result, unmount } = await mount()
    const acknowledgements: Array<(value: ApiQuestProgress) => void> = []
    updateProgress.mockImplementation(() => new Promise<ApiQuestProgress>((resolve) => { acknowledgements.push(resolve) }))
    await save(result)
    unmount()
    await flush()
    expect(acknowledgements).toHaveLength(2)
    acknowledgements.forEach((resolve) => resolve({ ...progress, completed: true }))
    await flush()
    expect(fetchCatalog).toHaveBeenCalledTimes(1)
  })

  it('late acknowledgement for account A does not affect B catalog', async () => {
    const { result, unmount } = await mount()
    let acknowledge!: (value: ApiQuestProgress) => void
    updateProgress.mockImplementationOnce(() => new Promise<ApiQuestProgress>((resolve) => { acknowledge = resolve }))
    await save(result)
    mockOwnerId = 'B'
    acknowledge({ ...progress, completed: true })
    await flush()
    expect(fetchCatalog).not.toHaveBeenCalled()
    expect(client.getQueryData(queryKeys.quests())).toEqual(catalog(false))
    unmount()
  })

  it('reset then replay can refresh the completion again', async () => {
    const { result, unmount } = await mount()
    await save(result)
    expect(fetchCatalog).toHaveBeenCalledTimes(1)
    await act(async () => result.current.resetProgress())
    expect(client.getQueryData(queryKeys.quests())).toEqual(catalog(false))
    await save(result)
    expect(fetchCatalog).toHaveBeenCalledTimes(2)
    unmount()
  })

  it('inactive catalog is marked stale without a network fetch', async () => {
    unsubscribe()
    const { result, unmount } = await mount()
    await save(result)
    expect(fetchCatalog).not.toHaveBeenCalled()
    expect(client.getQueryState(queryKeys.quests())?.isInvalidated).toBe(true)
    expect(client.getQueryData(queryKeys.quests())).toEqual(catalog(true))
    unmount()
  })
})
