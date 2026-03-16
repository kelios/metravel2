/**
 * @jest-environment jsdom
 */

import React, { Suspense } from 'react'
import renderer, { act } from 'react-test-renderer'

import { Platform } from 'react-native'
import { __testables } from '@/components/travel/details/TravelDetailsHero'
import { useTravelHeroState } from '@/hooks/useTravelHeroState'

const mockSliderSpy: jest.Mock<any, any> = jest.fn((_props: any) => null)
const mockHeroExtrasSpy: jest.Mock<any, any> = jest.fn((_props: any) => null)
const mockHeroFavoriteToggleSpy: jest.Mock<any, any> = jest.fn(
  (_props: any) => null,
)

jest.mock('@/components/travel/Slider.web', () => ({
  __esModule: true,
  default: (props: any) => mockSliderSpy(props),
}))

jest.mock('@/components/travel/details/TravelHeroExtras', () => ({
  __esModule: true,
  TravelHeroExtras: (props: any) => mockHeroExtrasSpy(props),
  default: (props: any) => mockHeroExtrasSpy(props),
}))

jest.mock('@/components/travel/details/TravelHeroFavoriteToggle', () => ({
  __esModule: true,
  TravelHeroFavoriteToggle: (props: any) => mockHeroFavoriteToggleSpy(props),
  default: (props: any) => mockHeroFavoriteToggleSpy(props),
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

jest.mock('@/hooks/useTravelHeroState', () => ({
  useTravelHeroState: jest.fn(),
}))

const mockUseTravelHeroState = useTravelHeroState as jest.MockedFunction<typeof useTravelHeroState>

describe('TravelHeroSection slider background regression (web)', () => {
  jest.setTimeout(30000)

  beforeEach(() => {
    jest.useFakeTimers()
    Platform.OS = 'web'
    Platform.select = (obj: any) => obj.web || obj.default
    mockSliderSpy.mockClear()
    mockHeroExtrasSpy.mockClear()
    mockHeroFavoriteToggleSpy.mockClear()
    mockUseTravelHeroState.mockReset()
    mockUseTravelHeroState.mockReturnValue({
      firstImg: {
        src: 'https://cdn.example.com/img.jpg',
        blurhash: null,
      },
      heroHeight: 720,
      galleryImages: [
        { id: '1', src: 'https://cdn.example.com/img.jpg', width: 1200, height: 800, alt: 'Demo travel' },
        { id: '2', src: 'https://cdn.example.com/img-2.jpg', width: 1200, height: 800, alt: 'Demo travel' },
      ],
      heroSliderImages: [
        { id: '1', src: 'https://cdn.example.com/img.jpg', width: 1200, height: 800, alt: 'Demo travel' },
        { id: '2', src: 'https://cdn.example.com/img-2.jpg', width: 1200, height: 800, alt: 'Demo travel' },
      ],
      heroAlt: 'Demo travel',
      aspectRatio: 1200 / 800,
      setHeroContainerWidth: jest.fn(),
      heroContainerWidth: 960,
      webHeroLoaded: true,
      overlayUnmounted: false,
      isOverlayFading: false,
      handleWebHeroLoad: jest.fn(),
      handleSliderImageLoad: jest.fn(),
      extrasReady: true,
      sliderUpgradeAllowed: true,
    } as any)
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('passes blurBackground=true to Slider on web immediately after hero runtime is ready', async () => {
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

    expect(mockSliderSpy).toHaveBeenCalled()

    const heroSliderContainer = (tree as any).root.findByProps({
      testID: 'travel-details-hero-slider-container',
    })
    expect(heroSliderContainer).toBeTruthy()
    expect(typeof heroSliderContainer.props?.onClick).toBe('function')

    expect(mockSliderSpy.mock.calls.length).toBeGreaterThan(0)
    const lastArgs = mockSliderSpy.mock.calls[mockSliderSpy.mock.calls.length - 1]
    const lastProps = (lastArgs as any)?.[0]
    expect(lastProps).toBeTruthy()
    expect(lastProps.blurBackground).toBe(true)
    expect(lastProps.preloadCount).toBe(1)
  })

  it('keeps the first hero click pending until slider runtime becomes ready', async () => {
    const travel: any = {
      id: 11,
      name: 'Deferred activation travel',
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

    mockUseTravelHeroState
      .mockReturnValueOnce({
        firstImg: {
          src: 'https://cdn.example.com/img.jpg',
          blurhash: null,
        },
        heroHeight: 720,
        galleryImages: [
          { id: '1', src: 'https://cdn.example.com/img.jpg', width: 1200, height: 800, alt: 'Demo travel' },
          { id: '2', src: 'https://cdn.example.com/img-2.jpg', width: 1200, height: 800, alt: 'Demo travel' },
        ],
        heroAlt: 'Demo travel',
        aspectRatio: 1200 / 800,
        setHeroContainerWidth: jest.fn(),
        heroContainerWidth: 960,
        webHeroLoaded: true,
        overlayUnmounted: false,
        isOverlayFading: false,
        handleWebHeroLoad: jest.fn(),
        handleSliderImageLoad: jest.fn(),
        extrasReady: true,
        sliderUpgradeAllowed: false,
      } as any)
      .mockReturnValueOnce({
        firstImg: {
          src: 'https://cdn.example.com/img.jpg',
          blurhash: null,
        },
        heroHeight: 720,
        galleryImages: [
          { id: '1', src: 'https://cdn.example.com/img.jpg', width: 1200, height: 800, alt: 'Demo travel' },
          { id: '2', src: 'https://cdn.example.com/img-2.jpg', width: 1200, height: 800, alt: 'Demo travel' },
        ],
        heroAlt: 'Demo travel',
        aspectRatio: 1200 / 800,
        setHeroContainerWidth: jest.fn(),
        heroContainerWidth: 960,
        webHeroLoaded: true,
        overlayUnmounted: false,
        isOverlayFading: false,
        handleWebHeroLoad: jest.fn(),
        handleSliderImageLoad: jest.fn(),
        extrasReady: true,
        sliderUpgradeAllowed: true,
      } as any)

    let tree: renderer.ReactTestRenderer
    await act(async () => {
      tree = renderer.create(
        <Suspense fallback={null}>
          <__testables.TravelHeroSection
            travel={travel}
            anchors={anchors}
            isMobile={false}
            renderSlider={false}
            onFirstImageLoad={() => {}}
            sectionLinks={[]}
            onQuickJump={() => {}}
          />
        </Suspense>,
      )

      jest.runAllTimers()
      await Promise.resolve()
    })

    const heroSliderContainer = (tree as any).root.findByProps({
      testID: 'travel-details-hero-slider-container',
    })

    await act(async () => {
      heroSliderContainer.props.onClick()
      jest.runAllTimers()
      await Promise.resolve()
    })

    await act(async () => {
      ;(tree as any).update(
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

    expect(mockSliderSpy.mock.calls.length).toBeGreaterThan(0)
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

  it('renders hero enhancers immediately once the critical hero shell is shown', async () => {
    const travel: any = {
      id: 3,
      name: 'Enhancer test travel',
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
            isMobile={false}
            renderSlider
            onFirstImageLoad={() => {}}
            sectionLinks={[{ key: 'map', label: 'Карта маршрута', icon: 'map' }]}
            onQuickJump={() => {}}
          />
        </Suspense>,
      )

      jest.advanceTimersByTime(50)
      await Promise.resolve()
    })

    expect(mockHeroExtrasSpy).toHaveBeenCalled()
    expect(mockHeroFavoriteToggleSpy).toHaveBeenCalled()
  })

  it('does not mount Slider on web when hero has only one image', async () => {
    mockUseTravelHeroState.mockReturnValueOnce({
      firstImg: {
        url: 'https://cdn.example.com/img.jpg',
        width: 1200,
        height: 800,
        updated_at: '2025-01-01',
        id: '1',
      },
      heroHeight: 720,
      galleryImages: [
        { id: '1', url: 'https://cdn.example.com/img.jpg', width: 1200, height: 800 },
      ],
      heroSliderImages: [
        { id: '1', url: 'https://cdn.example.com/img.jpg', width: 1200, height: 800 },
      ],
      heroAlt: 'Single image travel',
      aspectRatio: 1200 / 800,
      setHeroContainerWidth: jest.fn(),
      heroContainerWidth: 960,
      webHeroLoaded: true,
      overlayUnmounted: false,
      isOverlayFading: false,
      handleWebHeroLoad: jest.fn(),
      handleSliderImageLoad: jest.fn(),
      extrasReady: true,
      sliderUpgradeAllowed: true,
    } as any)

    const travel: any = {
      id: 4,
      name: 'Single image travel',
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

    expect(mockSliderSpy).not.toHaveBeenCalled()
  })
})
