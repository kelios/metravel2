/**
 * Гостевой старт квеста (тикет #658).
 *
 * Проверяем два load-bearing куска:
 * 1. Локальное хранение гостевого прогресса (AsyncStorage, без токена) и
 *    подсчёт пройденных «настоящих» точек → мягкий гейт после 2 точки.
 * 2. Миграция гостевого прогресса в аккаунт после логина через useGuestQuestFlow
 *    (withQuestProgress + updateProgress + очистка локального).
 */
import AsyncStorage from '@react-native-async-storage/async-storage'
import { act, renderHook, waitFor } from '@testing-library/react-native'

import {
  clearGuestQuestProgress,
  countGuestAnsweredSteps,
  GUEST_QUEST_FREE_STEPS,
  GUEST_QUEST_PROGRESS_PREFIX,
  loadGuestQuestProgress,
  saveGuestQuestProgress,
} from '@/utils/guestQuestProgress'
import { useGuestQuestFlow } from '@/components/quests/useGuestQuestFlow'
import * as questsApi from '@/api/quests'
import { useAuthStore } from '@/stores/authStore'
import { QUEST_PROGRESS_DELETIONS_KEY, __resetQuestProgressQueue } from '@/utils/questProgressQueue'

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}))

// #1905: миграция гостя ходит через очередь писателей квеста — мок отдаёт задаче
// серверную запись ровно так же, как это делает настоящий `withQuestProgress`.
const mockReadOrCreateProgress = jest.fn()
const mockDeleteProgress = jest.fn()
jest.mock('@/api/quests', () => ({
  withQuestProgress: (questId: string, task: (progress: any) => Promise<unknown>) =>
    Promise.resolve(mockReadOrCreateProgress(questId)).then((progress) => task(progress)),
  updateProgress: jest.fn(),
  deleteProgress: (...args: any[]) => mockDeleteProgress(...args),
}))

const mockedApi = questsApi as jest.Mocked<typeof questsApi>

describe('guest quest local progress', () => {
  beforeEach(async () => {
    jest.clearAllMocks()
    await AsyncStorage.clear()
  })

  it('persists and reloads guest progress namespaced by questId (no token)', async () => {
    await saveGuestQuestProgress('krakow-dragon', {
      currentIndex: 3,
      unlockedIndex: 3,
      answers: { 'step-1': 'дракон', 'step-2': '7' },
      attempts: {},
      hints: {},
      showMap: true,
      skipped: { 'step-far': true },
      earlyFinish: true,
    })

    const raw = await AsyncStorage.getItem(`${GUEST_QUEST_PROGRESS_PREFIX}krakow-dragon`)
    expect(raw).not.toBeNull()

    const loaded = await loadGuestQuestProgress('krakow-dragon')
    expect(loaded?.answers['step-1']).toBe('дракон')
    expect(loaded?.currentIndex).toBe(3)
    expect(loaded?.skipped).toEqual({ 'step-far': true })
    expect(loaded?.earlyFinish).toBe(true)
  })

  it('counts only answered quest steps and triggers gate at free-step limit', () => {
    const questStepIds = ['step-1', 'step-2', 'step-3', 'step-4']

    const afterTwo = countGuestAnsweredSteps({ 'step-1': 'a', 'step-2': 'b' }, questStepIds)
    expect(afterTwo).toBe(GUEST_QUEST_FREE_STEPS)
    expect(afterTwo >= GUEST_QUEST_FREE_STEPS).toBe(true)

    const afterOne = countGuestAnsweredSteps({ 'step-1': 'a' }, questStepIds)
    expect(afterOne < GUEST_QUEST_FREE_STEPS).toBe(true)
  })
})

