import AsyncStorage from '@react-native-async-storage/async-storage'
import { act, renderHook, waitFor } from '@testing-library/react-native'

import { useQuestWizardProgress } from '@/components/quests/useQuestWizardProgress'
import { buildQuestProgressStorageKey } from '@/utils/questProgressStorage'

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
    expect(result.current.routeGateClosed).toBe(true)

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

  it('доливает офлайновое прохождение, когда серверной строки нет вовсе', async () => {
    // #1803 развёл чтение и создание: у нового игрока серверной записи нет, и
    // экран получает ПУСТОЙ серверный снапшот, а не `undefined`. На `undefined`
    // визард засеял бы локальную копию как согласованную с сервером и заглушил
    // save-эффект — квест, пройденный без сети, не долился бы никогда.
    const storageKey = 'quest_progress_no_server_row'
    await AsyncStorage.setItem(storageKey, JSON.stringify({
      index: 2,
      unlocked: 2,
      answers: { intro: 'start', 'step-1': 'dragon', 'step-2': 'castle' },
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
        // Так роут описывает «чтение закончилось, записи на сервере нет».
        initialProgress: {
          currentIndex: 0,
          unlockedIndex: 0,
          answers: {},
          attempts: {},
          hints: {},
          showMap: true,
        },
        onProgressChange,
      })
    )

    await waitFor(() => expect(result.current.answers['step-2']).toBe('castle'))
    expect(result.current.currentIndex).toBe(2)

    await waitFor(() => expect(onProgressChange).toHaveBeenCalled())
    expect(onProgressChange).toHaveBeenLastCalledWith(expect.objectContaining({
      answers: { intro: 'start', 'step-1': 'dragon', 'step-2': 'castle' },
      completed: true,
    }))
  })

  it('пока чтение прогресса идёт, визард на сервер ничего не шлёт', async () => {
    // Контракт роута: `undefined` означает ТОЛЬКО «чтение ещё в полёте».
    // Здесь визард сознательно засевает локальную копию как согласованную —
    // именно поэтому «записи нет» роут обязан выражать пустым снапшотом, а не
    // `undefined` (#1803): иначе офлайновое прохождение молча осталось бы на
    // устройстве.
    const storageKey = 'quest_progress_still_loading'
    await AsyncStorage.setItem(storageKey, JSON.stringify({
      index: 2,
      unlocked: 2,
      answers: { intro: 'start', 'step-1': 'dragon', 'step-2': 'castle' },
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
        initialProgress: undefined,
        onProgressChange,
      })
    )

    await waitFor(() => expect(result.current.answers['step-2']).toBe('castle'))
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(onProgressChange).not.toHaveBeenCalled()
  })

  it('нетронутый экран без серверной строки на сервер ничего не шлёт', async () => {
    // Обратная половина того же инварианта: «просто открыл» строку не создаёт.
    const storageKey = 'quest_progress_untouched_no_row'
    const onProgressChange = jest.fn()

    renderHook(() =>
      useQuestWizardProgress({
        allSteps,
        steps: questSteps,
        storageKey,
        initialProgress: {
          currentIndex: 0,
          unlockedIndex: 0,
          answers: {},
          attempts: {},
          hints: {},
          showMap: true,
        },
        onProgressChange,
      })
    )

    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(onProgressChange).not.toHaveBeenCalled()
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
    expect(result.current.routeGateClosed).toBe(true)

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
    expect(result.current.routeGateClosed).toBe(false)
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

  it('does not infer optional semantics from answer:any when roles are incomplete', async () => {
    // #1614: `answer_pattern:any` describes answer behavior, not route role.
    // Until every numbered point has a valid backend role, the fallback is
    // neutral and every structurally numbered point owns progress/gating.
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
      // Два шага отвечены, но без point_role клиент не объявляет третий optional.
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

    expect(result.current.requiredCount).toBe(3)
    expect(result.current.completedSteps).toEqual([{ id: 'req-1', answer: realChecker }, { id: 'req-2', answer: realChecker }])
    expect(result.current.progress).toBe(2 / 3)
    expect(result.current.routeGateClosed).toBe(false)
  })

  it('uses required roles for progress but keeps the explicit final point in the route gate', async () => {
    const checker = () => true
    const routeSteps = [
      { id: 'req-1', answer: checker, pointRole: 'required' as const },
      { id: 'pause', answer: checker, pointRole: 'optional' as const },
      { id: 'req-2', answer: checker, pointRole: 'required' as const },
      { id: 'finish', answer: checker, pointRole: 'final' as const },
    ]

    const { result } = renderHook(() =>
      useQuestWizardProgress({
        allSteps: [{ id: 'intro' }, ...routeSteps],
        steps: routeSteps,
        storageKey: 'quest_progress_explicit_final_gate',
        initialProgress: {
          currentIndex: 3,
          unlockedIndex: 3,
          answers: { 'req-1': 'a', 'req-2': 'b' },
          attempts: {},
          hints: {},
          showMap: true,
        },
      })
    )

    await waitFor(() => expect(result.current.answers['req-2']).toBe('b'))

    expect(result.current.requiredCount).toBe(2)
    expect(result.current.progress).toBe(1)
    expect(result.current.routeGateClosed).toBe(false)
    expect(result.current.pendingSteps.map((step) => step.id)).toEqual(['finish'])

    act(() => {
      result.current.setAnswers((prev) => ({ ...prev, finish: 'done' }))
    })

    expect(result.current.routeGateClosed).toBe(true)
    expect(result.current.questCompleted).toBe(true)
    expect(result.current.completedSteps).toHaveLength(2)
  })

  it('засчитывает квест после пропуска далёкой точки в середине маршрута', async () => {
    // #1432: у `minsk-dvoriki` далёкая точка `5-prikurivayushchiy` (1085 м) стоит
    // в СЕРЕДИНЕ — за ней ещё два коротких перегона. Пока пропуск не снимал точку
    // с гейта, финал после него был недостижим навсегда, хотя карточка обещает
    // «квест засчитается и без неё».
    const checker = () => true
    const routeSteps = [
      { id: 'p-1', answer: checker },
      { id: 'p-2', answer: checker },
      { id: 'p-far', answer: checker },
      { id: 'p-4', answer: checker },
      { id: 'p-5', answer: checker },
    ]
    const storageKey = 'quest_progress_skip_far_middle'

    const { result } = renderHook(() =>
      useQuestWizardProgress({
        allSteps: [{ id: 'intro' }, ...routeSteps],
        steps: routeSteps,
        storageKey,
      })
    )

    await waitFor(() => expect(result.current.requiredCount).toBe(5))

    act(() => {
      result.current.setAnswers({ 'p-1': 'a', 'p-2': 'b' })
    })
    act(() => {
      result.current.markStepSkipped('p-far')
    })

    expect(result.current.questCompleted).toBe(false)

    act(() => {
      result.current.setAnswers((prev) => ({ ...prev, 'p-4': 'd', 'p-5': 'e' }))
    })

    expect(result.current.questCompleted).toBe(true)
    expect(result.current.finishedEarly).toBe(true)
    // Счётчик остаётся честным: пропущенная точка из знаменателя не исчезает.
    expect(result.current.completedSteps).toHaveLength(4)
    expect(result.current.requiredCount).toBe(5)

    // Пропуск переживает перезапуск: иначе после возврата в квест финал снова
    // оказался бы закрыт.
    await waitFor(async () => {
      const saved = await AsyncStorage.getItem(storageKey)
      expect(JSON.parse(saved!).skipped).toEqual({ 'p-far': true })
    })

    const remounted = renderHook(() =>
      useQuestWizardProgress({
        allSteps: [{ id: 'intro' }, ...routeSteps],
        steps: routeSteps,
        storageKey,
      })
    )
    await waitFor(() => expect(remounted.result.current.questCompleted).toBe(true))
  })

  it('пропуск всех шагов подряд не выдаёт ни прохождения, ни финала', async () => {
    // #1430: приглашение «пропустить шаг» снимает шаг с гейта финала, и гейт
    // при этом МОЖЕТ опуститься до пустого — `[].every(...) === true` объявлял
    // тогда квест пройденным без единого ответа, с бейджем, «первопроходцем» и
    // `completed: true` на бэкенде. Ноль ответов не даёт даже частичного финала:
    // показывать финальное видео за пропуск всего маршрута незачем.
    const checker = () => true
    const routeSteps = [
      { id: 'p-1', answer: checker },
      { id: 'p-2', answer: checker },
      { id: 'p-3', answer: checker },
    ]

    const { result } = renderHook(() =>
      useQuestWizardProgress({
        allSteps: [{ id: 'intro' }, ...routeSteps],
        steps: routeSteps,
        storageKey: 'quest_progress_skip_everything',
      })
    )

    await waitFor(() => expect(result.current.requiredCount).toBe(3))

    act(() => {
      routeSteps.forEach((step) => result.current.markStepSkipped(step.id))
    })

    expect(result.current.questFinished).toBe(false)
    expect(result.current.questCompleted).toBe(false)
    expect(result.current.partiallyCompleted).toBe(false)
    expect(result.current.completedSteps).toHaveLength(0)
  })

  it('один ответ и пропуск остальных даёт частичный финал без зачёта прохождения', async () => {
    // #1443: политика пропусков. До неё хватало ОДНОГО честного ответа — на
    // остальных точках трёх неверных попыток и приглашения «Не сходится?
    // Пропустить шаг и идти дальше», — чтобы получить полноценное прохождение со
    // значком, «первопроходцем» и `completed: true` на бэкенде.
    const checker = () => true
    const routeSteps = Array.from({ length: 9 }, (_, i) => ({ id: `p-${i + 1}`, answer: checker }))
    const storageKey = 'quest_progress_policy_one_answer'
    const onProgressChange = jest.fn()

    const { result } = renderHook(() =>
      useQuestWizardProgress({
        allSteps: [{ id: 'intro' }, ...routeSteps],
        steps: routeSteps,
        storageKey,
        onProgressChange,
      })
    )

    await waitFor(() => expect(result.current.requiredCount).toBe(9))

    act(() => {
      result.current.setAnswers({ 'p-1': 'a' })
    })
    act(() => {
      routeSteps.slice(1).forEach((step) => result.current.markStepSkipped(step.id))
    })

    // Финал есть — обещание «идти дальше» выполнено, игрок не заперт в маршруте.
    expect(result.current.questFinished).toBe(true)
    // Но прохождение не засчитано: до порога (две трети от 9 — это 6) не хватает 5 точек.
    expect(result.current.questCompleted).toBe(false)
    expect(result.current.partiallyCompleted).toBe(true)
    expect(result.current.stepsMissingForCompletion).toBe(5)

    // На бэкенд `completed: true` не уезжает — значит нет ни счётчика прохождений,
    // ни «первопроходца», ни значка.
    await waitFor(() => expect(onProgressChange).toHaveBeenCalled())
    expect(onProgressChange).toHaveBeenLastCalledWith(expect.objectContaining({ completed: false }))
    await waitFor(async () => {
      const saved = await AsyncStorage.getItem(storageKey)
      expect(JSON.parse(saved!).completed).toBe(false)
    })

    // Частичный финал не финальный приговор: добор точек до порога засчитывает квест.
    act(() => {
      result.current.setAnswers({ 'p-1': 'a', 'p-2': 'b', 'p-3': 'c', 'p-4': 'd', 'p-5': 'e', 'p-6': 'f' })
    })

    expect(result.current.questCompleted).toBe(true)
    expect(result.current.partiallyCompleted).toBe(false)
    expect(result.current.stepsMissingForCompletion).toBe(0)
    await waitFor(() => expect(onProgressChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ completed: true }),
    ))
  })

  it('пропуск ПЕРВОГО шага не запирает квест: остальные пройденные его закрывают', async () => {
    // #1430, раунд 4: защита «не завершать квест с нулём ответов» сначала жила в
    // условии на пропуск, и шаг, пропущенный до первого ответа, оставался в
    // гейте навсегда — игрок доходил маршрут и молча не получал финала. Порог
    // переехал в сам гейт, поэтому пропуск работает одинаково с первого шага.
    const checker = () => true
    const routeSteps = [
      { id: 'p-1', answer: checker },
      { id: 'p-2', answer: checker },
      { id: 'p-3', answer: checker },
    ]

    const { result } = renderHook(() =>
      useQuestWizardProgress({
        allSteps: [{ id: 'intro' }, ...routeSteps],
        steps: routeSteps,
        storageKey: 'quest_progress_skip_first',
      })
    )

    await waitFor(() => expect(result.current.requiredCount).toBe(3))

    act(() => {
      result.current.markStepSkipped('p-1')
    })
    expect(result.current.questCompleted).toBe(false)

    act(() => {
      result.current.setAnswers({ 'p-2': 'b', 'p-3': 'c' })
    })

    expect(result.current.questCompleted).toBe(true)
    expect(result.current.finishedEarly).toBe(true)
  })

  it('снапшот, где пропущены все шаги, не запирает квест при живых ответах', async () => {
    // `skipped` монотонен и мержится между устройствами по ИЛИ, поэтому снапшот
    // «все шаги пропущены» реально достижим (старая сборка, чужое устройство).
    // Такой снапшот не должен запирать квест: гейт закрыт, финал доступен, а
    // зачёт прохождения решает порог по числу ответов.
    const checker = () => true
    const routeSteps = [
      { id: 'p-1', answer: checker },
      { id: 'p-2', answer: checker },
    ]

    const { result } = renderHook(() =>
      useQuestWizardProgress({
        allSteps: [{ id: 'intro' }, ...routeSteps],
        steps: routeSteps,
        storageKey: 'quest_progress_all_skipped_snapshot',
      })
    )

    await waitFor(() => expect(result.current.requiredCount).toBe(2))

    act(() => {
      routeSteps.forEach((step) => result.current.markStepSkipped(step.id))
    })
    expect(result.current.questFinished).toBe(false)

    act(() => {
      result.current.setAnswers({ 'p-1': 'a' })
    })

    // Финал открыт, но одна точка из двух порога не берёт — прохождение частичное.
    expect(result.current.questFinished).toBe(true)
    expect(result.current.questCompleted).toBe(false)

    act(() => {
      result.current.setAnswers({ 'p-1': 'a', 'p-2': 'b' })
    })

    expect(result.current.questCompleted).toBe(true)
  })

  it('пропуск части шагов финал не ломает: хватает пройденных из оставшихся', async () => {
    // Обратная сторона предыдущего теста — порог зачёта не должен закрыть штатный
    // сценарий, где игрок пропустил пару точек и прошёл остальные: две трети от
    // шести — это четыре, значит два пропуска прохождению не мешают.
    const checker = () => true
    const routeSteps = Array.from({ length: 6 }, (_, i) => ({ id: `p-${i + 1}`, answer: checker }))

    const { result } = renderHook(() =>
      useQuestWizardProgress({
        allSteps: [{ id: 'intro' }, ...routeSteps],
        steps: routeSteps,
        storageKey: 'quest_progress_skip_partial',
      })
    )

    await waitFor(() => expect(result.current.requiredCount).toBe(6))

    act(() => {
      result.current.setAnswers({ 'p-2': 'b', 'p-3': 'c', 'p-4': 'd', 'p-5': 'e' })
    })
    act(() => {
      result.current.markStepSkipped('p-1')
      result.current.markStepSkipped('p-6')
    })

    expect(result.current.questCompleted).toBe(true)
    expect(result.current.stepsMissingForCompletion).toBe(0)
    expect(result.current.finishedEarly).toBe(true)
  })

  it('не считает досрочным финишем чужой completed с сервера', async () => {
    // #1431: в квест могут добавить шаг уже после прохождения. Сервер помнит
    // completed=true, но это не решение игрока закончить на месте — иначе его
    // форсит в финал и показывает «дальние вы отложили».
    const checker = () => true
    const grownSteps = [
      { id: 'p-1', answer: checker },
      { id: 'p-2', answer: checker },
      { id: 'p-new', answer: checker },
    ]

    const { result } = renderHook(() =>
      useQuestWizardProgress({
        allSteps: [{ id: 'intro' }, ...grownSteps],
        steps: grownSteps,
        storageKey: 'quest_progress_grown_quest',
        initialProgress: {
          currentIndex: 2,
          unlockedIndex: 2,
          answers: { 'p-1': 'a', 'p-2': 'b' },
          attempts: {},
          hints: {},
          showMap: true,
          completed: true,
        },
      })
    )

    await waitFor(() => expect(result.current.answers['p-2']).toBe('b'))

    expect(result.current.finishedEarly).toBe(false)
    expect(result.current.questCompleted).toBe(false)
  })

  it('помнит финиш на месте между сессиями', async () => {
    const checker = () => true
    const routeSteps = [
      { id: 'p-1', answer: checker },
      { id: 'p-2', answer: checker },
      { id: 'p-far', answer: checker },
    ]
    const storageKey = 'quest_progress_finish_here'

    const { result } = renderHook(() =>
      useQuestWizardProgress({
        allSteps: [{ id: 'intro' }, ...routeSteps],
        steps: routeSteps,
        storageKey,
      })
    )

    await waitFor(() => expect(result.current.requiredCount).toBe(3))

    // Две точки из трёх берут порог зачёта — финиш на месте остаётся полноценным
    // прохождением, а не частичным.
    act(() => {
      result.current.setAnswers({ 'p-1': 'a', 'p-2': 'b' })
    })
    act(() => {
      result.current.finishEarly()
    })

    expect(result.current.questCompleted).toBe(true)

    await waitFor(async () => {
      const saved = await AsyncStorage.getItem(storageKey)
      expect(JSON.parse(saved!)).toMatchObject({ completed: true, earlyFinish: true })
    })

    const remounted = renderHook(() =>
      useQuestWizardProgress({
        allSteps: [{ id: 'intro' }, ...routeSteps],
        steps: routeSteps,
        storageKey,
      })
    )
    await waitFor(() => expect(remounted.result.current.questCompleted).toBe(true))
    expect(remounted.result.current.finishedEarly).toBe(true)
  })

  it('передаёт официальный пропуск и ранний финиш в server-sync callback (#1632)', async () => {
    const checker = () => true
    const routeSteps = [
      { id: 'p-1', answer: checker },
      { id: 'p-far', answer: checker },
    ]
    const onProgressChange = jest.fn()

    const { result } = renderHook(() =>
      useQuestWizardProgress({
        allSteps: [{ id: 'intro' }, ...routeSteps],
        steps: routeSteps,
        storageKey: 'quest_progress_server_skip',
        onProgressChange,
      })
    )

    await waitFor(() => expect(result.current.requiredCount).toBe(2))

    act(() => {
      result.current.setAnswers({ 'p-1': 'ответ' })
      result.current.markStepSkipped('p-far')
      result.current.finishEarly()
    })

    await waitFor(() => {
      expect(onProgressChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          skipped: { 'p-far': true },
          earlyFinish: true,
        }),
      )
    })
  })

  it('финиш на месте в начале маршрута прохождения не засчитывает', async () => {
    // #1443: «Завершить квест здесь» — тот же вопрос политики, что и пропуски.
    // Две точки из девяти это не пройденный квест, поэтому финал у игрока есть, а
    // значка и «первопроходца» — нет.
    const checker = () => true
    const routeSteps = Array.from({ length: 9 }, (_, i) => ({ id: `p-${i + 1}`, answer: checker }))
    const storageKey = 'quest_progress_finish_here_early'

    const { result } = renderHook(() =>
      useQuestWizardProgress({
        allSteps: [{ id: 'intro' }, ...routeSteps],
        steps: routeSteps,
        storageKey,
      })
    )

    await waitFor(() => expect(result.current.requiredCount).toBe(9))

    act(() => {
      result.current.setAnswers({ 'p-1': 'a', 'p-2': 'b' })
    })
    act(() => {
      result.current.finishEarly()
    })

    expect(result.current.questFinished).toBe(true)
    expect(result.current.questCompleted).toBe(false)
    expect(result.current.partiallyCompleted).toBe(true)
    expect(result.current.stepsMissingForCompletion).toBe(4)

    await waitFor(async () => {
      const saved = await AsyncStorage.getItem(storageKey)
      expect(JSON.parse(saved!)).toMatchObject({ completed: false, earlyFinish: true })
    })
  })

  it('не понижает засчитанное прохождение на втором устройстве (#1451)', async () => {
    // Устройство A прошло 2 точки из 3 и официально пропустило далёкую — квест
    // засчитан, на сервере `completed: true`. Устройство B получило легаси-запись
    // без `skipped` и пересчитывает прохождение как незаконченное.
    // Любое тривиальное действие в визарде не должно отправлять `completed:
    // false`: иначе игрок теряет «Пройден» и единицу из счётчика прохождений.
    const checker = () => true
    const routeSteps = [
      { id: 'p-1', answer: checker },
      { id: 'p-2', answer: checker },
      { id: 'p-far', answer: checker },
    ]
    const storageKey = 'quest_progress_second_device'
    const onProgressChange = jest.fn()

    const { result } = renderHook(() =>
      useQuestWizardProgress({
        allSteps: [{ id: 'intro' }, ...routeSteps],
        steps: routeSteps,
        storageKey,
        initialProgress: {
          currentIndex: 2,
          unlockedIndex: 2,
          answers: { 'p-1': 'a', 'p-2': 'b' },
          attempts: {},
          hints: {},
          showMap: true,
          completed: true,
        },
        onProgressChange,
      })
    )

    await waitFor(() => expect(result.current.answers['p-2']).toBe('b'))
    // Форс-редиректа в финал у прежнего финишера по-прежнему нет (#1431).
    expect(result.current.questCompleted).toBe(false)

    act(() => {
      result.current.setShowMap(false)
    })

    await waitFor(() => {
      expect(onProgressChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ completed: true, showMap: false }),
      )
    })
    const saved = await AsyncStorage.getItem(storageKey)
    expect(JSON.parse(saved!).completed).toBe(true)
  })

  it('сброс прогресса снимает подтверждённое прохождение (#1451)', async () => {
    // Монотонность не должна пережить осознанный сброс: после «пройти заново»
    // клиент обязан снова отдавать `completed: false`. Серверную запись сброс
    // удаляет отдельно (`useQuestProgressSync.resetProgress`), поэтому здесь
    // бэкенд-прогресса нет.
    const checker = () => true
    const routeSteps = [
      { id: 'p-1', answer: checker },
      { id: 'p-2', answer: checker },
    ]
    const storageKey = 'quest_progress_reset_clears_completed'
    const onProgressChange = jest.fn()

    const { result } = renderHook(() =>
      useQuestWizardProgress({
        allSteps: [{ id: 'intro' }, ...routeSteps],
        steps: routeSteps,
        storageKey,
        onProgressChange,
      })
    )

    await waitFor(() => expect(result.current.requiredCount).toBe(2))

    act(() => {
      result.current.setAnswers({ 'p-1': 'a', 'p-2': 'b' })
    })
    await waitFor(() => {
      expect(onProgressChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ completed: true }),
      )
    })

    await act(async () => {
      await result.current.resetProgress()
    })

    act(() => {
      result.current.setAnswers({ 'p-1': 'a' })
    })

    await waitFor(() => {
      expect(onProgressChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ completed: false }),
      )
    })
  })

  it('не подставляет прогресс другого аккаунта на общем устройстве (#1456)', async () => {
    // Аккаунт A прошёл квест на этом устройстве (с официальным пропуском далёкой
    // точки, поэтому `completed: true`) и вышел. Аккаунт B открывает тот же
    // квест: его запись лежит под своим ключом, чужая просто не находится — ни
    // ответы, ни монотонный `completed` в прохождение B не попадают.
    const checker = () => true
    const routeSteps = [
      { id: 'p-1', answer: checker },
      { id: 'p-2', answer: checker },
    ]
    const base = 'quest_progress_shared_device'
    const keyA = buildQuestProgressStorageKey(base, { isAuthenticated: true, userId: '17' })
    const keyB = buildQuestProgressStorageKey(base, { isAuthenticated: true, userId: '42' })

    await AsyncStorage.setItem(keyA, JSON.stringify({
      index: 2,
      unlocked: 2,
      answers: { 'p-1': 'ответ мужа', 'p-2': 'и второй' },
      attempts: {},
      hints: {},
      showMap: true,
      completed: true,
      updatedAt: Date.now(),
    }))

    const onProgressChange = jest.fn()
    const { result } = renderHook(() =>
      useQuestWizardProgress({
        allSteps: [{ id: 'intro' }, ...routeSteps],
        steps: routeSteps,
        storageKey: keyB,
        // Серверный прогресс аккаунта B: квест ещё не начат.
        initialProgress: {
          currentIndex: 0,
          unlockedIndex: 0,
          answers: {},
          attempts: {},
          hints: {},
          showMap: true,
          completed: false,
        },
        onProgressChange,
      })
    )

    await waitFor(() => expect(result.current.requiredCount).toBe(2))
    expect(result.current.answers).toEqual({})
    expect(result.current.currentIndex).toBe(0)
    expect(result.current.questCompleted).toBe(false)

    act(() => {
      result.current.setAnswers({ 'p-1': 'свой ответ' })
    })

    await waitFor(() => {
      expect(onProgressChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          completed: false,
          answers: { 'p-1': 'свой ответ' },
        }),
      )
    })

    // Запись аккаунта A на месте и не перезаписана прохождением B.
    expect(JSON.parse((await AsyncStorage.getItem(keyA))!)).toMatchObject({
      answers: { 'p-1': 'ответ мужа', 'p-2': 'и второй' },
      completed: true,
    })
    expect(JSON.parse((await AsyncStorage.getItem(keyB))!)).toMatchObject({
      answers: { 'p-1': 'свой ответ' },
      completed: false,
    })
  })

  it('тот же аккаунт после релогина видит свой локальный прогресс (#1456)', async () => {
    // Обратная сторона привязки к пользователю: офлайн-ответы, не долетевшие до
    // сервера, обязаны пережить выход и повторный вход того же игрока.
    const base = 'quest_progress_same_user_relogin'
    const storageKey = buildQuestProgressStorageKey(base, { isAuthenticated: true, userId: '17' })
    await AsyncStorage.setItem(storageKey, JSON.stringify({
      index: 2,
      unlocked: 2,
      answers: { 'step-1': 'офлайн-ответ', 'step-2': 'и второй' },
      attempts: {},
      hints: {},
      showMap: false,
      updatedAt: Date.now(),
    }))

    const { result } = renderHook(() =>
      useQuestWizardProgress({
        allSteps,
        steps: questSteps,
        storageKey,
      })
    )

    await waitFor(() => {
      expect(result.current.answers['step-1']).toBe('офлайн-ответ')
      expect(result.current.answers['step-2']).toBe('и второй')
      expect(result.current.currentIndex).toBe(2)
    })
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
