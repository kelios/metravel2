jest.mock('@/hooks/useQuestContentLocale', () => ({ useQuestContentLocale: () => 'en' }))
import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'

import { QuestForCityCard } from '@/components/quests/QuestForCityCard'
import { queueAnalyticsEvent } from '@/utils/analytics'

const mockPush = jest.fn()
let mockMediaVisible = true
const mockMediaViewportRef = { current: null }
const mockMediaViewportOnLayout = jest.fn()

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

jest.mock('@/components/ui/richMediaViewport', () => ({
  useRichMediaVisibility: () => ({
    ref: mockMediaViewportRef,
    visible: mockMediaVisible,
    onLayout: mockMediaViewportOnLayout,
  }),
}))

describe('QuestForCityCard', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockImageCardMedia.mockClear()
    mockMediaVisible = true
  })

  it('tracks the contextual card click before opening the quest', async () => {
    const { getByLabelText } = await render(
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

    await fireEvent.press(getByLabelText('Пройти квест по городу Гомель: Тайны дворца'))

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
  ])('does not navigate when %s id is missing', async (_case, ids) => {
    const { getByLabelText } = await render(
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

    await fireEvent.press(getByLabelText('Пройти квест по городу Гомель: Тайны дворца'))

    expect(mockPush).not.toHaveBeenCalled()
    expect(queueAnalyticsEvent).not.toHaveBeenCalledWith('quest_card_click', expect.anything())
  })

  it('passes quest cover with stable web media geometry', async () => {
    await render(
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
    expect(props.webResponsiveSource).toBeUndefined()

    // #1115: дефолт был `eager`, и рельс из шести карточек далеко под вьюпортом
    // стартовал одновременно с LCP-фото статьи.
    expect(props.loading).toBe('lazy')
  })

  it('uses the square source and responsive ladder without adding a second raster', async () => {
    await render(
      <QuestForCityCard
        quest={{
          id: 'krakow-dragon',
          title: 'Тайна Краковского дракона',
          points: 7,
          cityId: '1',
          cityName: 'Краков',
          lat: 50.06,
          lng: 19.94,
          cover: 'https://metravel.by/quest-cover/1/legacy-landscape.webp',
          squareCoverWebResponsiveSource: {
            src: 'https://metravel.by/quest-cover/1/square-320.webp',
            srcSet: [
              'https://metravel.by/quest-cover/1/square-160.webp 160w',
              'https://metravel.by/quest-cover/1/square-320.webp 320w',
            ].join(', '),
          },
        }}
      />,
    )

    expect(mockImageCardMedia).toHaveBeenCalledTimes(1)
    const props = mockImageCardMedia.mock.calls[0]?.[0]
    expect(props.source).toEqual({
      uri: 'https://metravel.by/quest-cover/1/square-320.webp',
    })
    expect(props.webResponsiveSource).toEqual({
      src: 'https://metravel.by/quest-cover/1/square-320.webp',
      srcSet: [
        'https://metravel.by/quest-cover/1/square-160.webp 160w',
        'https://metravel.by/quest-cover/1/square-320.webp 320w',
      ].join(', '),
      sizes: '132px',
    })
    expect(props.width).toBe(132)
    expect(props.height).toBe(132)
    expect(props.fit).toBe('contain')
    expect(props).not.toHaveProperty('blurSrc')
    expect(props).not.toHaveProperty('blurSource')
    expect(props).not.toHaveProperty('placeholderSrc')
  })

  it('keeps the square source and responsive ladder behind the same viewport gate', async () => {
    mockMediaVisible = false

    await render(
      <QuestForCityCard
        quest={{
          id: 'krakow-dragon',
          title: 'Тайна Краковского дракона',
          points: 7,
          cityId: '1',
          cityName: 'Краков',
          lat: 50.06,
          lng: 19.94,
          cover: 'https://metravel.by/quest-cover/1/legacy-landscape.webp',
          squareCoverWebResponsiveSource: {
            src: 'https://metravel.by/quest-cover/1/square-320.webp',
            srcSet: 'https://metravel.by/quest-cover/1/square-320.webp 320w',
          },
        }}
      />,
    )

    const props = mockImageCardMedia.mock.calls[0]?.[0]
    expect(props.source).toBeNull()
    expect(props.webResponsiveSource).toBeUndefined()
  })

  it('falls back to the legacy cover when the square manifest source is blank', async () => {
    await render(
      <QuestForCityCard
        quest={{
          id: 'krakow-dragon',
          title: 'Тайна Краковского дракона',
          points: 7,
          cityId: '1',
          cityName: 'Краков',
          lat: 50.06,
          lng: 19.94,
          cover: 'https://metravel.by/quest-cover/1/legacy-landscape.webp',
          squareCoverWebResponsiveSource: {
            src: '   ',
            srcSet: 'https://metravel.by/quest-cover/1/square-320.webp 320w',
          },
        }}
      />,
    )

    const props = mockImageCardMedia.mock.calls[0]?.[0]
    expect(props.source).toEqual({
      uri: 'https://metravel.by/quest-cover/1/legacy-landscape.webp',
    })
    expect(props.webResponsiveSource).toBeUndefined()
  })

  it('lets a caller opt into an eager cover explicitly', async () => {
    await render(
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

  it('allows callers to defer non-critical quest covers', async () => {
    await render(
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

  it('shows the age category in the quest meta row', async () => {
    const { getByText } = await render(
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

  it('asks to clarify age when a child quest has only the generic kids tag', async () => {
    const { getByText, queryByText } = await render(
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


it('#2482 marks the quest card title without changing the accessible navigation label', async () => {
  const { Platform } = require('react-native')
  const originalOS = Platform.OS
  Platform.OS = 'web'
  try {
    const tree = await render(<QuestForCityCard quest={{ id: 'palace', cityId: '3', title: 'Тайны дворца', cityName: 'Гомель', points: 4, lat: 52, lng: 30 }} />)
    expect(tree.container.queryAll((node) => node.props.lang === 'ru')
      .some((node) => node.props.children === 'Тайны дворца')).toBe(true)
    expect(tree.getByLabelText('Пройти квест по городу Гомель: Тайны дворца')).toBeTruthy()
  } finally { Platform.OS = originalOS }
})

it('#2830 gives Pressable one flat style object, so Link asChild keeps the card layout', async () => {
  const tree = await render(<QuestForCityCard quest={{ id: 'palace', cityId: '3', title: 'Тайны дворца', cityName: 'Гомель', points: 4, lat: 52, lng: 30 }} />)
  const card = tree.getByRole('link')
  const rawCardProps = mockCardProps.get(card.props.accessibilityLabel)
  expect(rawCardProps).toBeDefined()
  // Slot у `Link asChild` сливает стиль спредом: функция и массив дают пустую карточку.
  expect(typeof rawCardProps.style).toBe('object')
  expect(Array.isArray(rawCardProps.style)).toBe(false)
  expect(rawCardProps.style).toMatchObject({ flexDirection: 'row', borderWidth: 1, padding: 10 })
  const idleBorder = card.props.style.borderColor

  await fireEvent(card, 'hoverIn')
  const hoveredBorder = tree.getByRole('link').props.style.borderColor
  expect(hoveredBorder).not.toBe(idleBorder)
  await fireEvent(tree.getByRole('link'), 'hoverOut')
  expect(tree.getByRole('link').props.style.borderColor).toBe(idleBorder)
})

// Observe the public component input while retaining its normal host rendering.
const captureNative = require('react-native')
const capturedOriginalPressable = captureNative.Pressable
const mockCardProps = new Map<string, any>()
beforeAll(() => {
  captureNative.Pressable = require('react').forwardRef((props: any, ref: any) => {
    const key = props.accessibilityRole === 'link' ? props.accessibilityLabel : null
    if (key) mockCardProps.set(key, props)
    return require('react').createElement(capturedOriginalPressable, { ...props, ref })
  })
})
afterAll(() => { captureNative.Pressable = capturedOriginalPressable })
beforeEach(() => { mockCardProps.clear() })
