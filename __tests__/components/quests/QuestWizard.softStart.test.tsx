/**
 * #2905: мягкий старт первой обязательной точки на уровне визарда — подсказка
 * открывается сама и пишет `quest_point_1_hint_open{auto:true}`, «Открыть ответ
 * и идти дальше» показывает ответ тостом, засчитывает точку
 * (`quest_point_done`) и пишет `quest_point_1_revealed`; вторая точка — прежняя.
 */
import React from 'react'
import { act, fireEvent, render } from '@testing-library/react-native'

const mockQueueAnalyticsEvent = jest.fn()
const mockNotifyQuest = jest.fn()

jest.mock('@/utils/analytics', () => ({
  queueAnalyticsEvent: (...args: any[]) => mockQueueAnalyticsEvent(...args),
}))
jest.mock('@/components/quests/questWizardHelpers', () => ({
  ...jest.requireActual('@/components/quests/questWizardHelpers'),
  notifyQuest: (message: string) => mockNotifyQuest(message),
}))
jest.mock('@/utils/consent', () => ({
  CONSENT_KEY: 'metravel_consent_v1',
  readConsent: () => ({ necessary: true, analytics: true, date: '2026-11-01' }),
  writeConsent: jest.fn(),
}))
jest.mock('@/utils/questAnswerTelemetry', () => ({
  recordQuestAnswerAttempt: jest.fn(),
  flushQuestAnswerAttempts: jest.fn(() => Promise.resolve()),
}))
jest.mock('@/components/quests/hooks/useQuestWizardResponsiveModel', () => ({
  ...jest.requireActual('@/components/quests/hooks/useQuestWizardResponsiveModel'),
  useQuestWizardResponsiveModel: () => ({
    screenW: 390,
    screenH: 844,
    isMobile: true,
    headerInScreenRow: true,
    compactNav: true,
    compactDesktopLayout: false,
    useWideInlineLayout: false,
    useWideExcursionsSidebar: false,
  }),
}))
jest.mock('@/components/quests/questWizardSections', () => ({
  QuestDesktopMapPanel: () => null,
  QuestExcursionsInline: () => null,
  QuestExcursionsColumns: ({ children }: { children: React.ReactNode }) => children,
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
jest.mock('@/components/quests/QuestPrintable', () => ({ generatePrintableQuest: jest.fn() }))
jest.mock('@/components/quests/questOfflineMapExport', () => ({
  exportQuestOfflineMap: jest.fn(),
  getQuestOfflineMapPoints: () => [],
  openQuestOfflineMapInApp: jest.fn(),
}))

import { QuestWizard } from '@/components/quests/QuestWizard'
import { translate as i18nT } from '@/i18n'
import { buildAnswerChecker, buildAnswerDisplay } from '@/utils/questAdapters'

const makeStep = (id: string, answerType: string, answerValue: string) => ({
  id,
  title: `Точка ${id}`,
  location: 'Гродно',
  story: `Story ${id}`,
  task: `Task ${id}`,
  hint: `Hint ${id}`,
  lat: 53.68,
  lng: 23.82,
  answer: buildAnswerChecker(answerType, answerValue),
  answerDisplay: buildAnswerDisplay(answerType, answerValue),
})
const intro = {
  id: 'intro',
  title: 'Intro',
  location: '',
  story: 'Начало',
  task: '',
  lat: 53.68,
  lng: 23.82,
  answer: () => true,
}
const steps = [makeStep('s1', 'exact', 'камень'), makeStep('s2', 'exact', 'дерево')]
const finale = { story: 'Финал', video: undefined, poster: undefined } as any

const eventsNamed = (name: string) =>
  mockQueueAnalyticsEvent.mock.calls.filter((call) => call[0] === name).map((call) => call[1])

let storageKeySeq = 0

const settle = () => act(async () => { await Promise.resolve() })

describe('QuestWizard: мягкий старт первой точки (#2905)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    storageKeySeq += 1
    window.localStorage.clear()
  })

  it('открывает подсказку сам, после отказа ведёт к ответу и засчитывает точку с пометкой revealed', async () => {
    const { getByText, getByTestId, getByPlaceholderText, queryByTestId, queryByText } = await render(
      <QuestWizard
        title="Тест-квест"
        steps={steps}
        finale={finale}
        intro={intro}
        storageKey={`soft_start_quest_${storageKeySeq}`}
        questId="test-quest"
        cityId="grodno"
        questNumericId={5151}
      />,
    )
    await settle()
    await fireEvent.press(getByText('Начать квест'))
    await settle()

    // Первая обязательная точка: подсказка уже открыта визардом, не игроком.
    expect(getByText(i18nT('quests:components.quests.questWizardStepCard.podskazka_5453c538', { value1: 'Hint s1' }))).toBeTruthy()
    expect(eventsNamed('quest_point_1_hint_open')).toEqual([{ quest_id: 'test-quest', step_index: 0, auto: true }])
    expect(getByTestId('quest-step-soft-reveal-link')).toBeTruthy()

    await fireEvent.changeText(getByPlaceholderText(/Ваш ответ/), 'кирпич')
    await fireEvent.press(getByTestId('quest-step-check'))
    await settle()
    expect(getByTestId('quest-step-soft-error')).toBeTruthy()
    expect(queryByText(i18nT('quests:components.quests.questWizardStepCard.nevernyy_otvet_22371740'))).toBeNull()

    await fireEvent.press(getByTestId('quest-step-soft-reveal'))
    await settle()

    expect(mockNotifyQuest).toHaveBeenCalledWith(i18nT('quests:components.quests.QuestWizard.answerRevealed', { value1: 'камень' }))
    expect(eventsNamed('quest_point_1_revealed')).toEqual([{ quest_id: 'test-quest', step_index: 0, attempt_no: 1 }])
    expect(eventsNamed('quest_point_done')).toEqual([{ quest_id: 'test-quest', step_index: 0 }])

    // Вторая точка — прежняя механика: подсказка по запросу, «Пропустить» на месте.
    expect(getByText('Task s2')).toBeTruthy()
    expect(queryByTestId('quest-step-soft-reveal-link')).toBeNull()
    expect(getByText(i18nT('quests:components.quests.questWizardStepCard.propustit_0358f4b6'))).toBeTruthy()
    expect(eventsNamed('quest_point_1_hint_open')).toHaveLength(1)
  })

  it('свободный ответ на первой точке: открывать нечего — ни авто-подсказки, ни событий мягкого старта', async () => {
    const freeTextSteps = [makeStep('f1', 'any_text', '{"min_length":10}'), makeStep('f2', 'exact', 'дерево')]
    const { getByText, queryByText, queryByTestId } = await render(
      <QuestWizard
        title="Тест-квест"
        steps={freeTextSteps}
        finale={finale}
        intro={intro}
        storageKey={`soft_start_free_text_${storageKeySeq}`}
        questId="test-quest-free"
        cityId="grodno"
        questNumericId={5152}
      />,
    )
    await settle()
    await fireEvent.press(getByText('Начать квест'))
    await settle()

    expect(getByText('Task f1')).toBeTruthy()
    expect(queryByText(i18nT('quests:components.quests.questWizardStepCard.podskazka_5453c538', { value1: 'Hint f1' }))).toBeNull()
    expect(queryByTestId('quest-step-soft-reveal-link')).toBeNull()
    expect(eventsNamed('quest_point_1_hint_open')).toEqual([])
  })
})
