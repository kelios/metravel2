/**
 * Гостевой старт квеста (тикет #658).
 *
 * Проверяем два load-bearing куска:
 * 1. Локальное хранение гостевого прогресса (AsyncStorage, без токена) и
 *    подсчёт пройденных «настоящих» точек → мягкий гейт после 2 точки.
 * 2. Миграция гостевого прогресса в аккаунт после логина через useGuestQuestFlow
 *    (fetchOrCreateProgress + updateProgress + очистка локального).
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

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}))

jest.mock('@/api/quests', () => ({
  fetchOrCreateProgress: jest.fn(),
  updateProgress: jest.fn(),
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
    })

    const raw = await AsyncStorage.getItem(`${GUEST_QUEST_PROGRESS_PREFIX}krakow-dragon`)
    expect(raw).not.toBeNull()

    const loaded = await loadGuestQuestProgress('krakow-dragon')
    expect(loaded?.answers['step-1']).toBe('дракон')
    expect(loaded?.currentIndex).toBe(3)
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
    })

    mockedApi.fetchOrCreateProgress.mockResolvedValue({
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
      expect(mockedApi.fetchOrCreateProgress).toHaveBeenCalledWith('krakow-dragon')
      expect(mockedApi.updateProgress).toHaveBeenCalledWith(
        42,
        expect.objectContaining({
          current_index: 2,
          answers: { 'step-1': 'дракон', 'step-2': '7' },
        }),
      )
    })

    await waitFor(async () => {
      const leftover = await loadGuestQuestProgress('krakow-dragon')
      expect(leftover).toBeNull()
    })
  })

  it('does not overwrite a richer server progress', async () => {
    await saveGuestQuestProgress('krakow-dragon', {
      currentIndex: 1,
      unlockedIndex: 1,
      answers: { 'step-1': 'дракон' },
      attempts: {},
      hints: {},
      showMap: true,
    })

    mockedApi.fetchOrCreateProgress.mockResolvedValue({
      id: 42,
      answers: { 'step-1': 'x', 'step-2': 'y', 'step-3': 'z' },
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
      expect(mockedApi.fetchOrCreateProgress).toHaveBeenCalled()
    })
    expect(mockedApi.updateProgress).not.toHaveBeenCalled()

    await waitFor(async () => {
      const leftover = await loadGuestQuestProgress('krakow-dragon')
      expect(leftover).toBeNull()
    })
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

    expect(mockedApi.fetchOrCreateProgress).not.toHaveBeenCalled()
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
    expect(mockedApi.fetchOrCreateProgress).not.toHaveBeenCalled()
  })
})
