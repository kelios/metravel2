/**
 * #2092: перенос гостевого прогресса подтвердился уже после того, как открытый
 * экран квеста прочитал прохождение. До фикса экран держал «Задания: 0 / N» и
 * показывал перенесённое только после выхода и повторного открытия квеста.
 *
 * Хуки собраны так же, как на экране `app/(tabs)/quests/[city]/[questId].tsx`:
 * синхронизация, гостевой поток и визард от одного `initialProgress`. Сервер —
 * на уровне `@/api/quests`; писатель ждёт, пока экран дочитает прохождение.
 */
import { useMemo } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { act, renderHook, waitFor } from '@testing-library/react-native'

import { useGuestQuestFlow } from '@/components/quests/useGuestQuestFlow'
import { useQuestWizardProgress } from '@/components/quests/useQuestWizardProgress'
import { useQuestProgressSync } from '@/hooks/useQuestsApi'
import { useAuthStore } from '@/stores/authStore'
import { loadGuestQuestProgress, saveGuestQuestProgress } from '@/utils/guestQuestProgress'
import { normalizeQuestProgressSnapshot, snapshotFromServerProgress } from '@/utils/questProgressMerge'
import { __resetQuestProgressQueue, beginQuestProgressWrite, syncQuestProgressReaders } from '@/utils/questProgressQueue'

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}))

jest.mock('@/hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => ({ isConnected: true, isInternetReachable: true, type: 'wifi' }),
}))

/** Строка прохождения на сервере; `null` — её ещё нет. */
let mockServerRow: Record<string, any> | null = null
/** Писатель прохождения стоит, пока тест его не отпустит. */
let mockWriterGate: Promise<void> = Promise.resolve()
/** Миграция дошла до записи строки и ждёт, пока тест отпустит писателя. */
let writerEntered = false
const mockFetchQuestProgress = jest.fn()
const mockUpdateProgress = jest.fn()

jest.mock('@/api/quests', () => ({
  fetchQuestProgress: (...args: any[]) => mockFetchQuestProgress(...args),
  withQuestProgress: async (_questId: string, task: (progress: any) => Promise<unknown>) => {
    writerEntered = true
    await mockWriterGate
    // POST `/quest-progress/` — get_or_create.
    if (!mockServerRow) {
      mockServerRow = {
        id: 461,
        quest: 46,
        user: 169,
        current_index: 0,
        unlocked_index: 0,
        answers: {},
        attempts: {},
        hints: {},
        skipped: {},
        early_finish: false,
        show_map: true,
        completed: false,
        completed_at: null,
        created_at: '2026-09-24T09:00:00Z',
        updated_at: '2026-09-24T09:00:00Z',
      }
    }
    return task(mockServerRow)
  },
  updateProgress: (...args: any[]) => mockUpdateProgress(...args),
  deleteProgress: jest.fn(),
}))

const QUEST_ID = 'brest-teens-erased-city'
const CITY_ID = 'brest'
const GUEST_ANSWERS = { 'step-1': 'крепость', 'step-3': 'вокзал' }
const allSteps = [{ id: 'intro' }, { id: 'step-1' }, { id: 'step-2' }, { id: 'step-3' }, { id: 'step-4' }]
const questSteps = allSteps.slice(1)
const EMPTY_SERVER = normalizeQuestProgressSnapshot(null)
const NO_SERVER_ROW = { ...EMPTY_SERVER, serverId: null }

/** Экран квеста в части прогресса: те же хуки и тот же выбор `initialProgress`. */
function useQuestScreenProgress() {
  const sync = useQuestProgressSync(QUEST_ID, true)
  const guest = useGuestQuestFlow({ questId: QUEST_ID, cityId: CITY_ID, isAuthenticated: true, enabled: true })
  const { progress, progressLoading, progressMissing } = sync
  const initialProgress = useMemo(() => {
    if (progress) return snapshotFromServerProgress(progress)
    if (progressLoading) return undefined
    return progressMissing ? NO_SERVER_ROW : EMPTY_SERVER
  }, [progress, progressLoading, progressMissing])
  const wizard = useQuestWizardProgress({
    allSteps,
    steps: questSteps,
    storageKey: `quest_progress_${QUEST_ID}__u169`,
    initialProgress,
  })
  return { sync, guest, wizard }
}

