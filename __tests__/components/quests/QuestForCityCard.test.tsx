import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'

import { QuestForCityCard } from '@/components/quests/QuestForCityCard'
import { queueAnalyticsEvent } from '@/utils/analytics'

const mockPush = jest.fn()

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}))

jest.mock('@/utils/analytics', () => ({
  queueAnalyticsEvent: jest.fn(),
}))

const mockImageCardMedia = jest.fn((props: any) => {
  const React = require('react')
  const { View } = require('react-native')
  return React.createElement(View, { testID: 'quest-card-media', ...props })
})

jest.mock('@/components/ui/ImageCardMedia', () => ({
  __esModule: true,
  default: (props: any) => mockImageCardMedia(props),
}))

describe('QuestForCityCard', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockImageCardMedia.mockClear()
  })

  it('tracks the contextual card click before opening the quest', () => {
    const { getByLabelText } = render(
      <QuestForCityCard
        analyticsSource="travel_detail"
        analyticsContextId={42}
        quest={{
          id: 'gomel-palace',
          title: 'Тайны дворца',
          points: 8,
          cityId: '3',
          cityName: 'Гомель',
          lat: 52.43,
          lng: 30.99,
        }}
      />,
    )

    fireEvent.press(getByLabelText('Пройти квест по городу Гомель: Тайны дворца'))

    expect(queueAnalyticsEvent).toHaveBeenCalledWith('quest_card_click', {
      source: 'travel_detail',
      quest_id: 'gomel-palace',
      city_id: '3',
      context_id: '42',
    })
    expect(mockPush).toHaveBeenCalledWith('/quests/3/gomel-palace')
  })

  // #1185: карточка приходила и без cityId — шаблонная строка давала
  // `/quests/undefined/gomel-palace`, и клик уводил пользователя на 404.
  it.each([
    ['city', { id: 'gomel-palace', cityId: undefined }],
    ['quest', { id: undefined, cityId: '3' }],
  ])('does not navigate when %s id is missing', (_case, ids) => {
    const { getByLabelText } = render(
      <QuestForCityCard
        quest={{
          title: 'Тайны дворца',
          points: 8,
          cityName: 'Гомель',
          lat: 52.43,
          lng: 30.99,
          ...(ids as any),
        }}
      />,
    )

    fireEvent.press(getByLabelText('Пройти квест по городу Гомель: Тайны дворца'))

    expect(mockPush).not.toHaveBeenCalled()
    expect(queueAnalyticsEvent).not.toHaveBeenCalledWith('quest_card_click', expect.anything())
  })

  it('passes quest cover with stable web media geometry', () => {
    render(
      <QuestForCityCard
        quest={{
          id: 'krakow-dragon',
          title: 'Тайна Краковского дракона',
          points: 7,
          cityId: '1',
          cityName: 'Краков',
          lat: 50.06,
          lng: 19.94,
          durationMin: 120,
          difficulty: 'easy',
          cover: ' https://metravelprod.s3.amazonaws.com/quests/1/main/cover.png?sig=1 ',
        }}
      />,
    )

    expect(mockImageCardMedia).toHaveBeenCalledTimes(1)
    const props = mockImageCardMedia.mock.calls[0]?.[0]
    expect(props.source).toEqual({
      uri: 'https://metravelprod.s3.amazonaws.com/quests/1/main/cover.png?sig=1',
    })
    expect(props.width).toBe(132)
    expect(props.height).toBe(132)
    expect(props.fit).toBe('contain')
    expect(props.blurBackground).toBe(true)
    expect(props.allowCriticalWebBlur).toBe(true)
    expect(props.revealOnLoadOnly).toBeUndefined()

    // #1115: `optimizeWeb={false}` + `preserveOptimizedWebSrc` запрещали ImageCardMedia
    // и ресайзить URL, и строить srcSet — плитка 132×132 качала обложку ОРИГИНАЛОМ
    // (замер DOM прода 2026-07-28: naturalWidth 1536 при CSS 132, 216–3003 КБ на файл).
    // Путь /quest-cover/** ресайз поддерживает: ?w=160 → 2 КБ, ?w=320 → 7.9 КБ.
    expect(props.optimizeWeb).toBeUndefined()
    expect(props.preserveOptimizedWebSrc).toBeUndefined()

    // #1115: дефолт был `eager`, и рельс из шести карточек далеко под вьюпортом
    // стартовал одновременно с LCP-фото статьи.
    expect(props.loading).toBe('lazy')
  })

  it('lets a caller opt into an eager cover explicitly', () => {
    render(
      <QuestForCityCard
        imageLoading="eager"
        quest={{
          id: 'krakow-dragon',
          title: 'Тайна Краковского дракона',
          points: 7,
          cityId: '1',
          cityName: 'Краков',
          lat: 50.06,
          lng: 19.94,
          cover: 'https://metravelprod.s3.amazonaws.com/quests/1/main/cover.png?sig=1',
        }}
      />,
    )

    expect(mockImageCardMedia.mock.calls[0]?.[0].loading).toBe('eager')
  })

  it('allows callers to defer non-critical quest covers', () => {
    render(
      <QuestForCityCard
        imageLoading="lazy"
        quest={{
          id: 'krakow-dragon',
          title: 'Тайна Краковского дракона',
          points: 7,
          cityId: '1',
          cityName: 'Краков',
          lat: 50.06,
          lng: 19.94,
          durationMin: 120,
          difficulty: 'easy',
          cover: 'https://metravelprod.s3.amazonaws.com/quests/1/main/cover.png?sig=1',
        }}
      />,
    )

    const props = mockImageCardMedia.mock.calls[0]?.[0]
    expect(props.loading).toBe('lazy')
  })

  it('shows the age category in the quest meta row', () => {
    const { getByText } = render(
      <QuestForCityCard
        quest={{
          id: 'vitebsk-teens',
          title: 'Город как галерея',
          points: 8,
          cityId: '13',
          cityName: 'Витебск',
          lat: 55.19,
          lng: 30.2,
          durationMin: 105,
          difficulty: 'medium',
          tags: ['teens', 'age-11-14'],
        }}
      />,
    )

    expect(getByText('11-14 лет')).toBeTruthy()
  })

  it('asks to clarify age when a child quest has only the generic kids tag', () => {
    const { getByText, queryByText } = render(
      <QuestForCityCard
        quest={{
          id: 'mogilev-kids',
          title: 'Трубач Могислав будит город',
          points: 6,
          cityId: '7',
          cityName: 'Могилёв',
          lat: 53.9,
          lng: 30.3,
          tags: ['kids', 'family'],
        }}
      />,
    )

    expect(getByText('Уточнить возраст')).toBeTruthy()
    expect(queryByText('Для детей')).toBeNull()
  })
})
