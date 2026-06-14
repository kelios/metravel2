import AsyncStorage from '@react-native-async-storage/async-storage'
import { act, renderHook, waitFor } from '@testing-library/react-native'

import { useQuestWizardProgress } from '@/components/quests/useQuestWizardProgress'

const allSteps = [
  { id: 'intro' },
  { id: 'step-1' },
  { id: 'step-2' },
]

const questSteps = [
  { id: 'step-1' },
  { id: 'step-2' },
]

describe('useQuestWizardProgress', () => {
  beforeEach(async () => {
    jest.clearAllMocks()
    await AsyncStorage.clear()
  })

  it('hydrates from backend initialProgress and syncs it to AsyncStorage', async () => {
    const onProgressChange = jest.fn()
    const initialProgress = {
      currentIndex: 1,
      unlockedIndex: 2,
      answers: { 'step-1': 'dragon' },
      attempts: { 'step-1': 1 },
      hints: { 'step-1': true },
      showMap: false,
    }

    const { result } = renderHook(() =>
      useQuestWizardProgress({
        allSteps,
        steps: questSteps,
        storageKey: 'quest_progress_test',
        initialProgress,
        onProgressChange,
      })
    )

    await waitFor(() => {
      expect(result.current.currentIndex).toBe(1)
      expect(result.current.unlockedIndex).toBe(2)
      expect(result.current.answers['step-1']).toBe('dragon')
      expect(result.current.showMap).toBe(false)
    })

    const saved = await AsyncStorage.getItem('quest_progress_test')
    expect(saved).not.toBeNull()
    expect(JSON.parse(saved!)).toEqual({
      index: 1,
      unlocked: 2,
      answers: { 'step-1': 'dragon' },
      attempts: { 'step-1': 1 },
      hints: { 'step-1': true },
      showMap: false,
    })

    expect(onProgressChange).not.toHaveBeenCalled()
  })

  it('exposes completedSteps and derived progress for answered quest steps', async () => {
    const initialProgress = {
      currentIndex: 1,
      unlockedIndex: 1,
      answers: { 'step-1': 'dragon' },
      attempts: {},
      hints: {},
      showMap: true,
    }

    const { result } = renderHook(() =>
      useQuestWizardProgress({
        allSteps,
        steps: questSteps,
        storageKey: 'quest_progress_completed_steps',
        initialProgress,
      })
    )

    await waitFor(() => {
      expect(result.current.completedSteps).toEqual([{ id: 'step-1' }])
    })

    expect(result.current.progress).toBe(0.5)
    expect(result.current.allCompleted).toBe(false)
  })

  it('does not revert the user step when initialProgress identity changes (save echo)', async () => {
    // Бэкенд-эхо: после debounced-сейва setProgress пересоздаёт initialProgress
    // в роуте через useMemo. Новый identity не должен пере-сеять состояние и
    // откатывать продвинутый игроком шаг.
    const makeInitial = () => ({
      currentIndex: 1,
      unlockedIndex: 1,
      answers: { 'step-1': 'dragon' },
      attempts: {},
      hints: {},
      showMap: true,
    })

    const { result, rerender } = renderHook(
      ({ initialProgress }) =>
        useQuestWizardProgress({
          allSteps,
          steps: questSteps,
          storageKey: 'quest_progress_echo',
          initialProgress,
        }),
      { initialProps: { initialProgress: makeInitial() } }
    )

    await waitFor(() => {
      expect(result.current.currentIndex).toBe(1)
    })

    // Игрок отвечает на step-2 и продвигается дальше.
    act(() => {
      result.current.setAnswers((prev) => ({ ...prev, 'step-2': 'castle' }))
      result.current.setCurrentIndex(2)
    })
    expect(result.current.currentIndex).toBe(2)

    // Эхо: тот же storageKey, новый объект initialProgress (стейл current_index=1).
    rerender({ initialProgress: makeInitial() })

    await new Promise((resolve) => setTimeout(resolve, 0))

    // Шаг игрока сохранён, не откатан к серверному значению.
    expect(result.current.currentIndex).toBe(2)
    expect(result.current.answers['step-2']).toBe('castle')
  })

  it('resets persisted progress and state', async () => {
    await AsyncStorage.setItem('quest_progress_reset', JSON.stringify({
      index: 2,
      unlocked: 2,
      answers: { 'step-1': 'saved' },
      attempts: { 'step-1': 3 },
      hints: { 'step-1': true },
      showMap: false,
    }))

    const onProgressReset = jest.fn()
    const { result } = renderHook(() =>
      useQuestWizardProgress({
        allSteps,
        steps: questSteps,
        storageKey: 'quest_progress_reset',
        onProgressReset,
      })
    )

    await waitFor(() => {
      expect(result.current.currentIndex).toBe(2)
      expect(result.current.showMap).toBe(false)
    })

    await act(async () => {
      await result.current.resetProgress()
    })

    expect(result.current.currentIndex).toBe(0)
    expect(result.current.unlockedIndex).toBe(0)
    expect(result.current.answers).toEqual({})
    expect(result.current.attempts).toEqual({})
    expect(result.current.hints).toEqual({})
    expect(result.current.showMap).toBe(true)
    expect(onProgressReset).toHaveBeenCalled()

    const saved = await AsyncStorage.getItem('quest_progress_reset')
    expect(JSON.parse(saved!)).toEqual({
      index: 0,
      unlocked: 0,
      answers: {},
      attempts: {},
      hints: {},
      showMap: true,
    })
  })
})
