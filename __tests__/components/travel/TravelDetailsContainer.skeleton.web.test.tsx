/**
 * @jest-environment jsdom
 */

import React from 'react'
import { act } from 'react-test-renderer'
import { render } from '@testing-library/react-native'

const mockSetOptions = jest.fn()
const mockPerformanceState = {
  lcpLoaded: false,
  setLcpLoaded: jest.fn(),
  sliderReady: false,
  deferAllowed: false,
  postLcpRuntimeReady: false,
}

jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
  useNavigation: () => ({ setOptions: mockSetOptions }),
}))

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}))

jest.mock('expo-router/head', () => ({
  __esModule: true,
  default: ({ children }: { children?: React.ReactNode }) => children ?? null,
}))

jest.mock('@/components/seo/LazyInstantSEO', () => ({
  __esModule: true,
  default: () => null,
}))

jest.mock('@/hooks/useTdTrace', () => ({
  useTdTrace: () => jest.fn(),
}))

jest.mock('@/hooks/useAccessibilityAnnounce', () => ({
  useAccessibilityAnnounce: () => ({ announcement: '', priority: 'polite' }),
}))

jest.mock('@/hooks/travel-details', () => ({
  useTravelDetails: () => ({
    data: {
      travel: {
        id: 503,
        name: 'Маршрут в Бескидах',
        slug: 'marshrut-v-beskidakh',
        description: '<p>Описание</p>',
        gallery: [],
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
      slug: 'marshrut-v-beskidakh',
      isMissingParam: false,
    },
    layout: {
      headerOffset: 0,
      contentHorizontalPadding: 24,
      sideMenuPlatformStyles: {},
    },
    navigation: {
      anchors: {
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
        comments: { current: null },
      },
      scrollTo: jest.fn(),
      scrollRef: { current: null },
      activeSection: 'gallery',
      setActiveSection: jest.fn(),
      forceOpenKey: null,
    },
    performance: mockPerformanceState,
    menu: {
      closeMenu: jest.fn(),
      animatedX: { interpolate: jest.fn() },
      menuWidthNum: 320,
    },
    scroll: {
      scrollY: { interpolate: jest.fn() },
      contentHeight: 1200,
      viewportHeight: 800,
      handleContentSizeChange: jest.fn(),
      handleLayout: jest.fn(),
    },
  }),
}))

jest.mock('@/components/travel/TravelDetailPageSkeleton', () => ({
  __esModule: true,
  TravelDetailPageSkeleton: () => null,
}))

jest.mock('@/components/travel/CompactSideBarTravel', () => ({
  __esModule: true,
  default: () => null,
}))

jest.mock('@/components/travel/TravelSectionsSheet', () => ({
  __esModule: true,
  default: () => null,
}))

jest.mock('@/components/ui/ReadingProgressBar', () => ({
  __esModule: true,
  default: () => null,
}))

jest.mock('@/components/ui/ScrollToTopButton', () => ({
  __esModule: true,
  default: () => null,
}))

jest.mock('@/components/travel/details/TravelDetailsDeferred', () => ({
  __esModule: true,
  TravelDeferredSections: () => null,
}))

jest.mock('@/components/travel/details/TravelDetailsHero', () => ({
  __esModule: true,
  TravelHeroSection: () => null,
}))

jest.mock('@/utils/rIC', () => ({
  rIC: (cb: () => void) => {
    cb()
    return () => {}
  },
}))

import TravelDetailsContainer from '@/components/travel/details/TravelDetailsContainer'

describe('TravelDetailsContainer skeleton gating (web)', () => {
  beforeAll(() => {
    const RN = require('react-native')
    RN.Platform.OS = 'web'
    RN.Platform.select = (obj: Record<string, unknown>) => obj.web || obj.default
  })

  beforeEach(() => {
    jest.useFakeTimers()
    mockPerformanceState.lcpLoaded = false
    mockPerformanceState.sliderReady = false
    mockPerformanceState.deferAllowed = false
    mockPerformanceState.postLcpRuntimeReady = false
  })

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers()
    })
    jest.useRealTimers()
  })

  it('keeps the skeleton overlay visible until LCP is ready', () => {
    const { UNSAFE_getByProps, rerender } = render(<TravelDetailsContainer />)

    const overlayBefore = UNSAFE_getByProps({ testID: 'travel-details-skeleton-overlay' })
    expect(overlayBefore.props['aria-hidden']).toBe(false)

    mockPerformanceState.lcpLoaded = true
    mockPerformanceState.sliderReady = true
    mockPerformanceState.deferAllowed = true
    mockPerformanceState.postLcpRuntimeReady = true

    rerender(<TravelDetailsContainer />)

    act(() => {
      jest.advanceTimersByTime(300)
    })

    const overlayAfter = UNSAFE_getByProps({ testID: 'travel-details-skeleton-overlay' })
    expect(overlayAfter.props['aria-hidden']).toBe(true)
  })
})
