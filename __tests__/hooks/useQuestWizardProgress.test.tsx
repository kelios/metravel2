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

    const { result } = await renderHook(() =>
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

    await waitFor(async () => {
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
    })

    expect(onProgressChange).not.toHaveBeenCalled()
  })

  it('первый кадр уже стоит на известном шаге, а не на интро (#2270)', async () => {
    // Роут монтирует визард с прочитанным прогрессом; дефолты первого рендера
    // показывали интро, и через кадр карточка шага прыгала (CLS при перезагрузке).
    const renders: number[] = []
    const onProgressChange = jest.fn()
    const { result } = await renderHook(() => {
      const state = useQuestWizardProgress({
        allSteps,
        steps: questSteps,
        storageKey: 'quest_progress_first_frame',
        initialProgress: {
          currentIndex: 1,
          unlockedIndex: 1,
          answers: { intro: 'start' },
          attempts: {},
          hints: {},
          showMap: false,
        },
        onProgressChange,
      })
      renders.push(state.currentIndex)
      return state
    })

    expect(renders[0]).toBe(1)
    expect(result.current.showMap).toBe(false)
    await waitFor(async () => {
      expect(await AsyncStorage.getItem('quest_progress_first_frame')).not.toBeNull()
    })
    expect(renders).not.toContain(0)
    // Стартовое состояние — не правка игрока: на сервер оно не уходит.
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
    const { result } = await renderHook(() =>
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
    const { result } = await renderHook(() =>
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
    const { result } = await renderHook(() =>
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

    await renderHook(() =>
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
    const { result } = await renderHook(() =>
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

    const { result, rerender } = await renderHook(
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
    await act(() => {
      result.current.setCurrentIndex(2)
    })

    // Ответ второго устройства прилетел в ответе сервера.
    await rerender({
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
    const { result } = await renderHook(() =>
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

    const { result } = await renderHook(() =>
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

    const { result, rerender } = await renderHook(
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
    await act(() => {
      result.current.setAnswers((prev) => ({ ...prev, 'step-2': 'castle' }))
      result.current.setCurrentIndex(2)
    })
    expect(result.current.currentIndex).toBe(2)

    // Эхо: тот же storageKey, новый объект initialProgress (стейл current_index=1).
    await rerender({ initialProgress: makeInitial() })

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

    const { result } = await renderHook(() =>
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

    const { result } = await renderHook(() =>
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

    await act(() => {
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

    const { result } = await renderHook(() =>
      useQuestWizardProgress({
        allSteps: [{ id: 'intro' }, ...routeSteps],
        steps: routeSteps,
        storageKey,
      })
    )

    await waitFor(() => expect(result.current.requiredCount).toBe(5))

    await act(() => {
      result.current.setAnswers({ 'p-1': 'a', 'p-2': 'b' })
    })
    await act(() => {
      result.current.markStepSkipped('p-far')
    })

    expect(result.current.questCompleted).toBe(false)

    await act(() => {
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

    const remounted = await renderHook(() =>
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

    const { result } = await renderHook(() =>
      useQuestWizardProgress({
        allSteps: [{ id: 'intro' }, ...routeSteps],
        steps: routeSteps,
        storageKey: 'quest_progress_skip_everything',
      })
    )

    await waitFor(() => expect(result.current.requiredCount).toBe(3))

    await act(() => {
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

    const { result } = await renderHook(() =>
      useQuestWizardProgress({
        allSteps: [{ id: 'intro' }, ...routeSteps],
        steps: routeSteps,
        storageKey,
        onProgressChange,
      })
    )

    await waitFor(() => expect(result.current.requiredCount).toBe(9))

    await act(() => {
      result.current.setAnswers({ 'p-1': 'a' })
    })
    await act(() => {
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
    await act(() => {
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

    const { result } = await renderHook(() =>
      useQuestWizardProgress({
        allSteps: [{ id: 'intro' }, ...routeSteps],
        steps: routeSteps,
        storageKey: 'quest_progress_skip_first',
      })
    )

    await waitFor(() => expect(result.current.requiredCount).toBe(3))

    await act(() => {
      result.current.markStepSkipped('p-1')
    })
    expect(result.current.questCompleted).toBe(false)

    await act(() => {
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

    const { result } = await renderHook(() =>
      useQuestWizardProgress({
        allSteps: [{ id: 'intro' }, ...routeSteps],
        steps: routeSteps,
        storageKey: 'quest_progress_all_skipped_snapshot',
      })
    )

    await waitFor(() => expect(result.current.requiredCount).toBe(2))

    await act(() => {
      routeSteps.forEach((step) => result.current.markStepSkipped(step.id))
    })
    expect(result.current.questFinished).toBe(false)

    await act(() => {
      result.current.setAnswers({ 'p-1': 'a' })
    })

    // Финал открыт, но одна точка из двух порога не берёт — прохождение частичное.
    expect(result.current.questFinished).toBe(true)
    expect(result.current.questCompleted).toBe(false)

    await act(() => {
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

    const { result } = await renderHook(() =>
      useQuestWizardProgress({
        allSteps: [{ id: 'intro' }, ...routeSteps],
        steps: routeSteps,
        storageKey: 'quest_progress_skip_partial',
      })
    )

    await waitFor(() => expect(result.current.requiredCount).toBe(6))

    await act(() => {
      result.current.setAnswers({ 'p-2': 'b', 'p-3': 'c', 'p-4': 'd', 'p-5': 'e' })
    })
    await act(() => {
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

    const { result } = await renderHook(() =>
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

    const { result } = await renderHook(() =>
      useQuestWizardProgress({
        allSteps: [{ id: 'intro' }, ...routeSteps],
        steps: routeSteps,
        storageKey,
      })
    )

    await waitFor(() => expect(result.current.requiredCount).toBe(3))

    // Две точки из трёх берут порог зачёта — финиш на месте остаётся полноценным
    // прохождением, а не частичным.
    await act(() => {
      result.current.setAnswers({ 'p-1': 'a', 'p-2': 'b' })
    })
    await act(() => {
      result.current.finishEarly()
    })

    expect(result.current.questCompleted).toBe(true)

    await waitFor(async () => {
      const saved = await AsyncStorage.getItem(storageKey)
      expect(JSON.parse(saved!)).toMatchObject({ completed: true, earlyFinish: true })
    })

    const remounted = await renderHook(() =>
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

    const { result } = await renderHook(() =>
      useQuestWizardProgress({
        allSteps: [{ id: 'intro' }, ...routeSteps],
        steps: routeSteps,
        storageKey: 'quest_progress_server_skip',
        onProgressChange,
      })
    )

    await waitFor(() => expect(result.current.requiredCount).toBe(2))

    await act(() => {
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

    const { result } = await renderHook(() =>
      useQuestWizardProgress({
        allSteps: [{ id: 'intro' }, ...routeSteps],
        steps: routeSteps,
        storageKey,
      })
    )

    await waitFor(() => expect(result.current.requiredCount).toBe(9))

    await act(() => {
      result.current.setAnswers({ 'p-1': 'a', 'p-2': 'b' })
    })
    await act(() => {
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

    const { result } = await renderHook(() =>
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

    await act(() => {
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

    const { result } = await renderHook(() =>
      useQuestWizardProgress({
        allSteps: [{ id: 'intro' }, ...routeSteps],
        steps: routeSteps,
        storageKey,
        onProgressChange,
      })
    )

    await waitFor(() => expect(result.current.requiredCount).toBe(2))

    await act(() => {
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

    await act(() => {
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
    const { result } = await renderHook(() =>
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

    await act(() => {
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

    const { result } = await renderHook(() =>
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
    const { result } = await renderHook(() =>
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

  it('следующий квест не получает ответы и «Пройден» предыдущего (#1906)', async () => {
    // Игрок закончил квест A и открыл квест B, не перезагружая вкладку. Пока
    // состояние не обнулялось вместе с квестом, save-эффект успевал отправить
    // ответы A уже под ключом B, а монотонный `completed` дарил B чужой зачёт:
    // на проде так засчитались три прохождения (446, 454, 455).
    const checker = () => true
    const routeSteps = [
      { id: 'p-1', answer: checker },
      { id: 'p-2', answer: checker },
    ]
    const owner = { isAuthenticated: true, userId: '182' }
    const keyA = buildQuestProgressStorageKey('gomel-soviet', owner)
    const keyB = buildQuestProgressStorageKey('gomel-spasova', owner)
    const noServerProgress = {
      currentIndex: 0,
      unlockedIndex: 0,
      answers: {},
      attempts: {},
      hints: {},
      showMap: true,
      completed: false,
    }

    const onProgressChange = jest.fn()
    const { result, rerender } = await renderHook(
      ({ storageKey }: { storageKey: string }) =>
        useQuestWizardProgress({
          allSteps: [{ id: 'intro' }, ...routeSteps],
          steps: routeSteps,
          storageKey,
          initialProgress: noServerProgress,
          onProgressChange,
        }),
      { initialProps: { storageKey: keyA } },
    )

    await waitFor(() => expect(result.current.requiredCount).toBe(2))
    await act(() => {
      result.current.setAnswers({ 'p-1': 'лев', 'p-2': 'мост' })
    })
    await waitFor(() => expect(result.current.questCompleted).toBe(true))
    expect(onProgressChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ completed: true }),
    )

    onProgressChange.mockClear()
    await rerender({ storageKey: keyB })

    await waitFor(() => expect(result.current.answers).toEqual({}))
    expect(result.current.questCompleted).toBe(false)
    expect(result.current.currentIndex).toBe(0)
    for (const [payload] of onProgressChange.mock.calls) {
      expect(payload.completed).toBe(false)
      expect(payload.answers).toEqual({})
    }

    // Своё прохождение квеста B засчитанным предыдущим не становится.
    await act(() => {
      result.current.setAnswers({ 'p-1': 'свой ответ' })
    })
    await waitFor(() => {
      expect(onProgressChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ completed: false, answers: { 'p-1': 'свой ответ' } }),
      )
    })

    // Запись квеста A на месте: очистка состояния хранилище не трогает.
    expect(JSON.parse((await AsyncStorage.getItem(keyA))!)).toMatchObject({
      answers: { 'p-1': 'лев', 'p-2': 'мост' },
      completed: true,
    })
    expect(JSON.parse((await AsyncStorage.getItem(keyB))!)).toMatchObject({
      answers: { 'p-1': 'свой ответ' },
      completed: false,
    })
  })

  it('смена владельца того же квеста прохождение не обнуляет (#1906)', async () => {
    // Обратная сторона обнуления: ключ меняется и без смены квеста — гость
    // логинится, а `userId` приезжает в стор позже `isAuthenticated`. Это тот же
    // квест и то же прохождение, и терять набранные ответы нельзя.
    const checker = () => true
    const routeSteps = [
      { id: 'p-1', answer: checker },
      { id: 'p-2', answer: checker },
    ]
    const guestKey = buildQuestProgressStorageKey('golshany-black-monk', { isAuthenticated: false })
    const pendingKey = buildQuestProgressStorageKey('golshany-black-monk', { isAuthenticated: true })
    const userKey = buildQuestProgressStorageKey('golshany-black-monk', { isAuthenticated: true, userId: '184' })

    const { result, rerender } = await renderHook(
      ({ storageKey }: { storageKey: string }) =>
        useQuestWizardProgress({
          allSteps: [{ id: 'intro' }, ...routeSteps],
          steps: routeSteps,
          storageKey,
        }),
      { initialProps: { storageKey: guestKey } },
    )

    await waitFor(() => expect(result.current.requiredCount).toBe(2))
    await act(() => {
      result.current.setAnswers({ 'p-1': 'чёрный монах' })
    })
    await waitFor(() => expect(result.current.answers['p-1']).toBe('чёрный монах'))

    await rerender({ storageKey: pendingKey })
    expect(result.current.answers).toEqual({ 'p-1': 'чёрный монах' })

    await rerender({ storageKey: userKey })
    expect(result.current.answers).toEqual({ 'p-1': 'чёрный монах' })
  })
})

describe('useQuestWizardProgress — гидратация владельца (#2850)', () => {
  type Initial = Parameters<typeof useQuestWizardProgress>[0]['initialProgress']
  const base = 'quest_owner_hydration'
  const guest = buildQuestProgressStorageKey(base, { isAuthenticated: false })
  const pending = buildQuestProgressStorageKey(base, { isAuthenticated: true })
  const userA = buildQuestProgressStorageKey(base, { isAuthenticated: true, userId: 17 })
  const userB = buildQuestProgressStorageKey(base, { isAuthenticated: true, userId: 42 })
  const empty = { currentIndex: 0, unlockedIndex: 0, answers: {}, attempts: {}, hints: {}, showMap: true }
  const record = (answers: Record<string, string>, serverId = 0) => JSON.stringify({
    index: 1, unlocked: 1, answers, attempts: {}, hints: {}, showMap: true, completed: false, serverId,
  })
  const readRecord = async (key: string): Promise<unknown> => JSON.parse((await AsyncStorage.getItem(key)) ?? 'null')
  const mountProgress = (storageKey: string, initialProgress?: Initial, onProgressChange = jest.fn(), onProgressReset = jest.fn()) =>
    renderHook(({ storageKey, initialProgress }: { storageKey: string; initialProgress: Initial }) =>
      useQuestWizardProgress({ allSteps, steps: questSteps, storageKey, initialProgress, onProgressChange, onProgressReset }),
    { initialProps: { storageKey, initialProgress } })

  const holdRead = (keyToHold: string) => {
    const getItem = jest.mocked(AsyncStorage.getItem)
    const original = getItem.getMockImplementation()!
    let release: ((value: string | null) => void) | undefined
    let held = false
    getItem.mockImplementation((key) => {
      if (key === keyToHold && !held) {
        held = true
        return new Promise<string | null>((resolve) => { release = resolve })
      }
      return original(key)
    })
    return {
      release(value: string | null) { expect(release).toBeDefined(); release!(value) },
      restore() { release?.(null); getItem.mockImplementation(original) },
    }
  }

  beforeEach(async () => {
    jest.clearAllMocks()
    await AsyncStorage.clear()
  })

  it.each([false, true])('сохраняет живое прохождение guest → pending → user после await, server seed=%s', async (withServer) => {
    await AsyncStorage.setItem(pending, record({ 'step-2': 'чужая pending-копия' }, 99))
    const initial = withServer ? { ...empty, serverId: 0 } : undefined
    const view = await mountProgress(guest, initial)
    await act(() => {
      view.result.current.setAnswers({ 'step-1': 'dragon' })
      view.result.current.setAttempts({ 'step-1': 2 })
      view.result.current.setHints({ 'step-1': true })
      view.result.current.markStepSkipped('step-2')
      view.result.current.setCurrentIndex(1)
      view.result.current.setUnlockedIndex(2)
      view.result.current.setShowMap(false)
      view.result.current.finishEarly()
    })
    const accumulated = {
      answers: { 'step-1': 'dragon' }, attempts: { 'step-1': 2 }, hints: { 'step-1': true },
      skipped: { 'step-2': true }, earlyFinish: true, showMap: false,
    }
    await view.rerender({ storageKey: pending, initialProgress: initial })
    expect(view.result.current).toMatchObject(accumulated)
    expect(await readRecord(pending)).toMatchObject({ answers: { 'step-2': 'чужая pending-копия' } })
    await view.rerender({ storageKey: userA, initialProgress: initial })
    expect(view.result.current).toMatchObject(accumulated)
    await waitFor(async () => expect(await readRecord(userA)).toMatchObject({ ...accumulated, serverId: 0 }))
  })

  it('при входе объединяет гостевую память со своей user-копией и сервером', async () => {
    await AsyncStorage.setItem(userA, record({ 'step-2': 'castle' }, 57))
    const view = await mountProgress(guest)
    await act(() => view.result.current.setAnswers({ 'step-1': 'dragon' }))
    await view.rerender({ storageKey: pending, initialProgress: undefined })
    await view.rerender({ storageKey: userA, initialProgress: { ...empty, answers: { intro: 'start' }, serverId: 57 } })
    expect(view.result.current.answers).toEqual({ intro: 'start', 'step-1': 'dragon', 'step-2': 'castle' })
    expect(await readRecord(userA)).toMatchObject({ answers: view.result.current.answers, serverId: 57 })
  })

  it('quarantine сохраняет ещё не записанный ответ только вернувшемуся аккаунту A', async () => {
    const initial = { ...empty, answers: { 'step-1': 'old A' }, serverId: 42 }
    const view = await mountProgress(userA, initial)
    const setItem = jest.mocked(AsyncStorage.setItem)
    const original = setItem.getMockImplementation()!
    let completeWrite: (() => Promise<void>) | undefined
    let held = false
    setItem.mockImplementation((key, value) => {
      if (key === userA && !held && JSON.parse(value).answers['step-1'] === 'latest A') {
        held = true
        return new Promise<void>((resolve) => { completeWrite = async () => { await original(key, value); resolve() } })
      }
      return original(key, value)
    })
    try {
      await act(() => view.result.current.setAnswers({ 'step-1': 'latest A' }))
      expect(completeWrite).toBeDefined()
      expect(await readRecord(userA)).toMatchObject({ answers: { 'step-1': 'old A' } })
      await view.rerender({ storageKey: pending, initialProgress: initial })
      expect(view.result.current.answers).toEqual({})
      expect(setItem.mock.calls.filter(([key]) => key === pending)).toHaveLength(0)
      await view.rerender({ storageKey: userA, initialProgress: initial })
      expect(view.result.current.answers).toEqual({ 'step-1': 'latest A' })
      await act(async () => { await completeWrite!() })
      completeWrite = undefined
      expect(await readRecord(userA)).toMatchObject({ answers: { 'step-1': 'latest A' }, serverId: 42 })
    } finally {
      await act(async () => { await completeWrite?.() })
      setItem.mockImplementation(original)
    }
  })

  it.each([false, true])('A → pending → B не принимает прежний initialProgress A, clone=%s', async (clone) => {
    const initialA = { ...empty, answers: { 'step-1': 'private A' }, serverId: 42 }
    await AsyncStorage.setItem(userB, record({ 'step-2': 'own B' }, 57))
    const onChange = jest.fn()
    const view = await mountProgress(userA, initialA, onChange)
    await view.rerender({ storageKey: pending, initialProgress: initialA })
    expect(view.result.current.answers).toEqual({})
    const beforeB = jest.mocked(AsyncStorage.setItem).mock.calls.length
    onChange.mockClear()
    await view.rerender({ storageKey: userB, initialProgress: clone ? { ...initialA } : initialA })
    expect(view.result.current.answers).toEqual({ 'step-2': 'own B' })
    expect(await readRecord(userB)).toMatchObject({ answers: { 'step-2': 'own B' }, serverId: 57 })
    for (const [key, value] of jest.mocked(AsyncStorage.setItem).mock.calls.slice(beforeB)) {
      if (key === userB) expect(JSON.parse(value).answers).not.toHaveProperty('step-1')
    }
    expect(onChange.mock.calls.every(([value]) => !value.answers['step-1'])).toBe(true)
  })

  it('пустой initialProgress A/null не выдаёт отсутствие строки A за отсутствие строки B', async () => {
    const noServerA = { ...empty, serverId: null }
    await AsyncStorage.setItem(userB, record({ 'step-2': 'own B' }, 57))
    const view = await mountProgress(userA, noServerA)
    await view.rerender({ storageKey: pending, initialProgress: noServerA })
    await view.rerender({ storageKey: userB, initialProgress: noServerA })
    expect(view.result.current.answers).toEqual({ 'step-2': 'own B' })
    expect(await readRecord(userB)).toMatchObject({ answers: { 'step-2': 'own B' }, serverId: 57 })
  })

  it.each([guest, `${base}__u:malformed`])('выход/неизвестный owner не наследует private A: %s', async (nextKey) => {
    const initialA = { ...empty, answers: { 'step-1': 'private A' }, serverId: 42 }
    const view = await mountProgress(userA, initialA)
    await view.rerender({ storageKey: nextKey, initialProgress: initialA })
    expect(view.result.current.answers).toEqual({})
    expect(await readRecord(nextKey)).toMatchObject({ answers: {}, serverId: 0 })
  })

  it('чтение прежнего квеста не меняет новую сессию и не выполняет seed-write', async () => {
    const deferred = holdRead(userA)
    const nextKey = buildQuestProgressStorageKey('another_quest', { isAuthenticated: true, userId: 17 })
    await AsyncStorage.setItem(nextKey, record({ 'step-2': 'new quest' }))
    try {
      const view = await mountProgress(userA)
      await view.rerender({ storageKey: nextKey, initialProgress: undefined })
      expect(view.result.current.answers).toEqual({ 'step-2': 'new quest' })
      jest.mocked(AsyncStorage.setItem).mockClear()
      await act(() => deferred.release(record({ 'step-1': 'old quest' })))
      expect(view.result.current.answers).toEqual({ 'step-2': 'new quest' })
      expect(AsyncStorage.setItem).not.toHaveBeenCalled()
    } finally { deferred.restore() }
  })

  it('запоздалое чтение после reset не возвращает стёртое поколение', async () => {
    const deferred = holdRead(userA)
    const initial = { ...empty, answers: { 'step-1': 'old run' }, serverId: 42 }
    const onReset = jest.fn()
    try {
      const view = await mountProgress(userA, initial, jest.fn(), onReset)
      await act(async () => { await view.result.current.resetProgress() })
      expect(onReset).toHaveBeenCalledWith(42)
      await act(() => deferred.release(record({ 'step-1': 'old run' }, 42)))
      expect(view.result.current.answers).toEqual({})
      expect(await readRecord(userA)).toMatchObject({ answers: {}, serverId: 0 })
    } finally { deferred.restore() }
  })

  it('после unmount чтение не пишет snapshot и не уведомляет caller', async () => {
    const deferred = holdRead(userA)
    const onChange = jest.fn()
    try {
      const view = await mountProgress(userA, undefined, onChange)
      await view.unmount()
      jest.mocked(AsyncStorage.setItem).mockClear()
      onChange.mockClear()
      await act(() => deferred.release(record({ 'step-1': 'late' })))
      expect(AsyncStorage.setItem).not.toHaveBeenCalled()
      expect(onChange).not.toHaveBeenCalled()
    } finally { deferred.restore() }
  })

  it('ответ во время текущего storage-чтения выигрывает у его старого snapshot', async () => {
    const deferred = holdRead(userA)
    try {
      const view = await mountProgress(userA, { ...empty, serverId: 0 })
      await act(() => view.result.current.setAnswers({ 'step-1': 'fresh' }))
      const old = { ...JSON.parse(record({ 'step-1': 'old' })), updatedAt: 1, answeredAt: { 'step-1': 1 } }
      await act(() => deferred.release(JSON.stringify(old)))
      expect(view.result.current.answers).toEqual({ 'step-1': 'fresh' })
      expect(await readRecord(userA)).toMatchObject({ answers: { 'step-1': 'fresh' } })
    } finally { deferred.restore() }
  })

  it.each(['switch', 'unmount', 'same'] as const)('задержанный remove не сбрасывает чужую/новую сессию, target=%s', async (target) => {
    const initialA = { ...empty, answers: { 'step-1': 'private A' }, serverId: 42 }
    let currentOwner = '17'
    const resetOwners: string[] = []
    const onReset = jest.fn(() => { resetOwners.push(currentOwner); return Promise.resolve(true) })
    const view = await mountProgress(userA, initialA, jest.fn(), onReset)
    const removeItem = jest.mocked(AsyncStorage.removeItem)
    const original = removeItem.getMockImplementation()!
    let completeRemove: (() => Promise<void>) | undefined
    let released = false
    removeItem.mockImplementationOnce((key) => new Promise<void>((resolve) => {
      completeRemove = async () => {
        if (released) return
        released = true
        await original(key)
        resolve()
      }
    }))
    let resetPromise!: ReturnType<typeof view.result.current.resetProgress>
    try {
      await act(() => { resetPromise = view.result.current.resetProgress() })
      expect(completeRemove).toBeDefined()
      // Consumer useQuestsApi захватывает auth owner при вызове callback.
      expect(resetOwners).toEqual(['17'])
      expect(onReset).toHaveBeenCalledWith(42)
      if (target === 'switch') {
        currentOwner = '42'
        await view.rerender({ storageKey: userB, initialProgress: undefined })
        await act(() => view.result.current.setAnswers({ 'step-2': 'fresh B' }))
      } else if (target === 'unmount') await view.unmount()
      else await view.rerender({ storageKey: userA, initialProgress: initialA })
      jest.mocked(AsyncStorage.setItem).mockClear()
      await act(async () => { await completeRemove!(); await resetPromise })
      const result = await resetPromise
      await expect(result.serverDeletionPending).resolves.toBe(true)
      expect(resetOwners).toEqual(['17'])
      if (target === 'same') {
        expect(view.result.current.answers).toEqual({})
        expect(await readRecord(userA)).toMatchObject({ answers: {}, serverId: 0 })
      } else {
        expect(AsyncStorage.setItem).not.toHaveBeenCalled()
        if (target === 'switch') {
          expect(view.result.current.answers).toEqual({ 'step-2': 'fresh B' })
          expect(await readRecord(userB)).toMatchObject({ answers: { 'step-2': 'fresh B' } })
        }
      }
    } finally {
      await act(async () => { await completeRemove?.() })
      removeItem.mockImplementation(original)
    }
  })

  it.each([null, 57])('quarantine не воскрешает известное старое поколение после server=%s', async (serverId) => {
    const initialA = { ...empty, answers: { 'step-1': 'old run' }, serverId: 42 }
    const view = await mountProgress(userA, initialA)
    await view.rerender({ storageKey: pending, initialProgress: initialA })
    await view.rerender({ storageKey: userA, initialProgress: { ...empty, serverId } })
    expect(view.result.current.answers).toEqual({})
    expect(await readRecord(userA)).toMatchObject({ answers: {}, serverId: serverId ?? 0 })
  })

  it('перед merge отбрасывает старую user-копию, но сохраняет свежую guest-копию без поколения', async () => {
    await AsyncStorage.setItem(userA, record({ 'step-2': 'old run' }, 42))
    const view = await mountProgress(guest)
    await act(() => view.result.current.setAnswers({ 'step-1': 'fresh guest' }))
    await view.rerender({ storageKey: pending, initialProgress: undefined })
    await view.rerender({ storageKey: userA, initialProgress: { ...empty, answers: { intro: 'start' }, serverId: 57 } })
    expect(view.result.current.answers).toEqual({ intro: 'start', 'step-1': 'fresh guest' })
    expect(await readRecord(userA)).toMatchObject({ answers: view.result.current.answers, serverId: 57 })
  })
})

// #2033: «Сбросить» на одном устройстве удаляет серверную строку, а копия на
// другом при первом же сохранении создавала её заново — сброшенное прохождение
// воскресало «Пройденным». Поколение копии — `id` строки, с которой она
// согласована; копия удалённой или заменённой строки стирается, а не доливается.
describe('useQuestWizardProgress — поколение прохождения (#2033)', () => {
  const storageKey = 'quest_progress_lineage__u17'
  const finishedCopy = {
    index: 2,
    unlocked: 2,
    answers: { intro: 'start', 'step-1': 'dragon', 'step-2': 'castle' },
    attempts: {},
    hints: {},
    showMap: false,
    completed: true,
    serverId: 42,
  }
  const emptyServer = {
    currentIndex: 0,
    unlockedIndex: 0,
    answers: {},
    attempts: {},
    hints: {},
    showMap: true,
  }
  const readStored = async () => JSON.parse((await AsyncStorage.getItem(storageKey))!)
  /** Даёт отработать эффектам и записи в хранилище. */
  const settle = async () => act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })

  beforeEach(async () => {
    await AsyncStorage.clear()
  })

  it('копия прохождения, сброшенного на другом устройстве, стирается и не уходит на сервер', async () => {
    await AsyncStorage.setItem(storageKey, JSON.stringify(finishedCopy))
    const onProgressChange = jest.fn()

    const { result } = await renderHook(() =>
      useQuestWizardProgress({
        allSteps,
        steps: questSteps,
        storageKey,
        // Сервер подтвердил: строки 42 больше нет.
        initialProgress: { ...emptyServer, serverId: null },
        onProgressChange,
      })
    )

    await waitFor(async () => expect((await readStored()).answers).toEqual({}))
    await settle()
    expect(result.current.answers).toEqual({})
    expect(result.current.currentIndex).toBe(0)
    expect(result.current.questCompleted).toBe(false)
    expect(await readStored()).toMatchObject({ completed: false, serverId: 0 })
    expect(onProgressChange).not.toHaveBeenCalled()
  })

  it('на месте строки новое прохождение: берётся оно целиком, без ответов и «Пройден» старого', async () => {
    await AsyncStorage.setItem(storageKey, JSON.stringify(finishedCopy))
    const onProgressChange = jest.fn()

    const { result } = await renderHook(() =>
      useQuestWizardProgress({
        allSteps,
        steps: questSteps,
        storageKey,
        initialProgress: {
          ...emptyServer,
          currentIndex: 1,
          unlockedIndex: 1,
          answers: { intro: 'start' },
          serverId: 57,
        },
        onProgressChange,
      })
    )

    await waitFor(async () => expect((await readStored()).serverId).toBe(57))
    await settle()
    expect(result.current.answers).toEqual({ intro: 'start' })
    expect(result.current.currentIndex).toBe(1)
    expect(result.current.questCompleted).toBe(false)
    expect(onProgressChange).not.toHaveBeenCalled()
  })

  it('упавшее чтение копию не стирает: она ждёт сервер со своим поколением', async () => {
    await AsyncStorage.setItem(storageKey, JSON.stringify(finishedCopy))
    const onProgressChange = jest.fn()

    const { result } = await renderHook(() =>
      useQuestWizardProgress({
        allSteps,
        steps: questSteps,
        storageKey,
        // Так роут описывает упавшее чтение: пустой снапшот без поколения.
        initialProgress: { ...emptyServer, serverId: 0 },
        onProgressChange,
      })
    )

    await waitFor(() => expect(result.current.answers['step-2']).toBe('castle'))
    await waitFor(() => expect(onProgressChange).toHaveBeenCalled())
    // Отправку решит писатель: строка 42 жива — доедет, сброшена — выбросится.
    expect(onProgressChange).toHaveBeenLastCalledWith(expect.objectContaining({
      completed: true,
      serverId: 42,
    }))
  })

  it('копия без поколения при подтверждённом отсутствии строки доливается, как раньше (#1803)', async () => {
    const { serverId: _serverId, ...offlineCopy } = finishedCopy
    await AsyncStorage.setItem(storageKey, JSON.stringify(offlineCopy))
    const onProgressChange = jest.fn()

    await renderHook(() =>
      useQuestWizardProgress({
        allSteps,
        steps: questSteps,
        storageKey,
        initialProgress: { ...emptyServer, serverId: null },
        onProgressChange,
      })
    )

    await waitFor(() => expect(onProgressChange).toHaveBeenCalled())
    expect(onProgressChange).toHaveBeenLastCalledWith(expect.objectContaining({
      answers: { intro: 'start', 'step-1': 'dragon', 'step-2': 'castle' },
      completed: true,
      serverId: 0,
    }))
  })

  it('согласованная копия запоминает поколение и отдаёт его со следующим ответом', async () => {
    await AsyncStorage.setItem(storageKey, JSON.stringify({
      index: 1,
      unlocked: 1,
      answers: { intro: 'start' },
      attempts: {},
      hints: {},
      showMap: true,
    }))
    const onProgressChange = jest.fn()

    const { result } = await renderHook(() =>
      useQuestWizardProgress({
        allSteps,
        steps: questSteps,
        storageKey,
        initialProgress: { ...emptyServer, currentIndex: 1, unlockedIndex: 1, answers: { intro: 'start' }, serverId: 42 },
        onProgressChange,
      })
    )

    await waitFor(async () => expect((await readStored()).serverId).toBe(42))

    await act(() => {
      result.current.setAnswers((prev) => ({ ...prev, 'step-1': 'dragon' }))
    })

    await waitFor(() => expect(onProgressChange).toHaveBeenCalled())
    expect(onProgressChange).toHaveBeenLastCalledWith(expect.objectContaining({
      answers: { intro: 'start', 'step-1': 'dragon' },
      serverId: 42,
    }))
  })

  it('сброс на другом устройстве, пока квест открыт: визард переходит к не начатому', async () => {
    const onProgressChange = jest.fn()
    const loaded = {
      currentIndex: 2,
      unlockedIndex: 2,
      answers: { intro: 'start', 'step-1': 'dragon', 'step-2': 'castle' },
      attempts: {},
      hints: {},
      showMap: false,
      completed: true,
      serverId: 42,
    }

    const { result, rerender } = await renderHook(
      ({ initialProgress }: { initialProgress: any }) =>
        useQuestWizardProgress({ allSteps, steps: questSteps, storageKey, initialProgress, onProgressChange }),
      { initialProps: { initialProgress: loaded } },
    )
    await waitFor(() => expect(result.current.answers['step-2']).toBe('castle'))
    onProgressChange.mockClear()

    // Флаш экрана узнал о сбросе: хук синхронизации сообщает «строки нет».
    await rerender({ initialProgress: { ...emptyServer, serverId: null } })

    await waitFor(() => expect(result.current.answers).toEqual({}))
    await settle()
    expect(result.current.currentIndex).toBe(0)
    expect(result.current.questCompleted).toBe(false)
    expect(await readStored()).toMatchObject({ answers: {}, completed: false, serverId: 0 })
    expect(onProgressChange).not.toHaveBeenCalled()
  })

  // #2043: экран, открытый без сети, строку не прочитал — удалить на сервере он
  // может только ту, что помнит стёртая копия. Тост ждёт исхода удаления, экран — нет.
  it('сброс отдаёт экрану поколение стёртой копии и исход удаления на сервере, не дожидаясь его', async () => {
    await AsyncStorage.setItem(storageKey, JSON.stringify(finishedCopy))
    let settleServerDeletion!: (pending: boolean) => void
    const onProgressReset = jest.fn(() => new Promise<boolean>((resolve) => { settleServerDeletion = resolve }))

    const { result } = await renderHook(() =>
      useQuestWizardProgress({
        allSteps,
        steps: questSteps,
        storageKey,
        // Чтение упало: экран строку не знает.
        initialProgress: emptyServer,
        onProgressReset,
      })
    )
    await waitFor(() => expect(result.current.answers['step-1']).toBe('dragon'))

    let reset!: { serverDeletionPending: Promise<boolean> }
    await act(async () => {
      reset = await result.current.resetProgress()
    })

    expect(onProgressReset).toHaveBeenCalledWith(42)
    expect(result.current.answers).toEqual({})
    expect(await readStored()).toMatchObject({ answers: {}, serverId: 0 })

    settleServerDeletion(true)
    await expect(reset.serverDeletionPending).resolves.toBe(true)
  })

  it('сброс здесь: новое прохождение забывает прежнее поколение и узнаёт своё из первой отправки', async () => {
    const onProgressChange = jest.fn()
    const { result, rerender } = await renderHook(
      ({ initialProgress }: { initialProgress: any }) =>
        useQuestWizardProgress({ allSteps, steps: questSteps, storageKey, initialProgress, onProgressChange }),
      {
        initialProps: {
          initialProgress: {
            ...emptyServer,
            currentIndex: 2,
            unlockedIndex: 2,
            answers: { intro: 'start', 'step-1': 'dragon', 'step-2': 'castle' },
            completed: true,
            serverId: 42,
          },
        },
      },
    )
    await waitFor(async () => expect((await readStored()).serverId).toBe(42))

    await act(async () => {
      await result.current.resetProgress()
    })
    expect(await readStored()).toMatchObject({ answers: {}, serverId: 0 })
    // Хук синхронизации подтвердил удаление: копия нового прохождения не стирается.
    await rerender({ initialProgress: { ...emptyServer, serverId: null } })

    await act(() => {
      result.current.setAnswers({ intro: 'start' })
    })
    await waitFor(() => expect(onProgressChange).toHaveBeenLastCalledWith(expect.objectContaining({
      answers: { intro: 'start' },
      serverId: 0,
    })))

    // Ответ на первую отправку: сервер создал строку 57.
    await rerender({ initialProgress: { ...emptyServer, answers: { intro: 'start' }, serverId: 57 } })
    await waitFor(async () => expect((await readStored()).serverId).toBe(57))

    await act(() => {
      result.current.setAnswers((prev) => ({ ...prev, 'step-1': 'dragon' }))
    })
    await waitFor(() => expect(onProgressChange).toHaveBeenLastCalledWith(expect.objectContaining({
      answers: { intro: 'start', 'step-1': 'dragon' },
      serverId: 57,
    })))
    expect(result.current.questCompleted).toBe(false)
  })
})
