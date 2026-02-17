/**
 * @jest-environment jsdom
 */

import React, { Suspense } from 'react'
import renderer, { act } from 'react-test-renderer'

import { Platform } from 'react-native'
import { __testables } from '@/components/travel/details/TravelDetailsHero'

const mockSliderSpy: jest.Mock<any, any> = jest.fn((_props: any) => null)

jest.mock('@/components/travel/Slider', () => ({
  __esModule: true,
  default: (props: any) => mockSliderSpy(props),
}))

jest.mock('@/components/travel/AuthorCard', () => ({
  __esModule: true,
  default: () => null,
}))

jest.mock('@/context/FavoritesContext', () => ({
  useFavorites: () => ({
    addFavorite: jest.fn(),
    removeFavorite: jest.fn(),
    isFavorite: () => false,
  }),
}))

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: false, userId: null }),
}))

jest.mock('@/hooks/useRequireAuth', () => ({
  useRequireAuth: () => ({ requireAuth: jest.fn() }),
}))

jest.mock('@/utils/toast', () => ({
  showToast: jest.fn(),
}))

describe('TravelHeroSection mobile image fit', () => {
  beforeEach(() => {
    Platform.OS = 'ios'
    Platform.select = (obj: any) => obj.ios ?? obj.default
    mockSliderSpy.mockClear()
  })

  it('passes fit=contain to Slider on mobile', async () => {
    const travel: any = {
      id: 1,
      name: 'Mobile hero demo',
      gallery: [
        {
          url: 'https://cdn.example.com/img.jpg',
          width: 1200,
          height: 800,
          updated_at: '2025-01-01',
          id: 1,
        },
      ],
      travelAddress: [],
    }

    const anchors: any = {
      gallery: { current: null },
      video: { current: null },
      description: { current: null },
      recommendation: { current: null },
      plus: { current: null },
      minus: { current: null },
      map: { current: null },
      points: { current: null },
      near: { current: null },
      popular: { current: null },
      excursions: { current: null },
    }

    await act(async () => {
      renderer.create(
        <Suspense fallback={null}>
          <__testables.TravelHeroSection
            travel={travel}
            anchors={anchors}
            isMobile
            renderSlider
            onFirstImageLoad={() => {}}
            sectionLinks={[]}
            onQuickJump={() => {}}
          />
        </Suspense>,
      )
      await Promise.resolve()
    })

    expect(mockSliderSpy.mock.calls.length).toBeGreaterThan(0)
    const lastProps = mockSliderSpy.mock.calls[mockSliderSpy.mock.calls.length - 1]?.[0]
    expect(lastProps).toBeTruthy()
    expect(lastProps.fit).toBe('contain')
  })
})
