/**
 * #2096: «Мои квесты» в профиле читает `questProgressAll` и `questsCompactCatalog`
 * со staleTime 30 минут. Хук живёт, пока открыта вкладка «Уровень»: экран профиля
 * таб-навигатор не размонтирует, а обзор рисуется только при `activeTab === 'overview'`.
 * Точная инвалидация `['quests']` эти ключи не задевает, поэтому «Пройден» держался
 * до получаса и после «Сбросить», и после финиша.
 *
 * Здесь хук не перемонтируется: подтверждённая запись сама обновляет оба списка.
 */
import { useEffect, useRef, type ReactNode } from 'react'
import { act, renderHook } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { setActiveQueryClient } from '@/api/activeQueryClient'
import type { ApiQuestMeta, ApiQuestProgress } from '@/api/quests'
import { useQuestCityCollections } from '@/hooks/useQuestCityCollection'
import { useQuestProgressSync } from '@/hooks/useQuestsApi'
import { resetAuthStoreForTests, useAuthStore } from '@/stores/authStore'
import { __resetQuestProgressQueue } from '@/utils/questProgressQueue'

jest.mock('@/hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => ({ isConnected: true, isInternetReachable: true, type: 'wifi' }),
}))

const mockFetchQuestProgress = jest.fn()
const mockUpdateProgress = jest.fn()
const mockDeleteProgress = jest.fn()
const mockFetchAllProgress = jest.fn()
const mockFetchCompactCatalog = jest.fn()
const mockReadOrCreateProgress = jest.fn()

jest.mock('@/api/quests', () => ({
  fetchQuestProgress: (...args: unknown[]) => mockFetchQuestProgress(...args),
  fetchAllProgress: (...args: unknown[]) => mockFetchAllProgress(...args),
  fetchQuestsCompactCatalog: (...args: unknown[]) => mockFetchCompactCatalog(...args),
  withQuestProgress: (questId: string, task: (progress: ApiQuestProgress) => Promise<unknown>) =>
    Promise.resolve(mockReadOrCreateProgress(questId)).then((progress) => task(progress)),
  updateProgress: (...args: unknown[]) => mockUpdateProgress(...args),
  deleteProgress: (...args: unknown[]) => mockDeleteProgress(...args),
  fetchQuestsByCity: jest.fn(),
  fetchQuestsPreview: jest.fn(),
  fetchQuestReviews: jest.fn(),
}))

const USER_ID = 'A'
const QUEST_ID = 'minsk-dvoriki'
const QUEST_NUMERIC_ID = 7

const progressRow = (over: Partial<ApiQuestProgress> & Pick<ApiQuestProgress, 'id' | 'quest'>): ApiQuestProgress => ({
  user: 1,
  current_index: 4,
  unlocked_index: 4,
  answers: { 'step-1': 'ратуша' },
  attempts: {},
  hints: {},
  skipped: {},
  show_map: true,
  early_finish: false,
  completed: true,
  completed_at: '2026-09-25T09:00:00Z',
  created_at: '2026-09-25T08:00:00Z',
  updated_at: '2026-09-25T09:00:00Z',
  ...over,
})

const catalogQuest = (completed: boolean): ApiQuestMeta => ({
  id: QUEST_NUMERIC_ID,
  quest_id: QUEST_ID,
  title: 'Дворики',
  points: 8,
  city_id: '4',
  city_name: 'Минск',
  lat: 53.9,
  lng: 27.56,
  duration_min: 60,
  difficulty: 'easy',
  tags: null,
  pet_friendly: false,
  cover_url: null,
  rating_avg: null,
  rating_count: 0,
  user_rating: null,
  completions_count: completed ? 1 : 0,
  is_completed_by_me: completed,
  first_completer: null,
})

/** Чужое прохождение держит компактный каталог включённым и уже свежим. */
const OTHER_COMPLETED = progressRow({ id: 1, quest: 99, answers: {} })
const OWN_COMPLETED = progressRow({ id: 42, quest: QUEST_NUMERIC_ID })

let progressRows: ApiQuestProgress[] = []
let catalog: ApiQuestMeta[] = []

const tick = async (ms = 0) => {
  await act(async () => {
    if (ms > 0) jest.advanceTimersByTime(ms)
    for (let i = 0; i < 20; i++) await Promise.resolve()
  })
}

const until = async (assert: () => void) => {
  let lastError: unknown
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      assert()
      return
    } catch (error) {
      lastError = error
    }
    await tick(1)
  }
  throw lastError
}

