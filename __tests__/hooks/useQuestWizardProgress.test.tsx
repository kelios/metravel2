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
