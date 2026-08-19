/**
 * INV2-18 (#1498): воронка прохождения квеста была слепой между «стартом» и
 * «точка засчитана» — на один старт приходилось 1,56 пройденной точки при
 * маршруте в 7–10 точек, и по данным нельзя было сказать, на каком вопросе
 * ломается прохождение.
 *
 * Тесты держат три события, которые отвечают на этот вопрос:
 * `quest_step_view` (дошёл до точки), `quest_answer_submit` (сколько попыток и
 * какие) и `quest_hint` (взял подсказку) — вместе с их правилами схлопывания:
 * просмотр и подсказка считаются один раз на точку, попытка — каждая.
 */
import React from 'react'
import { act, fireEvent, render, renderHook } from '@testing-library/react-native'

const mockQueueAnalyticsEvent = jest.fn()
const mockQuestWizardResponsiveModel = {
  screenW: 390,
  screenH: 844,
  isMobile: true,
  compactNav: true,
  compactDesktopLayout: false,
  useWideInlineLayout: false,
  useWideExcursionsSidebar: false,
}
jest.mock('@/utils/analytics', () => ({
  queueAnalyticsEvent: (...args: any[]) => mockQueueAnalyticsEvent(...args),
}))
jest.mock('@/utils/questAnswerTelemetry', () => ({
  recordQuestAnswerAttempt: jest.fn(),
  flushQuestAnswerAttempts: jest.fn(() => Promise.resolve()),
}))
jest.mock('@/components/quests/hooks/useQuestWizardResponsiveModel', () => ({
  useQuestWizardResponsiveModel: () => mockQuestWizardResponsiveModel,
}))

// Тяжёлые под-секции визарда — карта/экскурсии/финал/офлайн — к воронке шагов
// отношения не имеют.
jest.mock('@/components/quests/questWizardSections', () => ({
  QuestDesktopMapPanel: () => null,
  QuestExcursionsInline: () => null,
  QuestExcursionsSidebar: () => null,
  QuestFinalePanel: () => null,
}))
jest.mock('@/components/quests/useQuestFinaleMedia', () => ({
  useQuestFinaleMedia: () => ({
    frameW: 300,
    videoOk: true,
    setVideoOk: jest.fn(),
    videoUri: undefined,
    posterUri: undefined,
    youtubeEmbedUri: undefined,
    handleVideoError: jest.fn(),
    handleVideoRetry: jest.fn(),
  }),
}))
jest.mock('@/components/quests/useQuestReminder', () => ({ useQuestReminder: jest.fn() }))
jest.mock('@/components/quests/useQuestGeofence', () => ({ useQuestGeofence: jest.fn() }))
jest.mock('@/components/quests/QuestPrintable', () => ({ generatePrintableQuest: jest.fn() }))
jest.mock('@/components/quests/questOfflineMapExport', () => ({
  exportQuestOfflineMap: jest.fn(),
  getQuestOfflineMapPoints: () => [],
  openQuestOfflineMapInApp: jest.fn(),
}))

import { QuestWizard } from '@/components/quests/QuestWizard'
import { useQuestWizardAnalytics } from '@/components/quests/hooks/useQuestWizardAnalytics'
import { buildAnswerChecker } from '@/utils/questAdapters'

const autoPass = () => true

// `any_number` не входит в brute-forceable типы, поэтому неверная попытка не
// ставит паузу (#1428) и следующий ответ на том же шаге проходит сразу.
const makeStep = (id: string, title: string) => ({
  id,
  title,
  location: 'Минск',
  story: `Story ${id}`,
  task: `Task ${id}`,
  hint: `Hint ${id}`,
  lat: 53.9,
  lng: 27.56,
  inputType: 'number' as const,
  answer: buildAnswerChecker('any_number', ''),
})

const intro = {
  id: 'intro',
  title: 'Intro',
  location: '',
  story: 'Начало',
  task: '',
  lat: 53.9,
  lng: 27.56,
  answer: autoPass,
}
const steps = [makeStep('s1', 'Точка 1'), makeStep('s2', 'Точка 2')]
const finale = { story: 'Финал', video: undefined, poster: undefined } as any