describe('профиль «Мои квесты» обновляется от записи прохождения (#2096)', () => {
  let client: QueryClient

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )

  const mount = () => renderHook(() => {
    const mounts = useRef(0)
    useEffect(() => {
      mounts.current += 1
    }, [])
    return {
      mounts,
      profile: useQuestCityCollections(),
      sync: useQuestProgressSync(QUEST_ID, true),
    }
  }, { wrapper })

  beforeEach(() => {
    jest.useFakeTimers()
    setActiveQueryClient(null)
    resetAuthStoreForTests()
    useAuthStore.setState({ isAuthenticated: true, userId: USER_ID, authReady: true })
    __resetQuestProgressQueue()
    jest.clearAllMocks()
    progressRows = []
    catalog = []
    mockFetchAllProgress.mockImplementation(async () => progressRows.map((row) => ({ ...row })))
    mockFetchCompactCatalog.mockImplementation(async () => catalog.map((quest) => ({ ...quest })))
    mockFetchQuestProgress.mockResolvedValue(null)
    mockReadOrCreateProgress.mockResolvedValue(progressRow({
      id: 50,
      quest: QUEST_NUMERIC_ID,
      completed: false,
      completed_at: null,
      answers: {},
      current_index: 0,
      unlocked_index: 0,
    }))
    mockUpdateProgress.mockImplementation(async (id: number, payload: { completed?: boolean }) => {
      const updated = progressRow({
        id,
        quest: QUEST_NUMERIC_ID,
        completed: payload.completed === true,
        completed_at: payload.completed ? '2026-09-25T10:00:00Z' : null,
      })
      if (updated.completed) {
        progressRows = [...progressRows.filter((row) => row.quest !== QUEST_NUMERIC_ID), updated]
        catalog = catalog.map((quest) => (
          quest.quest_id === QUEST_ID ? catalogQuest(true) : quest
        ))
      }
      return updated
    })
    mockDeleteProgress.mockImplementation(async (id: number) => {
      progressRows = progressRows.filter((row) => row.id !== id)
      catalog = catalog.map((quest) => (
        quest.quest_id === QUEST_ID ? catalogQuest(false) : quest
      ))
    })
    client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
    setActiveQueryClient(client)
  })

  afterEach(() => {
    setActiveQueryClient(null)
    resetAuthStoreForTests()
    __resetQuestProgressQueue()
    client.clear()
    jest.clearAllTimers()
    jest.useRealTimers()
  })

  it('после «Сбросить» квест пропадает из пройденных и коллекций без перемонтирования', async () => {
    progressRows = [OWN_COMPLETED, OTHER_COMPLETED]
    catalog = [catalogQuest(true)]
    mockFetchQuestProgress.mockResolvedValue(OWN_COMPLETED)
    const { result } = mount()

    await until(() => {
      expect(result.current.sync.progress?.id).toBe(42)
      expect(result.current.profile.loading).toBe(false)
      expect(result.current.profile.completedQuests.map((quest) => quest.id)).toEqual([QUEST_ID])
      expect(result.current.profile.collections.map((collection) => collection.completedCount)).toEqual([1])
    })
    expect(mockFetchAllProgress).toHaveBeenCalledTimes(1)
    expect(mockFetchCompactCatalog).toHaveBeenCalledTimes(1)

    await act(async () => {
      expect(await result.current.sync.resetProgress()).toBe(false)
    })
    await until(() => {
      expect(result.current.profile.completedQuests).toEqual([])
      expect(result.current.profile.collections).toEqual([])
    })

    expect(result.current.mounts.current).toBe(1)
    expect(mockDeleteProgress).toHaveBeenCalledWith(42)
    expect(mockFetchAllProgress).toHaveBeenCalledTimes(2)
    expect(mockFetchCompactCatalog).toHaveBeenCalledTimes(2)
  })

  it('после успешного прохождения квест появляется в пройденных и коллекциях без перемонтирования', async () => {
    progressRows = [OTHER_COMPLETED]
    catalog = [catalogQuest(false)]
    const { result } = mount()

    await until(() => {
      expect(result.current.profile.loading).toBe(false)
      expect(mockFetchCompactCatalog).toHaveBeenCalledTimes(1)
      expect(result.current.profile.completedQuests).toEqual([])
      expect(result.current.profile.collections).toEqual([])
    })

    act(() => {
      result.current.sync.saveProgress({
        currentIndex: 4,
        unlockedIndex: 4,
        answers: { 'step-1': 'ратуша' },
        attempts: {},
        hints: {},
        showMap: false,
        completed: true,
      })
    })
    await tick(2000)
    await until(() => {
      expect(result.current.profile.completedQuests.map((quest) => quest.id)).toEqual([QUEST_ID])
      expect(result.current.profile.collections.map((collection) => [collection.cityId, collection.completedCount])).toEqual([
        ['4', 1],
      ])
    })

    expect(result.current.mounts.current).toBe(1)
    expect(mockUpdateProgress).toHaveBeenCalledTimes(1)
    expect(mockFetchAllProgress).toHaveBeenCalledTimes(2)
    expect(mockFetchCompactCatalog).toHaveBeenCalledTimes(2)
  })
})
