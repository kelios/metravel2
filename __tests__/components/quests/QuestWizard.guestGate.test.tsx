/**
 * Интеграционный прогон гостевого гейта QuestWizard (тикет #658).
 *
 * Гость проходит intro → точка 1 → точка 2 и упирается в мягкий гейт
 * (testID="quest-guest-gate") перед 3-й точкой. Кнопки «Войти»/«Зарегистрироваться»
 * дёргают onGuestLogin/onGuestRegister. Аналитика quest_start и
 * quest_guest_gate_view уходят независимо от авторизации.
 */
import React from 'react'
import { act, fireEvent, render } from '@testing-library/react-native'

const mockQueueAnalyticsEvent = jest.fn()
jest.mock('@/utils/analytics', () => ({
  queueAnalyticsEvent: (...args: any[]) => mockQueueAnalyticsEvent(...args),
}))

// Тяжёлые под-секции визарда — карта/экскурсии/финал/офлайн — не нужны для гейта.
jest.mock('@/components/quests/questWizardSections', () => ({
  QuestDesktopMapPanel: () => null,
  QuestExcursionsInline: () => null,
  QuestExcursionsSidebar: () => null,
  QuestFinalePanel: () => null,
  QuestNativeAffiliateSection: () => null,
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

const anyAnswer = () => true

const makeStep = (id: string, title: string) => ({
  id,
  title,
  location: '',
  story: `Story ${id}`,
  task: `Task ${id}`,
  lat: 53.9,
  lng: 27.56,
  answer: anyAnswer,
})

const intro = { id: 'intro', title: 'Intro', location: '', story: 'Начало', task: '', lat: 53.9, lng: 27.56, answer: anyAnswer }
const steps = [makeStep('s1', 'Точка 1'), makeStep('s2', 'Точка 2'), makeStep('s3', 'Точка 3')]

const finale = { story: 'Финал', video: undefined, poster: undefined } as any

describe('QuestWizard guest gate', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('fires quest_start for guests and shows the soft gate after 2 points', async () => {
    const onGuestLogin = jest.fn()
    const onGuestRegister = jest.fn()

    const { getByLabelText, getByRole, getByText, getByTestId, queryByTestId } = render(
      <QuestWizard
        title="Тест-квест"
        steps={steps}
        finale={finale}
        intro={intro}
        storageKey="guest_test_quest"
        questId="test-quest"
        cityId="minsk"
        guestMode
        guestFreeSteps={2}
        onGuestLogin={onGuestLogin}
        onGuestRegister={onGuestRegister}
      />,
    )

    const firedEvents = () => mockQueueAnalyticsEvent.mock.calls.map((call) => call[0])

    // Даём асинхронному load-эффекту прогресса (AsyncStorage) отработать до старта,
    // иначе он сбрасывает currentIndex обратно на 0 после нашего продвижения.
    await act(async () => {
      await Promise.resolve()
    })

    expect(getByTestId('quest-ai-disclosure')).toBeTruthy()
    expect(getByRole('button', { name: 'Начать квест' })).toBeTruthy()

    // intro → точка 1: на intro шаге кнопка «Начать квест» продвигает вперёд.
    await act(async () => {
      fireEvent.press(getByText('Начать квест'))
      await Promise.resolve()
    })
    // quest_start уходит для гостя, как только видна первая настоящая точка.
    expect(firedEvents()).toContain('quest_start')
    expect(queryByTestId('quest-ai-disclosure')).toBeNull()
    expect(
      mockQueueAnalyticsEvent.mock.calls.find((call) => call[0] === 'quest_start')?.[1],
    ).toEqual(expect.objectContaining({ quest_id: 'test-quest', city: 'minsk' }))
    expect(queryByTestId('quest-guest-gate')).toBeNull()

    // Отвечаем на точку 1 (auto-pass кнопка «Далее»).
    await act(async () => {
      fireEvent.press(getByLabelText('Далее'))
    })
    expect(queryByTestId('quest-guest-gate')).toBeNull()

    // Отвечаем на точку 2 → упираемся в мягкий гейт перед точкой 3.
    await act(async () => {
      fireEvent.press(getByLabelText('Далее'))
    })

    expect(getByTestId('quest-guest-gate')).toBeTruthy()
    expect(firedEvents()).toContain('quest_guest_gate_view')
    expect(
      mockQueueAnalyticsEvent.mock.calls.find((call) => call[0] === 'quest_guest_gate_view')?.[1],
    ).toEqual(expect.objectContaining({ quest_id: 'test-quest', passed_count: 2 }))

    // Кнопки гейта дёргают колбэки на /login и /registration.
    fireEvent.press(getByTestId('quest-guest-gate-login'))
    expect(onGuestLogin).toHaveBeenCalled()
    fireEvent.press(getByTestId('quest-guest-gate-register'))
    expect(onGuestRegister).toHaveBeenCalled()
  })
})