const eventsNamed = (name: string) =>
  mockQueueAnalyticsEvent.mock.calls.filter((call) => call[0] === name).map((call) => call[1])

let storageKeySeq = 0

describe('quest funnel events (#1498)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    storageKeySeq += 1
  })

  it('tracks step views, every answer attempt and the hint through the wizard', async () => {
    const { getByLabelText, getByPlaceholderText, getByTestId, getByText } = render(
      <QuestWizard
        title="Тест-квест"
        steps={steps}
        finale={finale}
        intro={intro}
        storageKey={`funnel_test_quest_${storageKeySeq}`}
        questId="test-quest"
        cityId="minsk"
        questNumericId={4242}
      />,
    )

    // Асинхронный load прогресса из AsyncStorage иначе откатит currentIndex.
    await act(async () => {
      await Promise.resolve()
    })

    // Intro — ещё не точка маршрута: просмотр шага не считается.
    expect(eventsNamed('quest_step_view')).toHaveLength(0)

    fireEvent.press(getByText('Начать квест'))
    await act(async () => {
      await Promise.resolve()
    })
    expect(eventsNamed('quest_step_view')).toEqual([
      { quest_id: 'test-quest', step_index: 0 },
    ])
    // Intro — не точка маршрута: «точка засчитана» на нём не отправляется.
    expect(eventsNamed('quest_point_done')).toHaveLength(0)

    // Подсказка: считаем раскрытие, а не каждое нажатие на аккордеон.
    fireEvent.press(getByLabelText('Показать подсказку'))
    fireEvent.press(getByLabelText('Скрыть подсказку'))
    fireEvent.press(getByLabelText('Показать подсказку'))
    expect(eventsNamed('quest_hint')).toEqual([
      { quest_id: 'test-quest', step_index: 0, attempt_no: 0 },
    ])

    // Ввод и нажатие идут отдельными вызовами: обёрнутые в один внешний `act`,
    // они бы не успели прокинуть состояние поля в обработчик проверки.
    const submit = async (answer: string) => {
      fireEvent.changeText(getByPlaceholderText(/Ваш ответ/), answer)
      fireEvent.press(getByTestId('quest-step-check'))
      await act(async () => {
        await Promise.resolve()
      })
    }

    await submit('нет')
    await submit('всё ещё нет')
    expect(eventsNamed('quest_answer_submit')).toEqual([
      { quest_id: 'test-quest', step_index: 0, is_correct: false, attempt_no: 1 },
      { quest_id: 'test-quest', step_index: 0, is_correct: false, attempt_no: 2 },
    ])

    // Верный ответ уходит в `onSubmit` через переворот карточки — по таймеру.
    await submit('7')
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 250))
    })

    expect(eventsNamed('quest_answer_submit')).toHaveLength(3)
    expect(eventsNamed('quest_answer_submit')[2]).toEqual({
      quest_id: 'test-quest',
      step_index: 0,
      is_correct: true,
      attempt_no: 3,
    })
    // Уже существующее событие засчитанной точки осталось на том же индексе.
    expect(eventsNamed('quest_point_done')).toEqual([
      { quest_id: 'test-quest', step_index: 0 },
    ])
    // Переход на следующую точку — второй просмотр, уже с индексом 1.
    expect(eventsNamed('quest_step_view')).toEqual([
      { quest_id: 'test-quest', step_index: 0 },
      { quest_id: 'test-quest', step_index: 1 },
    ])
  })

  // Гость, упёршийся в гейт регистрации, стоит на следующей точке, но видит
  // вместо неё гейт. Просмотр этой точке не засчитывается — иначе провал на
  // гейте стал бы неотличим от провала на самом вопросе.
  it('does not count a step view behind the guest gate', async () => {
    const { getByPlaceholderText, getByTestId, getByText } = render(
      <QuestWizard
        title="Тест-квест"
        steps={steps}
        finale={finale}
        intro={intro}
        storageKey={`funnel_gate_quest_${storageKeySeq}`}
        questId="test-quest"
        cityId="minsk"
        questNumericId={4243}
        guestMode
        guestFreeSteps={1}
      />,
    )

    await act(async () => {
      await Promise.resolve()
    })

    fireEvent.press(getByText('Начать квест'))
    await act(async () => {
      await Promise.resolve()
    })
    expect(eventsNamed('quest_step_view')).toEqual([
      { quest_id: 'test-quest', step_index: 0 },
    ])

    fireEvent.changeText(getByPlaceholderText(/Ваш ответ/), '7')
    fireEvent.press(getByTestId('quest-step-check'))
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 250))
    })

    // Гейт на экране вместо карточки следующей точки.
    expect(getByTestId('quest-guest-gate')).toBeTruthy()
    expect(eventsNamed('quest_guest_gate_view')).toHaveLength(1)
    expect(eventsNamed('quest_step_view')).toEqual([
      { quest_id: 'test-quest', step_index: 0 },
    ])
  })
})

