import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'

const mockPush = jest.fn()
const mockRequireAuth = jest.fn()

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}))

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true }),
}))

jest.mock('@/hooks/useRequireAuth', () => ({
  useRequireAuth: () => ({ loginHref: '/login', requireAuth: mockRequireAuth }),
}))

jest.mock('@/context/FavoritesContext', () => ({
  useFavorites: () => ({
    addFavorite: jest.fn(),
    removeFavorite: jest.fn(),
    isFavorite: jest.fn(() => false),
  }),
}))

jest.mock('@/components/travel/TravelStatusButton', () => {
  const { Text } = require('react-native')
  return function TravelStatusButton() {
    return <Text>Travel status</Text>
  }
})

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => ({
    surface: '#fff',
    borderStrong: '#ddd',
    brandSoft: '#eef',
    text: '#111',
    textSecondary: '#555',
    textOnPrimary: '#fff',
    primary: '#267',
    primaryDark: '#145',
    primaryText: '#145',
    primarySoft: '#def',
    danger: '#b00',
  }),
}))

import CTASection from '@/components/travel/CTASection'

describe('CTASection plan-trip action', () => {
  beforeEach(() => {
    mockPush.mockClear()
    mockRequireAuth.mockClear()
  })

  it('opens trip planning with the current travel as source', () => {
    const { getByTestId } = render(
      <CTASection
        travel={{
          id: 42,
          slug: 'naroch-route',
          name: 'Нарочь',
          description: '<p>Озера и стоянки</p>',
          travel_image_thumb_url: '',
          travel_image_thumb_small_url: '',
          url: '/travels/naroch-route',
          youtube_link: '',
          userName: '',
          recommendation: '',
          plus: '',
          minus: '',
          cityName: '',
          countryName: '',
          countUnicIpView: '',
          gallery: [],
          travelAddress: [],
          userIds: '',
          year: '',
          monthName: '',
          number_days: 1,
          companions: [],
          countryCode: '',
        }}
      />,
    )

    fireEvent.press(getByTestId('travel-plan-trip-cta'))

    expect(mockPush).toHaveBeenCalledTimes(1)
    const href = String(mockPush.mock.calls[0][0])
    expect(href).toContain('/trips/plan/create?')
    expect(decodeURIComponent(href)).toContain('source=travel')
    expect(decodeURIComponent(href)).toContain('sourceTravelTitle=Нарочь')
    expect(decodeURIComponent(href)).toContain('https://metravel.by/travels/naroch-route')
  })
})
