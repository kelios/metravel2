/**
 * #1484: петля возврата на экране финала — коллекция города и следующий квест
 * рядом. До этого блока второго действия у продукта не было вовсе.
 */
import React from 'react'
import { Platform } from 'react-native'
import { fireEvent, render } from '@testing-library/react-native'

const mockSendAnalyticsEvent = jest.fn()
const mockScheduleQuestReturnReminder = jest.fn()
const mockCancelQuestReturnReminder = jest.fn()
const mockRememberQuestFinish = jest.fn()
const mockMarkQuestReturnReminderScheduled = jest.fn()
const mockPush = jest.fn()

jest.mock('@/utils/analytics', () => ({
  sendAnalyticsEvent: (...args: any[]) => mockSendAnalyticsEvent(...args),
  queueAnalyticsEvent: jest.fn(),
}))
jest.mock('@/services/notifications', () => ({
  scheduleQuestReturnReminder: (...args: any[]) => mockScheduleQuestReturnReminder(...args),
  cancelQuestReturnReminder: (...args: any[]) => mockCancelQuestReturnReminder(...args),
}))
jest.mock('@/utils/questReturnVisit', () => ({
  rememberQuestFinish: (...args: any[]) => mockRememberQuestFinish(...args),
  markQuestReturnReminderScheduled: (...args: any[]) => mockMarkQuestReturnReminderScheduled(...args),
  questRetentionOwnerId: () => 'guest',
}))
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: (...args: any[]) => mockPush(...args) }),
}))

const mockUseQuestCityCollection = jest.fn()
jest.mock('@/hooks/useQuestCityCollection', () => ({
  useQuestCityCollection: (...args: any[]) => mockUseQuestCityCollection(...args),
}))

import QuestNextStepSection from '@/components/quests/QuestNextStepSection'
import type { QuestMeta } from '@/utils/questAdapters'

const quest = (over: Partial<QuestMeta> & { id: string }): QuestMeta => ({
  title: over.id,
  points: 8,
  cityId: '4',
  cityName: 'Минск',
  lat: 53.9,
  lng: 27.56,
  durationMin: 90,
  ratingAvg: null,
  ratingCount: 0,
  completionsCount: 0,
  isCompletedByMe: false,
  firstCompleter: null,
  ...over,
})

const renderSection = () =>
  render(
    <QuestNextStepSection
      questId="minsk-loshitsa"
      questTitle="Лошицкая усадьба"
      cityId="4"
      cityName="Минск"
      cityLat={53.9023}
      cityLng={27.5619}
      completionFinishedAt={123}
    />,
  )

/**
 * Показ полосы считает `useTrackedImpression`: на web через IntersectionObserver,
 * которого в jsdom нет, а на native — по `onLayout`. Тест работает в native-режиме
 * и сам отдаёт layout, иначе показ не зафиксируется ни там, ни там.
 */
const fireLayout = (node: any) =>
  fireEvent(node, 'layout', { nativeEvent: { layout: { width: 320, height: 48 } } })

describe('QuestNextStepSection', () => {
  const originalPlatform = Platform.OS

  beforeAll(() => {
    ;(Platform as any).OS = 'android'
  })

  afterAll(() => {
    ;(Platform as any).OS = originalPlatform
  })

  beforeEach(() => {
    mockSendAnalyticsEvent.mockReset()
    mockScheduleQuestReturnReminder.mockReset()
    mockScheduleQuestReturnReminder.mockResolvedValue(true)
    mockCancelQuestReturnReminder.mockReset()
    mockRememberQuestFinish.mockReset()
    mockMarkQuestReturnReminderScheduled.mockReset()
    mockRememberQuestFinish.mockResolvedValue({
      ownerId: 'guest',
      questId: 'minsk-loshitsa',
      cityId: '4',
      cityName: 'Минск',
      finishedAt: 123,
    })
    mockPush.mockReset()
    mockUseQuestCityCollection.mockReturnValue({
      collection: { cityId: '4', cityName: 'Минск', completedCount: 1, totalCount: 6, ratio: 1 / 6 },
      suggestions: [
        { quest: quest({ id: 'minsk-cmok', title: 'Цмок' }), distanceKm: 1.2, otherCity: false },
        { quest: quest({ id: 'minsk-dvoriki', title: 'Дворики' }), distanceKm: 4.8, otherCity: false },
      ],
      loading: false,
    })
  })

  it('показывает прогресс коллекции города и следующие квесты с расстоянием', () => {
    const { getByText, getByTestId } = renderSection()

    expect(getByTestId('quest-next-step-section')).toBeTruthy()
    expect(getByText('Коллекция: Минск')).toBeTruthy()
    expect(getByText('Пройдено 1 из 6 квестов')).toBeTruthy()
    expect(getByText('Следующий квест рядом')).toBeTruthy()
    expect(getByText('Цмок')).toBeTruthy()
    expect(getByText('Дворики')).toBeTruthy()
    // Расстояние — форматтер локали, а не самодельный toFixed.
    expect(getByText('1,2 км')).toBeTruthy()
    expect(getByText('4,8 км')).toBeTruthy()
  })

  it('шлёт city_collection_view один раз с числами коллекции', () => {
    const { getByTestId } = renderSection()

    fireLayout(getByTestId('quest-city-collection-4'))
    fireLayout(getByTestId('quest-city-collection-4'))

    const views = mockSendAnalyticsEvent.mock.calls.filter(([name]) => name === 'city_collection_view')
    expect(views).toHaveLength(1)
    expect(views[0][1]).toMatchObject({
      city_id: '4',
      source: 'quest_finale',
      completed_count: 1,
      total_count: 6,
    })
  })

  it('запоминает финиш для события возврата', () => {
    renderSection()

    expect(mockRememberQuestFinish).toHaveBeenCalledTimes(1)
    expect(mockRememberQuestFinish.mock.calls[0][0]).toMatchObject({
      questId: 'minsk-loshitsa',
      ownerId: 'guest',
      cityId: '4',
      cityName: 'Минск',
      finishedAt: 123,
    })
  })

  it('шлёт next_quest_click с позицией и расстоянием карточки', () => {
    const { getByLabelText } = renderSection()

    fireEvent.press(getByLabelText(/Дворики/))

    const clicks = mockSendAnalyticsEvent.mock.calls.filter(([name]) => name === 'next_quest_click')
    expect(clicks).toHaveLength(1)
    expect(clicks[0][1]).toMatchObject({
      quest_id: 'minsk-dvoriki',
      city_id: '4',
      from_quest_id: 'minsk-loshitsa',
      position: 2,
      distance_km: 4.8,
      other_city: false,
    })
    expect(mockPush).toHaveBeenCalledWith('/quests/4/minsk-dvoriki')
  })

  it('прячет блок целиком, когда предлагать нечего', () => {
    mockUseQuestCityCollection.mockReturnValue({ collection: null, suggestions: [], loading: false })
    const { queryByTestId } = renderSection()

    expect(queryByTestId('quest-next-step-section')).toBeNull()
  })

  it('оставляет прогресс города, даже если новых квестов рядом нет', () => {
    mockUseQuestCityCollection.mockReturnValue({
      collection: { cityId: '4', cityName: 'Минск', completedCount: 6, totalCount: 6, ratio: 1 },
      suggestions: [],
      loading: false,
    })
    const { getByText, queryByText } = renderSection()

    expect(getByText('Пройдено 6 из 6 квестов')).toBeTruthy()
    expect(getByText('Все квесты города пройдены')).toBeTruthy()
    expect(queryByText('Следующий квест рядом')).toBeNull()
  })
})
