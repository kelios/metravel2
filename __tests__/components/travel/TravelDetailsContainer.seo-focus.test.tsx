/**
 * @jest-environment jsdom
 */

import React from 'react'
import { act } from 'react-test-renderer'
import { render } from '@testing-library/react-native'

const mockSetOptions = jest.fn()
const mockUseIsFocused = jest.fn(() => false)

jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => mockUseIsFocused(),
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

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    isAuthenticated: false,
    isLoading: false,
  }),
}))

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({ isMobile: false, width: 1440 }),
}))

jest.mock('@/hooks/useKeyboardNavigation', () => ({
  useAccessibilityAnnounce: () => ({ announcement: '', priority: 'polite' }),
}))

jest.mock('@/hooks/useTdTrace', () => ({
  useTdTrace: () => jest.fn(),
}))

jest.mock('@/hooks/useOfflineTravelCache', () => ({
  useOfflineTravelCache: () => ({ cacheTravel: jest.fn() }),
}))

jest.mock('@/hooks/travel-details', () => ({
  useTravelDetails: () => ({
    data: {
      travel: {
        id: 386,
        name: 'Energylandia - польский Диснейленд.',
        slug: 'energylandia-polskiy-disneylend',
        description: '<p>Путешествие в Energylandia</p>',
        gallery: [],
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
      slug: 'energylandia-polskiy-disneylend',
      isMissingParam: true,
    },
    layout: {
      headerOffset: 0,
      contentHorizontalPadding: 24,
      sideMenuPlatformStyles: {},
    },
    navigation: {
      anchors: {},
      scrollTo: jest.fn(),
      scrollRef: { current: null },
      activeSection: null,
      setActiveSection: jest.fn(),
      forceOpenKey: null,
    },
    performance: {
      lcpLoaded: true,
      setLcpLoaded: jest.fn(),
      sliderReady: true,
      deferAllowed: false,
    },
    menu: {
      closeMenu: jest.fn(),
      animatedX: { interpolate: jest.fn() },
      menuWidthNum: 320,
    },
    scroll: {
      scrollY: { interpolate: jest.fn() },
      contentHeight: 0,
      viewportHeight: 0,
      handleContentSizeChange: jest.fn(),
      handleLayout: jest.fn(),
    },
  }),
}))

import TravelDetailsContainer from '@/components/travel/details/TravelDetailsContainer'

describe('TravelDetailsContainer SEO focus guard', () => {
  beforeAll(() => {
    const RN = require('react-native')
    RN.Platform.OS = 'web'
    RN.Platform.select = (obj: Record<string, unknown>) => obj.web || obj.default
  })

  beforeEach(() => {
    jest.useFakeTimers()
    mockSetOptions.mockClear()
    mockUseIsFocused.mockReturnValue(false)
    document.title = 'Поиск маршрутов и идей путешествий по Беларуси | Metravel'
    document.head.innerHTML = [
      '<meta property="og:title" content="Поиск маршрутов и идей путешествий по Беларуси | Metravel">',
      '<meta property="og:description" content="Search description">',
      '<meta property="og:image" content="https://metravel.by/assets/icons/logo_yellow_512x512.png">',
      '<meta name="twitter:title" content="Поиск маршрутов и идей путешествий по Беларуси | Metravel">',
      '<meta name="twitter:description" content="Search description">',
      '<meta name="twitter:image" content="https://metravel.by/assets/icons/logo_yellow_512x512.png">',
      '<meta name="description" content="Search description">',
      '<link rel="canonical" href="https://metravel.by/search">',
      '<title data-rh="true">Поиск маршрутов и идей путешествий по Беларуси | Metravel</title>',
    ].join('')
  })

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers()
    })
    jest.useRealTimers()
  })

  it('does not overwrite title or head meta when the screen is not focused', () => {
    render(<TravelDetailsContainer />)

    act(() => {
      jest.advanceTimersByTime(1000)
    })

    expect(mockSetOptions).not.toHaveBeenCalled()
    expect(document.title).toBe('Поиск маршрутов и идей путешествий по Беларуси | Metravel')
    expect(
      document.querySelector('meta[property="og:title"]')?.getAttribute('content')
    ).toBe('Поиск маршрутов и идей путешествий по Беларуси | Metravel')
    expect(
      document.querySelector('link[rel="canonical"]')?.getAttribute('href')
    ).toBe('https://metravel.by/search')
  })
})
