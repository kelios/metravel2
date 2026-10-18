jest.mock('@/hooks/useQuestContentLocale', () => ({ useQuestContentLocale: () => 'en' }))
import React from 'react'
import { StyleSheet } from 'react-native'
import { render } from '@testing-library/react-native'

import { TravelsForQuestSection } from '@/components/quests/TravelsForQuestSection'

// Раскладку секции решает ширина вьюпорта, а не платформа.
let mockResponsive: { isHydrated: boolean; isMobile: boolean } = {
  isHydrated: true,
  isMobile: false,
}

jest.mock('@/hooks/useResponsive', () => {
  const actual = jest.requireActual('@/hooks/useResponsive')
  return {
    ...actual,
    useResponsive: () => ({ ...actual.useResponsive(), ...mockResponsive }),
  }
})

const mockUnifiedTravelCard = jest.fn((props: any) => {
  const { View, Text } = require('react-native')
  return React.createElement(View, { testID: props.testID },
    React.createElement(Text, null, props.renderText ? props.renderText(props.title) : props.title),
    React.createElement(Text, null, props.renderText ? props.renderText(props.metaText) : props.metaText))
})

jest.mock('@/components/ui/UnifiedTravelCard', () => ({
  __esModule: true,
  default: (props: any) => mockUnifiedTravelCard(props),
}))

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}))

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => ({
    text: '#111827',
    textMuted: '#6b7280',
    surface: '#ffffff',
  }),
}))

jest.mock('@/hooks/useTravelsForQuest', () => ({
  useTravelsForQuest: () => ({
    loading: false,
    matches: [
      {
        travel: {
          id: 196,
          name: 'Маршрут по Ошмянам',
          slug: 'oshmyany-route',
          cityName: 'Ошмяны',
          countryName: 'Беларусь',
          travel_image_thumb_url:
            'https://metravel.by/travel-image/958/conversions/photo-thumb_200.jpg',
        },
        score: 100,
        distanceKm: 1,
      },
    ],
  }),
}))

describe('TravelsForQuestSection', () => {
  beforeEach(() => {
    mockUnifiedTravelCard.mockClear()
    mockResponsive = { isHydrated: true, isMobile: false }
  })

  // #1414: потолок ширины карточки снимается только на узкой раскладке, и
  // только ПОСЛЕ гидратации. До неё `useResponsive` отдаёт SSR-снимок нулевой
  // ширины, который проходит проверку `isMobile`, — без гейта десктопный первый
  // кадр рисовал бы карточки во всю ширину ряда и следующий кадр возвращал их к
  // 320 (CLS #1282).
  describe('ширина карточки', () => {
    const renderCardWrapper = () => {
      const { getByTestId } = render(
        <TravelsForQuestSection cityName="Ошмяны" countryName="Беларусь" />,
      )
      return StyleSheet.flatten(getByTestId('quest-travel-card-slot-196').props.style)
    }

    it('держит потолок 320 на широкой раскладке', () => {
      expect(renderCardWrapper()).toMatchObject({ maxWidth: 320 })
    })

    it('отдаёт карточке весь ряд на узкой раскладке', () => {
      mockResponsive = { isHydrated: true, isMobile: true }
      expect(renderCardWrapper().maxWidth).toBeUndefined()
    })

    it('до гидратации остаётся на широкой раскладке, а не на нулевой ширине', () => {
      mockResponsive = { isHydrated: false, isMobile: true }
      expect(renderCardWrapper()).toMatchObject({ maxWidth: 320 })
    })
  })

  it('uses contain media with one source for the sharp image and blurred fill', () => {
    render(<TravelsForQuestSection cityName="Ошмяны" countryName="Беларусь" />)

    expect(mockUnifiedTravelCard).toHaveBeenCalledTimes(1)
    const props = mockUnifiedTravelCard.mock.calls[0]?.[0]

    expect(props.imageUrl).toBe(
      'https://metravel.by/travel-image/958/conversions/photo-thumb_200.jpg',
    )
    expect(props.mediaFit).toBe('contain')
    // #1221: `optimizeWeb` здесь больше нет — иначе карточка просит conversion-URL
    // без `?w=`, и ownership-роут отвечает мастером с `no-store`.
    expect(props.mediaProps).toEqual({
      blurBackground: true,
      allowCriticalWebBlur: true,
    })
  })
})


describe('#2482 travel editorial language', () => {
  it('marks the actual card title and location in the page locale without changing strings', () => {
    const { Platform } = require('react-native')
    const originalOS = Platform.OS
    Platform.OS = 'web'
    try {
      const tree = render(<TravelsForQuestSection cityName="Ошмяны" countryName="Беларусь" />)
      const parts = tree.UNSAFE_root.findAll((node) => node.props.lang === 'ru')
      expect(parts.some((node) => node.props.children === 'Маршрут по Ошмянам')).toBe(true)
      expect(parts.some((node) => node.props.children === 'Ошмяны')).toBe(true)
      expect(mockUnifiedTravelCard.mock.calls.at(-1)?.[0].title).toBe('Маршрут по Ошмянам')
    } finally { Platform.OS = originalOS }
  })
})
