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

jest.mock('@/hooks/useMenuState', () => ({
  useMenuState: () => ({
    menuOpen: false,
    isMenuOpen: false,
    toggleMenu: jest.fn(),
    openMenu: jest.fn(),
    closeMenu: jest.fn(),
    animatedX: { interpolate: jest.fn(), setValue: jest.fn() },
    animateMenu: jest.fn(),
    menuWidth: 320,
    menuWidthNum: 320,
    openMenuOnDesktop: jest.fn(),
  }),
}))

describe('TravelHeroSection slider background regression (web)', () => {
  jest.setTimeout(30000)

  beforeEach(() => {
    jest.useFakeTimers()
    Platform.OS = 'web'
    Platform.select = (obj: any) => obj.web || obj.default
    mockSliderSpy.mockClear()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('passes blurBackground=false to Slider on web after hero image swap', async () => {
    const travel: any = {
      id: 1,
      name: 'Demo travel',
      gallery: [
        {
          url: 'https://cdn.example.com/img.jpg',
          width: 1200,
          height: 800,
          updated_at: '2025-01-01',
          id: 1,
        },
        {
          url: 'https://cdn.example.com/img-2.jpg',
          width: 1200,
          height: 800,
          updated_at: '2025-01-02',
          id: 2,
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
            isMobile={false}
            renderSlider
            onFirstImageLoad={() => {}}
            sectionLinks={[]}
            onQuickJump={() => {}}
          />
        </Suspense>,
      )

      jest.runAllTimers()
      await Promise.resolve()
    })

    // Step 2: emulate hero image load → component swaps to Slider.
    const img = (tree as any).root.findAll((n: any) => n.type === 'img')?.[0]
    expect(img).toBeTruthy()
    const onLoad = img.props?.onLoad
    expect(typeof onLoad).toBe('function')

    await act(async () => {
      onLoad({ currentTarget: {} })
      jest.runAllTimers()
      await Promise.resolve()
    })

    expect(mockSliderSpy.mock.calls.length).toBeGreaterThan(0)
    const lastArgs = mockSliderSpy.mock.calls[mockSliderSpy.mock.calls.length - 1]
    const lastProps = (lastArgs as any)?.[0]
    expect(lastProps).toBeTruthy()
    expect(lastProps.blurBackground).toBe(false)
  })

  it('marks hero section as gallery anchor on web', async () => {
    const travel: any = {
      id: 2,
      name: 'Anchor test travel',
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
            isMobile={false}
            renderSlider
            onFirstImageLoad={() => {}}
            sectionLinks={[]}
            onQuickJump={() => {}}
          />
        </Suspense>,
      )
      jest.runAllTimers()
      await Promise.resolve()
    })

    const galleryAnchors = (tree as any).root.findAllByProps({ 'data-section-key': 'gallery' })
    expect(galleryAnchors.length).toBeGreaterThan(0)
  })
})
