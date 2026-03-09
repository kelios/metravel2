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

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({
    width: 390,
    height: 1000,
    isPhone: true,
    isLargePhone: false,
  }),
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

  it('keeps hero slider height at least 70 percent of the viewport on mobile', async () => {
    const travel: any = {
      id: 2,
      name: 'Tall mobile hero',
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

    let tree: renderer.ReactTestRenderer
    await act(async () => {
      tree = renderer.create(
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

    const heroSection = tree!.root.findByProps({ testID: 'travel-details-hero' })
    const sliderContainer = heroSection.findAll(
      (node) => node.props?.style && Array.isArray(node.props.style) && node.props.style.some((style: any) => style?.height === 700),
    )[0]

    expect(sliderContainer).toBeTruthy()
  })
})
