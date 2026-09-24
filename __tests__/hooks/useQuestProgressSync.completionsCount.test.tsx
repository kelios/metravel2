/**
 * #2092: после «Сбросить» число прохождений в шапке квеста оставалось прежним,
 * хотя API уже отдавал `completions_count: 0`. Счётчик читается из бандла
 * (`useQuestCompletionMeta` → `useQuestBundleQuery`), а подтверждённое удаление
 * строки прохождения этот кэш не трогало до его staleTime. То же число лежит в
 * каталоге: снятая отметка при прежнем числе записывала квест в «Пройденные другими».
 */
import React, { type ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'

import { setActiveQueryClient } from '@/api/activeQueryClient'
import { queryKeys } from '@/api/queryKeys'
import type { ApiQuestBundle, ApiQuestMeta, ApiQuestProgress } from '@/api/quests'
import { useQuestCompletionMeta } from '@/hooks/useQuestCompletionMeta'
import { useQuestProgressSync } from '@/hooks/useQuestsApi'
import { __resetQuestProgressQueue } from '@/utils/questProgressQueue'

jest.mock('@/stores/authStore', () => ({
  useAuthStore: { getState: () => ({ userId: 'A', isAuthenticated: true }) },
}))
jest.mock('@/hooks/useNetworkStatus', () => ({ useNetworkStatus: () => ({ isConnected: true }) }))
jest.mock('@/api/quests', () => ({
  fetchQuestByQuestId: jest.fn(),
  fetchQuestProgress: jest.fn(),
  withQuestProgress: jest.fn(),
  updateProgress: jest.fn(),
  deleteProgress: jest.fn(),
}))

const { fetchQuestByQuestId, fetchQuestProgress, deleteProgress } = jest.requireMock('@/api/quests') as {
  fetchQuestByQuestId: jest.Mock
  fetchQuestProgress: jest.Mock
  deleteProgress: jest.Mock
}

const QUEST_ID = 'brest-teens-erased-city'
const COMPLETED_ROW = {
  id: 42, quest: 7, user: 10, current_index: 7, unlocked_index: 7,
  answers: { 'step-1': 'крепость' }, attempts: {}, hints: {}, skipped: {},
  show_map: true, early_finish: false, completed: true,
  completed_at: '2026-09-24T09:00:00Z', created_at: '2026-09-24T08:00:00Z', updated_at: '2026-09-24T09:00:00Z',
} as ApiQuestProgress
const COMPLETED_BUNDLE = {
  id: 7, quest_id: QUEST_ID, title: 'Стертый Брест', steps: [], intro: null,
  completions_count: 1, is_completed_by_me: true,
} as unknown as ApiQuestBundle
const CATALOG_QUEST = {
  id: 7, quest_id: QUEST_ID, title: 'Стертый Брест', completions_count: 1, is_completed_by_me: true,
} as unknown as ApiQuestMeta
/** Каталог, который сейчас отдаёт сервер. */
let serverCatalog: ApiQuestMeta[] = []
const fetchCatalog = jest.fn(async () => serverCatalog)

describe('«Сбросить» обновляет число прохождений в шапке (#2092)', () => {
  let client: QueryClient
  /** Бандл, который сейчас отдаёт сервер. */
  let serverBundle: ApiQuestBundle
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  const renderQuestHeader = () => renderHook(() => ({
    sync: useQuestProgressSync(QUEST_ID, true),
    completion: useQuestCompletionMeta(QUEST_ID, 7),
    // Каталог под экраном квеста: по нему считается «Пройденные другими».
    catalog: useQuery({ queryKey: queryKeys.quests(), queryFn: fetchCatalog }).data,
  }), { wrapper })

  beforeEach(() => {
    jest.clearAllMocks()
    __resetQuestProgressQueue()
    client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
    setActiveQueryClient(client)
    serverBundle = COMPLETED_BUNDLE
    serverCatalog = [CATALOG_QUEST]
    fetchQuestByQuestId.mockImplementation(async () => serverBundle)
    fetchQuestProgress.mockResolvedValue(COMPLETED_ROW)
  })

  afterEach(() => {
    __resetQuestProgressQueue()
    setActiveQueryClient(null)
    client.clear()
  })

  it('подтверждённое удаление перечитывает completions_count без перезагрузки экрана', async () => {
    const { result } = renderQuestHeader()
    await waitFor(() => expect(result.current.completion.completionsCount).toBe(1))
    await waitFor(() => expect(result.current.sync.progress?.id).toBe(42))
    await waitFor(() => expect(result.current.catalog).toEqual([CATALOG_QUEST]))
    deleteProgress.mockImplementation(async () => {
      serverBundle = { ...COMPLETED_BUNDLE, completions_count: 0, is_completed_by_me: false }
      serverCatalog = [{ ...CATALOG_QUEST, completions_count: 0, is_completed_by_me: false }]
    })

    let deletionPending: boolean | undefined
    await act(async () => {
      deletionPending = await result.current.sync.resetProgress()
    })

    expect(deletionPending).toBe(false)
    expect(deleteProgress).toHaveBeenCalledWith(42)
    await waitFor(() => expect(result.current.completion.completionsCount).toBe(0))
    expect(result.current.completion.isCompletedByMe).toBe(false)
    expect(fetchQuestByQuestId).toHaveBeenCalledTimes(2)
    // Снятая отметка при прежнем числе записала бы квест в «Пройденные другими».
    await waitFor(() => expect(result.current.catalog?.[0]?.completions_count).toBe(0))
    expect(result.current.catalog?.[0]?.is_completed_by_me).toBe(false)
    expect(fetchCatalog).toHaveBeenCalledTimes(2)
  })

  it('удаление, которого сервер не подтвердил, счётчик не перечитывает', async () => {
    const { result } = renderQuestHeader()
    await waitFor(() => expect(result.current.completion.completionsCount).toBe(1))
    await waitFor(() => expect(result.current.sync.progress?.id).toBe(42))
    await waitFor(() => expect(result.current.catalog).toEqual([CATALOG_QUEST]))
    deleteProgress.mockRejectedValue(new Error('Network request failed'))

    let deletionPending: boolean | undefined
    await act(async () => {
      deletionPending = await result.current.sync.resetProgress()
    })

    // Сервер прохождение ещё считает: число в шапке остаётся его числом.
    expect(deletionPending).toBe(true)
    expect(result.current.completion.completionsCount).toBe(1)
    expect(fetchQuestByQuestId).toHaveBeenCalledTimes(1)
    expect(result.current.catalog?.[0]?.completions_count).toBe(1)
    expect(fetchCatalog).toHaveBeenCalledTimes(1)
  })
})