describe('useGuestQuestFlow migration after login', () => {
  beforeEach(async () => {
    jest.clearAllMocks()
    await AsyncStorage.clear()
  })

  it('replays guest progress to the account and clears local storage on login', async () => {
    await saveGuestQuestProgress('krakow-dragon', {
      currentIndex: 2,
      unlockedIndex: 2,
      answers: { 'step-1': 'дракон', 'step-2': '7' },
      attempts: { 'step-1': 1 },
      hints: {},
      showMap: true,
      skipped: { 'step-far': true },
      earlyFinish: true,
    })

    mockReadOrCreateProgress.mockResolvedValue({
      id: 42,
      answers: {},
    } as never)
    mockedApi.updateProgress.mockResolvedValue({ id: 42 } as never)

    renderHook(() =>
      useGuestQuestFlow({
        questId: 'krakow-dragon',
        cityId: 'krakow',
        isAuthenticated: true,
        enabled: true,
      }),
    )

    await waitFor(() => {
      expect(mockReadOrCreateProgress).toHaveBeenCalledWith('krakow-dragon')
      expect(mockedApi.updateProgress).toHaveBeenCalledWith(
        42,
        expect.objectContaining({
          current_index: 2,
          answers: { 'step-1': 'дракон', 'step-2': '7' },
          skipped: { 'step-far': true },
          early_finish: true,
        }),
      )
    })

    await waitFor(async () => {
      const leftover = await loadGuestQuestProgress('krakow-dragon')
      expect(leftover).toBeNull()
    })
  })

  it('сливает гостевые и серверные ответы, ничего не теряя', async () => {
    // Аккаунт уже проходил квест на другом устройстве, гость — свои шаги.
    await saveGuestQuestProgress('krakow-dragon', {
      currentIndex: 2,
      unlockedIndex: 2,
      answers: { 'step-1': 'дракон', 'step-2': '7' },
      attempts: { 'step-2': 2 },
      hints: {},
      showMap: true,
    })

    mockReadOrCreateProgress.mockResolvedValue({
      id: 42,
      current_index: 3,
      unlocked_index: 3,
      answers: { 'step-1': 'дракон', 'step-3': 'z' },
      attempts: { 'step-1': 1 },
      hints: {},
      show_map: true,
      completed: false,
      updated_at: '2026-01-01T00:00:00Z',
    } as never)
    mockedApi.updateProgress.mockResolvedValue({ id: 42 } as never)

    renderHook(() =>
      useGuestQuestFlow({
        questId: 'krakow-dragon',
        cityId: 'krakow',
        isAuthenticated: true,
        enabled: true,
      }),
    )

    await waitFor(() => {
      expect(mockedApi.updateProgress).toHaveBeenCalledWith(
        42,
        expect.objectContaining({
          answers: { 'step-1': 'дракон', 'step-2': '7', 'step-3': 'z' },
          attempts: { 'step-1': 1, 'step-2': 2 },
          unlocked_index: 3,
        }),
      )
    })

    await waitFor(async () => {
      const leftover = await loadGuestQuestProgress('krakow-dragon')
      expect(leftover).toBeNull()
    })
  })

  it('does not push when the server already knows every guest answer', async () => {
    await saveGuestQuestProgress('krakow-dragon', {
      currentIndex: 1,
      unlockedIndex: 1,
      answers: { 'step-1': 'дракон' },
      attempts: {},
      hints: {},
      showMap: true,
    })

    mockReadOrCreateProgress.mockResolvedValue({
      id: 42,
      current_index: 3,
      unlocked_index: 3,
      answers: { 'step-1': 'дракон', 'step-2': 'y', 'step-3': 'z' },
      attempts: {},
      hints: {},
      show_map: true,
      completed: false,
      updated_at: '2026-01-01T00:00:00Z',
    } as never)

    renderHook(() =>
      useGuestQuestFlow({
        questId: 'krakow-dragon',
        cityId: 'krakow',
        isAuthenticated: true,
        enabled: true,
      }),
    )

    await waitFor(() => {
      expect(mockReadOrCreateProgress).toHaveBeenCalled()
    })
    expect(mockedApi.updateProgress).not.toHaveBeenCalled()

    await waitFor(async () => {
      const leftover = await loadGuestQuestProgress('krakow-dragon')
      expect(leftover).toBeNull()
    })
  })

  // #2043: сброс в аккаунте, нажатый без сети, ещё не дошёл до сервера. Гостевые
  // ответы, слитые в строку стёртого прохождения, пропали бы вместе с ней.
  it('не сливает гостевые ответы в строку, удаление которой ещё ждёт сети', async () => {
    const authSnapshot = useAuthStore.getState()
    useAuthStore.setState({ isAuthenticated: true, userId: '169' })
    await AsyncStorage.setItem(
      QUEST_PROGRESS_DELETIONS_KEY,
      JSON.stringify([{ questId: 'krakow-dragon', ownerId: '169', progressId: 42, queuedAt: 1 }]),
    )
    __resetQuestProgressQueue()
    mockDeleteProgress.mockRejectedValue(new Error('Network request failed'))
    await saveGuestQuestProgress('krakow-dragon', {
      currentIndex: 1,
      unlockedIndex: 1,
      answers: { 'step-1': 'дракон' },
      attempts: {},
      hints: {},
      showMap: true,
    })

    try {
      renderHook(() =>
        useGuestQuestFlow({
          questId: 'krakow-dragon',
          cityId: 'krakow',
          isAuthenticated: true,
          enabled: true,
        }),
      )

      await waitFor(() => expect(mockDeleteProgress).toHaveBeenCalledWith(42))
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0))
      })

      expect(mockReadOrCreateProgress).not.toHaveBeenCalled()
      expect(mockedApi.updateProgress).not.toHaveBeenCalled()
      expect((await loadGuestQuestProgress('krakow-dragon'))?.answers).toEqual({ 'step-1': 'дракон' })
    } finally {
      __resetQuestProgressQueue()
      mockDeleteProgress.mockReset()
      useAuthStore.setState({ isAuthenticated: authSnapshot.isAuthenticated, userId: authSnapshot.userId })
    }
  })

  it('is a no-op when there is no guest progress to migrate', async () => {
    renderHook(() =>
      useGuestQuestFlow({
        questId: 'krakow-dragon',
        cityId: 'krakow',
        isAuthenticated: true,
        enabled: true,
      }),
    )

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(mockReadOrCreateProgress).not.toHaveBeenCalled()
    expect(mockedApi.updateProgress).not.toHaveBeenCalled()
  })

  it('exposes guest initial progress for the wizard when not authenticated', async () => {
    await clearGuestQuestProgress('krakow-dragon')
    await saveGuestQuestProgress('krakow-dragon', {
      currentIndex: 1,
      unlockedIndex: 1,
      answers: { 'step-1': 'дракон' },
      attempts: {},
      hints: {},
      showMap: true,
    })

    const { result } = renderHook(() =>
      useGuestQuestFlow({
        questId: 'krakow-dragon',
        cityId: 'krakow',
        isAuthenticated: false,
        enabled: true,
      }),
    )

    await waitFor(() => {
      expect(result.current.guestReady).toBe(true)
      expect(result.current.guestInitial?.answers['step-1']).toBe('дракон')
    })
    expect(mockReadOrCreateProgress).not.toHaveBeenCalled()
  })
})