describe('перенос гостевого прогресса доходит до открытого экрана (#2092)', () => {
  let authSnapshot: ReturnType<typeof useAuthStore.getState>
  let openWriter: () => void

  beforeEach(async () => {
    jest.clearAllMocks()
    await AsyncStorage.clear()
    __resetQuestProgressQueue()
    authSnapshot = useAuthStore.getState()
    useAuthStore.setState({ isAuthenticated: true, userId: '169' })
    mockServerRow = null
    writerEntered = false
    mockWriterGate = new Promise<void>((resolve) => {
      openWriter = resolve
    })
    mockFetchQuestProgress.mockImplementation(async () => mockServerRow)
    mockUpdateProgress.mockImplementation(async (id: number, payload: Record<string, unknown>) => {
      mockServerRow = { ...mockServerRow, ...payload, id, updated_at: '2026-09-24T09:00:05Z' }
      return mockServerRow
    })
    await saveGuestQuestProgress(QUEST_ID, {
      currentIndex: 3,
      unlockedIndex: 3,
      answers: GUEST_ANSWERS,
      attempts: {},
      hints: {},
      showMap: true,
    })
  })

  afterEach(() => {
    useAuthStore.setState({ isAuthenticated: authSnapshot.isAuthenticated, userId: authSnapshot.userId })
  })

  /** Экран смонтирован и дочитал прохождение раньше, чем перенос дошёл до сервера. */
  const mountScreenBeforeMigration = async () => {
    const rendered = renderHook(() => useQuestScreenProgress())
    await waitFor(() => expect(rendered.result.current.sync.progressLoading).toBe(false))
    expect(rendered.result.current.sync.progress).toBeNull()
    expect(rendered.result.current.sync.progressMissing).toBe(true)
    expect(rendered.result.current.wizard.completedSteps).toHaveLength(0)
    return rendered
  }

  it('смигрированные ответы и счётчик «2 / 4» видны без повторного маунта', async () => {
    const { result } = await mountScreenBeforeMigration()

    await act(async () => {
      openWriter()
    })

    await waitFor(() => expect(result.current.wizard.completedSteps).toHaveLength(2))
    expect(result.current.wizard.requiredCount).toBe(4)
    expect(result.current.wizard.answers).toEqual(GUEST_ANSWERS)
    expect(result.current.sync.progress?.answers).toEqual(GUEST_ANSWERS)
    expect(result.current.sync.progressMissing).toBe(false)
    // Экран не перечитывал прохождение: состояние пришло с подтверждённой записью.
    expect(mockFetchQuestProgress).toHaveBeenCalledTimes(1)
    expect(await loadGuestQuestProgress(QUEST_ID)).toBeNull()
  })

  it('несинхронизированный ответ экрана переживает пришедший перенос', async () => {
    const { result } = await mountScreenBeforeMigration()
    act(() => {
      result.current.wizard.setAnswers((answers) => ({ ...answers, 'step-4': 'мост' }))
    })

    await act(async () => {
      openWriter()
    })

    await waitFor(() => expect(result.current.wizard.completedSteps).toHaveLength(3))
    expect(result.current.wizard.answers).toEqual({ ...GUEST_ANSWERS, 'step-4': 'мост' })
  })

  it('перенос в аккаунт, из которого уже вышли, на экран следующего не попадает', async () => {
    const { result } = await mountScreenBeforeMigration()
    useAuthStore.setState({ isAuthenticated: true, userId: '170' })

    await act(async () => {
      openWriter()
    })

    await waitFor(() => expect(mockUpdateProgress).toHaveBeenCalledTimes(1))
    await act(async () => {
      await Promise.resolve()
    })
    expect(result.current.sync.progress).toBeNull()
    expect(result.current.wizard.completedSteps).toHaveLength(0)
  })

  // #2098: «Сбросить» посреди миграции, пока экран ещё не знает id строки.
  // Ответ миграции не должен вернуть перенесённые ответы. Запросы те же:
  // миграция по-прежнему пишет строку, а сброс без id DELETE не добавляет.
  it('«Сбросить» до id строки не возвращает ответы ещё идущей миграции', async () => {
    const { result } = await mountScreenBeforeMigration()
    await waitFor(() => expect(writerEntered).toBe(true))
    expect(result.current.sync.progress).toBeNull()
    expect(mockUpdateProgress).not.toHaveBeenCalled()

    await act(async () => {
      expect(await result.current.sync.resetProgress()).toBe(false)
    })

    await act(async () => {
      openWriter()
    })
    await waitFor(() => expect(mockUpdateProgress).toHaveBeenCalledTimes(1))
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(result.current.sync.progress).toBeNull()
    expect(result.current.sync.progressMissing).toBe(true)
    expect(result.current.wizard.completedSteps).toHaveLength(0)
    expect(result.current.wizard.answers['step-1']).toBeUndefined()
    expect(mockFetchQuestProgress).toHaveBeenCalledTimes(1)
    const { deleteProgress } = jest.requireMock('@/api/quests') as { deleteProgress: jest.Mock }
    expect(deleteProgress).not.toHaveBeenCalled()

    // Запись, начатая уже после сброса, на экран попадает: отсечка не вечная.
    const laterRow = {
      id: 462,
      quest: 46,
      user: 169,
      current_index: 2,
      unlocked_index: 2,
      answers: { 'step-2': 'мост' },
      attempts: {},
      hints: {},
      skipped: {},
      show_map: true,
      early_finish: false,
      completed: false,
      completed_at: null,
      created_at: '2026-09-24T09:01:00Z',
      updated_at: '2026-09-24T09:01:00Z',
    }
    act(() => {
      syncQuestProgressReaders(QUEST_ID, '169', laterRow, beginQuestProgressWrite())
    })
    await waitFor(() => expect(result.current.sync.progress?.id).toBe(462))
    expect(result.current.sync.progress?.answers).toEqual({ 'step-2': 'мост' })
    expect(result.current.wizard.answers['step-1']).toBeUndefined()
  })
})