describe('useQuestWizardAnalytics (#1498)', () => {
  const baseParams = {
    questId: 'test-quest',
    cityId: 'minsk',
    onRealStep: true,
    stepIndex: 0,
    stepVisible: true,
    questFinished: false,
    questCompleted: false,
    partiallyCompleted: false,
    finishedEarly: false,
    passedCount: 0,
    stepsCount: 3,
    guestGateActive: false,
    guestAnsweredCount: 0,
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  // Возврат к пройденной точке размывал бы кривую доходимости, ради которой
  // событие и заводится: по `quest_step_view` считают, сколько игроков дошло
  // до каждого `step_index`.
  it('counts a step view once per index even after the player walks back', () => {
    const { rerender } = renderHook((props: any) => useQuestWizardAnalytics(props), {
      initialProps: baseParams,
    })
    rerender({ ...baseParams, stepIndex: 1 })
    rerender({ ...baseParams, stepIndex: 0 })
    rerender({ ...baseParams, stepIndex: 1 })

    expect(eventsNamed('quest_step_view')).toEqual([
      { quest_id: 'test-quest', step_index: 0 },
      { quest_id: 'test-quest', step_index: 1 },
    ])
  })

  it('keeps intro out of the funnel', () => {
    renderHook(() => useQuestWizardAnalytics({ ...baseParams, onRealStep: false, stepIndex: -1 }))
    expect(eventsNamed('quest_step_view')).toHaveLength(0)
    expect(eventsNamed('quest_start')).toHaveLength(0)
  })

  // «Сбросить прогресс» не размонтирует визард. `quest_point_done` и
  // `quest_answer_submit` дедупа не имеют и на втором проходе уйдут в любом
  // случае — если не сбросить рефы, к ним не будет ни старта, ни просмотров.
  it('starts the funnel over after a progress reset', () => {
    const { rerender, result } = renderHook((props: any) => useQuestWizardAnalytics(props), {
      initialProps: baseParams,
    })
    expect(eventsNamed('quest_start')).toHaveLength(1)
    expect(eventsNamed('quest_step_view')).toHaveLength(1)

    act(() => {
      result.current.resetFunnelSession()
    })
    // Сброс возвращает игрока на intro, и только потом он стартует заново.
    rerender({ ...baseParams, onRealStep: false, stepIndex: -1 })
    rerender(baseParams)

    expect(eventsNamed('quest_start')).toHaveLength(2)
    expect(eventsNamed('quest_step_view')).toEqual([
      { quest_id: 'test-quest', step_index: 0 },
      { quest_id: 'test-quest', step_index: 0 },
    ])
  })

  it('does not emit answer or hint events without a real step', () => {
    const { result } = renderHook(() =>
      useQuestWizardAnalytics({ ...baseParams, onRealStep: false, stepIndex: -1 }),
    )
    act(() => {
      result.current.trackAnswerSubmitted({ isCorrect: false, attemptNo: 1 })
      result.current.trackHintOpened({ attemptNo: 1 })
    })
    expect(eventsNamed('quest_answer_submit')).toHaveLength(0)
    expect(eventsNamed('quest_hint')).toHaveLength(0)
  })
})
