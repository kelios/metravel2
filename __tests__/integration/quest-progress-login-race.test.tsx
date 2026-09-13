/**
 * #1905: после логина миграция гостевого прогресса (`useGuestQuestFlow`) и флаш
 * отложенной очереди (`useQuestProgressSync`) стартуют одним и тем же переходом
 * в авторизованное состояние и пишут ОДНО прохождение.
 *
 * Прод 13.09.2026 (user 186, quest «Анталья: Калеичи»): оба увидели 404, оба
 * пошли в POST — победитель получил 201, проигравший 500 на unique_together.
 * Одной дедупликации POST мало: `answers` уходит на сервер полным словарём и
 * серверный заменяет, поэтому два писателя от общей базы затирают ответы друг
 * друга. Здесь оба потока настоящие, а `@/api/client` — маленький сервер с тем
 * же поведением: дубль POST → 500, PATCH заменяет `answers` целиком.
 */
import { act, renderHook, waitFor } from '@testing-library/react-native'

import { apiClient, ApiError } from '@/api/client'
import { useGuestQuestFlow } from '@/components/quests/useGuestQuestFlow'
import { useQuestProgressSync } from '@/hooks/useQuestsApi'
import { loadGuestQuestProgress, saveGuestQuestProgress } from '@/utils/guestQuestProgress'

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}))

jest.mock('@/hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => ({ isConnected: true, isInternetReachable: true, type: 'wifi' }),
}))

jest.mock('@/api/client', () => {
  class MockApiError extends Error {
    status: number
    constructor(status: number, message: string) {
      super(message)
      this.status = status
    }
  }
  return {
    ApiError: MockApiError,
    apiClient: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
  }
})

const mockedGet = apiClient.get as jest.MockedFunction<typeof apiClient.get>
const mockedPost = apiClient.post as jest.MockedFunction<typeof apiClient.post>
const mockedPatch = apiClient.patch as jest.MockedFunction<typeof apiClient.patch>

const QUEST_ID = 'antalya-kaleici'
const CITY_ID = 'antalya'
const PROGRESS_URL = `/quest-progress/quest/${QUEST_ID}/`
const QUEST_URL = `/quests/by-quest-id/${QUEST_ID}/`

// Ответы гостя (до логина) и отложенный ответ, сделанный уже в аккаунте.
const GUEST_ANSWERS = { 'step-1': 'калеичи', 'step-2': 'ворота адриана' }
const PENDING_ANSWER = { 'step-3': 'часовая башня' }

describe('#1905 два писателя прохождения после логина', () => {
  /** Состояние «сервера»: строка прохождения или её отсутствие. */
  let row: Record<string, any> | null = null
  let progressReads = 0
  let openGate: () => void = () => {}

  beforeEach(async () => {
    jest.clearAllMocks()
    row = null
    progressReads = 0

    // Оба чтения прохождения держим не отвеченными, пока их не сделали ОБА
    // потока: перекрытие по времени и есть воспроизводимая гонка.
    const gate = new Promise<void>((resolve) => {
      openGate = resolve
    })

    mockedGet.mockImplementation((async (url: string) => {
      if (url === PROGRESS_URL) {
        progressReads += 1
        if (progressReads <= 2) await gate
        if (row) return row
        throw new ApiError(404, 'Not found')
      }
      if (url === QUEST_URL) return { id: 46 }
      throw new Error(`unexpected GET ${url}`)
    }) as never)

    mockedPost.mockImplementation((async (_url: string, body: { quest: number }) => {
      // Бэкенд: unique_together (quest, user) — дубль прилетает 500 (#1904).
      if (row) throw new ApiError(500, 'duplicate key value violates unique constraint')
      row = {
        id: 461,
        quest: body.quest,
        user: 186,
        current_index: 0,
        unlocked_index: 0,
        answers: {},
        attempts: {},
        hints: {},
        show_map: true,
        completed: false,
        completed_at: null,
        created_at: '2026-09-13T01:08:18Z',
        updated_at: '2026-09-13T01:08:18Z',
      }
      return row
    }) as never)

    mockedPatch.mockImplementation((async (_url: string, body: Record<string, unknown>) => {
      // Бэкенд кладёт JSON-поля целиком, а не сливает их.
      row = { ...row, ...body, updated_at: new Date(Date.now()).toISOString() }
      return row
    }) as never)

    await saveGuestQuestProgress(QUEST_ID, {
      currentIndex: 2,
      unlockedIndex: 2,
      answers: GUEST_ANSWERS,
      attempts: { 'step-1': 1 },
      hints: {},
      showMap: true,
    })
  })

  it('создаёт прохождение один раз и сохраняет ответы обоих потоков', async () => {
    // Поток 1 — авторизованная синхронизация с отложенным ответом.
    const sync = renderHook(() => useQuestProgressSync(QUEST_ID, true))
    act(() => {
      sync.result.current.saveProgress({
        currentIndex: 3,
        unlockedIndex: 3,
        answers: PENDING_ANSWER,
        attempts: {},
        hints: {},
        showMap: true,
        updatedAt: Date.now(),
        answeredAt: { 'step-3': Date.now() },
      })
    })

    // Поток 2 — миграция гостевого прогресса тем же логином.
    renderHook(() =>
      useGuestQuestFlow({ questId: QUEST_ID, cityId: CITY_ID, isAuthenticated: true, enabled: true }),
    )

    await waitFor(() => {
      expect(progressReads).toBe(2)
    })
    await act(async () => {
      openGate()
    })

    // Оба писателя дошли до сервера: гостевые ответы и отложенный — в одной записи.
    await waitFor(() => {
      expect(row?.answers).toEqual({ ...GUEST_ANSWERS, ...PENDING_ANSWER })
    })

    // Ровно одно создание строки — второй POST на проде отвечал 500.
    expect(mockedPost).toHaveBeenCalledTimes(1)
    expect(mockedPost).toHaveBeenCalledWith('/quest-progress/', { quest: 46 })
    expect(mockedPatch).toHaveBeenCalledWith('/quest-progress/461/', expect.any(Object))

    // Локальная копия гостя убрана только после успешного слияния (#1803).
    await waitFor(async () => {
      expect(await loadGuestQuestProgress(QUEST_ID)).toBeNull()
    })
  })
})
