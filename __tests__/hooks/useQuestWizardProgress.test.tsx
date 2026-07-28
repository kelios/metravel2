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
    expect(JSON.parse(saved!)).toMatchObject({
      index: 1,
      unlocked: 2,
      answers: { 'step-1': 'dragon' },
      attempts: { 'step-1': 1 },
      hints: { 'step-1': true },
      showMap: false,
    })

    expect(onProgressChange).not.toHaveBeenCalled()
  })

  it('keeps richer local progress instead of letting a poorer backend one overwrite it', async () => {
    // Баг sasino-stilo 2026-07-28: ответы, данные без сети, оставались только
    // локально, а бэкенд знал лишь про intro. Сидирование безусловно затирало
    // локальный прогресс серверным — час прохождения пропадал.
    const storageKey = 'quest_progress_offline_richer'
    await AsyncStorage.setItem(storageKey, JSON.stringify({
      index: 2,
      unlocked: 2,
      answers: { intro: 'start', 'step-1': 'dragon', 'step-2': 'castle' },
      attempts: { 'step-2': 2 },
      hints: { 'step-2': true },
      showMap: false,
    }))

    const onProgressChange = jest.fn()
    const { result } = renderHook(() =>
      useQuestWizardProgress({
        allSteps,
        steps: questSteps,
        storageKey,
        // На сервере остался только intro.
        initialProgress: {
          currentIndex: 0,
          unlockedIndex: 0,
          answers: { intro: 'start' },
          attempts: {},
          hints: {},
          showMap: true,
        },
        onProgressChange,
      })
    )

    await waitFor(() => {
      expect(result.current.answers['step-2']).toBe('castle')
    })

    // Локальное состояние не откатано к серверному.
    expect(result.current.currentIndex).toBe(2)
    expect(result.current.answers).toEqual({ intro: 'start', 'step-1': 'dragon', 'step-2': 'castle' })
    expect(result.current.attempts).toEqual({ 'step-2': 2 })
    expect(result.current.showMap).toBe(false)
    expect(result.current.allCompleted).toBe(true)

    // И доливается на сервер, а не остаётся только локально.
    await waitFor(() => expect(onProgressChange).toHaveBeenCalled())
    expect(onProgressChange).toHaveBeenLastCalledWith(expect.objectContaining({
      currentIndex: 2,
      answers: { intro: 'start', 'step-1': 'dragon', 'step-2': 'castle' },
      completed: true,
    }))

    const saved = await AsyncStorage.getItem(storageKey)
    expect(JSON.parse(saved!).answers).toEqual({ intro: 'start', 'step-1': 'dragon', 'step-2': 'castle' })
  })

  it('сливает ответы двух устройств вместо выбора победителя', async () => {
    // Телефон A прошёл офлайн step-1, телефон B онлайн записал step-2 на сервер.
    const storageKey = 'quest_progress_two_devices'
    await AsyncStorage.setItem(storageKey, JSON.stringify({
      index: 1,
      unlocked: 1,
      answers: { intro: 'start', 'step-1': 'dragon' },
      attempts: { 'step-1': 2 },
      hints: {},
      showMap: true,
      updatedAt: 1_785_000_100_000,
      answeredAt: { intro: 1_785_000_000_000, 'step-1': 1_785_000_100_000 },
    }))

    const onProgressChange = jest.fn()
    const { result } = renderHook(() =>
      useQuestWizardProgress({
        allSteps,
        steps: questSteps,
        storageKey,
        initialProgress: {
          currentIndex: 2,
          unlockedIndex: 2,
          answers: { intro: 'start', 'step-2': 'castle' },
          attempts: { 'step-2': 1 },
          hints: { 'step-2': true },
          showMap: true,
          updatedAt: 1_785_000_050_000,
        },
        onProgressChange,
      })
    )

    // Ни один ответ не потерян — ни локальный, ни серверный.
    await waitFor(() => {
      expect(result.current.answers).toEqual({
        intro: 'start',
        'step-1': 'dragon',
        'step-2': 'castle',
      })
    })
    expect(result.current.attempts).toEqual({ 'step-1': 2, 'step-2': 1 })
    expect(result.current.hints).toEqual({ 'step-2': true })
    expect(result.current.unlockedIndex).toBe(2)
    expect(result.current.allCompleted).toBe(true)

    // Слитое уходит на сервер: серверу не хватало step-1.
    await waitFor(() => expect(onProgressChange).toHaveBeenCalled())
    expect(onProgressChange).toHaveBeenLastCalledWith(expect.objectContaining({
      answers: { intro: 'start', 'step-1': 'dragon', 'step-2': 'castle' },
      completed: true,
    }))

    const saved = JSON.parse((await AsyncStorage.getItem(storageKey))!)
    expect(saved.answers).toEqual({ intro: 'start', 'step-1': 'dragon', 'step-2': 'castle' })
  })

  it('доливает ответы другого устройства, пришедшие во время сессии, не двигая курсор', async () => {
    const storageKey = 'quest_progress_live_merge'
    const makeInitial = (answers: Record<string, string>, updatedAt: number) => ({
      currentIndex: 1,
      unlockedIndex: 1,
      answers,
      attempts: {},
      hints: {},
      showMap: true,
      updatedAt,
    })

    const { result, rerender } = renderHook(
      ({ initialProgress }) =>
        useQuestWizardProgress({
          allSteps,
          steps: questSteps,
          storageKey,
          initialProgress,
        }),
      { initialProps: { initialProgress: makeInitial({ 'step-1': 'dragon' }, 1_785_000_000_000) } }
    )

    await waitFor(() => expect(result.current.answers['step-1']).toBe('dragon'))

    // Игрок на шаге 2 этого устройства.
    act(() => {
      result.current.setCurrentIndex(2)
    })

    // Ответ второго устройства прилетел в ответе сервера.
    rerender({
      initialProgress: makeInitial(
        { 'step-1': 'dragon', 'step-2': 'castle' },
        1_785_000_900_000,
      ),
    })

    await waitFor(() => expect(result.current.answers['step-2']).toBe('castle'))
    // Курсор игрока на месте: шаг под ним не двигаем.
    expect(result.current.currentIndex).toBe(2)
  })

  it('still lets a richer backend progress overwrite a poorer local copy', async () => {
    const storageKey = 'quest_progress_server_richer'
    await AsyncStorage.setItem(storageKey, JSON.stringify({
      index: 0,
      unlocked: 0,
      answers: { intro: 'start' },
      attempts: {},
      hints: {},
      showMap: true,
    }))

    const onProgressChange = jest.fn()
    const { result } = renderHook(() =>
      useQuestWizardProgress({
        allSteps,
        steps: questSteps,
        storageKey,
        initialProgress: {
          currentIndex: 2,
          unlockedIndex: 2,
          answers: { intro: 'start', 'step-1': 'dragon', 'step-2': 'castle' },
          attempts: { 'step-1': 1 },
          hints: {},
          showMap: true,
        },
        onProgressChange,
      })
    )

    await waitFor(() => {
      expect(result.current.answers['step-2']).toBe('castle')
    })

    expect(result.current.currentIndex).toBe(2)
    const saved = await AsyncStorage.getItem(storageKey)
    expect(JSON.parse(saved!).answers).toEqual({ intro: 'start', 'step-1': 'dragon', 'step-2': 'castle' })
    // Серверный прогресс — источник правды, лишнего эхо-сейва нет.
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

  it('does not let optional (any-type) pause points gate the finale', async () => {
    // Репро бага «пройдено 7 из 9»: необязательные точки-паузы ☕/✨ приходят с
    // answer_pattern type='any' (checker помечен _isAny) и раньше сидели в
    // знаменателе гейта — финал был недостижим, пока игрок явно не нажмёт «Далее»
    // на каждой. Теперь такие шаги исключены из requiredCount/allCompleted.
    const anyChecker = (() => {
      const fn = () => true
      ;(fn as unknown as { _isAny: boolean })._isAny = true
      return fn
    })()
    const realChecker = () => true

    const stepsWithOptional = [
      { id: 'req-1', answer: realChecker },
      { id: 'cafe', answer: anyChecker },
      { id: 'req-2', answer: realChecker },
    ]

    const initialProgress = {
      currentIndex: 2,
      unlockedIndex: 2,
      // Оба ОБЯЗАТЕЛЬНЫХ шага отвечены; необязательная ☕-точка — нет.
      answers: { 'req-1': 'a', 'req-2': 'b' },
      attempts: {},
      hints: {},
      showMap: true,
    }

    const { result } = renderHook(() =>
      useQuestWizardProgress({
        allSteps: [{ id: 'intro' }, ...stepsWithOptional],
        steps: stepsWithOptional,
        storageKey: 'quest_progress_optional_gate',
        initialProgress,
      })
    )

    await waitFor(() => {
      expect(result.current.answers['req-2']).toBe('b')
    })

    // Финал доступен: обязательные шаги — 2 из 2, необязательная точка не блокирует.
    expect(result.current.requiredCount).toBe(2)
    expect(result.current.completedSteps).toEqual([{ id: 'req-1', answer: realChecker }, { id: 'req-2', answer: realChecker }])
    expect(result.current.progress).toBe(1)
    expect(result.current.allCompleted).toBe(true)
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
    expect(JSON.parse(saved!)).toMatchObject({
      index: 0,
      unlocked: 0,
      answers: {},
      attempts: {},
      hints: {},
      showMap: true,
    })
  })
})
