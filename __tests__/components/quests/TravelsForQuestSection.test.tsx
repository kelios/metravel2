import React from 'react'
import { render } from '@testing-library/react-native'

import { TravelsForQuestSection } from '@/components/quests/TravelsForQuestSection'

const mockUnifiedTravelCard = jest.fn((props: any) => {
  const { View } = require('react-native')
  return React.createElement(View, { testID: props.testID })
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
  })

  it('uses contain media with one source for the sharp image and blurred fill', () => {
    render(<TravelsForQuestSection cityName="Ошмяны" countryName="Беларусь" />)

    expect(mockUnifiedTravelCard).toHaveBeenCalledTimes(1)
    const props = mockUnifiedTravelCard.mock.calls[0]?.[0]

    expect(props.imageUrl).toBe(
      'https://metravel.by/travel-image/958/conversions/photo-thumb_200.jpg',
    )
    expect(props.mediaFit).toBe('contain')
    expect(props.mediaProps).toEqual({
      blurBackground: true,
      allowCriticalWebBlur: true,
      optimizeWeb: false,
    })
  })
})
