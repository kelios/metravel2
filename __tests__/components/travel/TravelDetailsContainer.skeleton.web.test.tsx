/**
 * @jest-environment jsdom
 */

import React, { act } from 'react'
import { HelmetProvider } from 'expo-router/vendor/react-helmet-async/lib'
import { QueryClientProvider } from '@tanstack/react-query'
import { readHelmetHead } from '../../helpers/helmetHead'
import { getOnlyHost } from '../../helpers/hostQueries'
import { createRootRegistry } from '../../helpers/rawRootLifecycle'

import { createTestQueryClient } from '@/__tests__/helpers/testQueryClient'

const roots = createRootRegistry()
const mockSetOptions = jest.fn()
const mockTravelHeroSection = jest.fn<any, [any]>(() => null)
let mockGallery: Array<{ id: number; url: string }> = []
const mockPerformanceState = {
  lcpLoaded: false,
  setLcpLoaded: jest.fn(),
  sliderReady: false,
  deferAllowed: false,
  postLcpRuntimeReady: false,
}

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useIsFocused: () => true,
  useNavigation: () => ({ setOptions: mockSetOptions }),
}))

jest.mock('expo-router/head', () => require('../../helpers/helmetHead').createHelmetHeadMock())

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
        gallery: mockGallery,
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

jest.mock('@/components/travel/CompactSideBarTravel', () => ({
  __esModule: true,
  default: () => null,
}))

jest.mock('@/components/travel/TravelSectionsSheet', () => ({
  __esModule: true,
  default: () => null,
}))

jest.mock('@/components/travel/details/sections/TravelRegisterCtaSection', () => ({
  __esModule: true,
  default: () => null,
}))

jest.mock('@/components/travel/details/sections/TravelArticleShareTripCta', () => ({
  __esModule: true,
  default: () => null,
}))

jest.mock('@/components/travel/details/sections/TravelPeerBadgePrompt', () => ({
  __esModule: true,
  default: () => null,
}))

jest.mock('@/components/ui/ReadingProgressBar', () => ({
  __esModule: true,
  default: () => null,
}))

jest.mock('@/components/travel/details/TravelDetailsDeferred', () => ({
  __esModule: true,
  TravelDeferredSections: () => null,
}))

jest.mock('@/components/travel/details/TravelDetailsScrollRuntime', () => ({
  __esModule: true,
  default: () => null,
}))

jest.mock('@/components/travel/details/TravelDetailsHero', () => ({
  __esModule: true,
  TravelHeroSection: (props: any) => mockTravelHeroSection(props),
}))

jest.mock('@/utils/rIC', () => ({
  rIC: (cb: () => void) => {
    cb()
    return () => {}
  },
}))

import TravelDetailsContainer from '@/components/travel/details/TravelDetailsContainer'

const withQueryClient = () => {
  const queryClient = createTestQueryClient()
  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return Wrapper
}

const getLastHeroSectionProps = () =>
  mockTravelHeroSection.mock.calls[mockTravelHeroSection.mock.calls.length - 1]?.[0] as
    | { renderSlider?: boolean }
    | undefined

describe('TravelDetailsContainer skeleton gating (web)', () => {
  const originalCanUseDOM = HelmetProvider.canUseDOM

  beforeAll(() => {
    HelmetProvider.canUseDOM = false
    const RN = require('react-native')
    RN.Platform.OS = 'web'
    RN.Platform.select = (obj: Record<string, unknown>) => obj.web || obj.default
  })

  afterAll(() => {
    HelmetProvider.canUseDOM = originalCanUseDOM
  })

  beforeEach(() => {
    jest.useFakeTimers()
    mockTravelHeroSection.mockClear()
    mockGallery = []
    mockPerformanceState.lcpLoaded = false
    mockPerformanceState.sliderReady = false
    mockPerformanceState.deferAllowed = false
    mockPerformanceState.postLcpRuntimeReady = false
  })

  afterEach(async () => {
    await roots.cleanup()
    await act(() => {
      jest.runOnlyPendingTimers()
    })
    jest.useRealTimers()
  })

  it('keeps the skeleton overlay visible until LCP is ready', async () => {
    const Wrapper = withQueryClient()
    const tree = roots.createRoot()
    await act(() => {
      tree.render(
        <Wrapper>
          <TravelDetailsContainer />
        </Wrapper>,
      )
    })

    const headings = tree.container.queryAll(node => node.type === 'h1' && node.props['data-testid'] === 'travel-details-title')
    expect(headings).toHaveLength(1)
    expect(headings[0].children).toEqual(['Маршрут в Бескидах'])

    const { scripts } = readHelmetHead()
    expect(scripts).toHaveLength(1)
    expect(scripts[0].id).toBe('travel-article-jsonld')
    expect(JSON.parse(scripts[0].textContent ?? '')['@graph']).toEqual(expect.arrayContaining([
      expect.objectContaining({ '@type': 'Article', headline: 'Маршрут в Бескидах' }),
    ]))

    expect(tree.container.queryAll(node => node.props.testID === 'travel-details-skeleton-overlay')).toHaveLength(1)
    const overlayBefore = getOnlyHost(tree.container, node => node.props.testID === 'travel-details-skeleton-overlay')
    expect(overlayBefore.props.style.visibility).toBe('visible')
    expect(overlayBefore.props.inert).toBe(true)

    mockPerformanceState.lcpLoaded = true
    mockPerformanceState.sliderReady = true
    mockPerformanceState.deferAllowed = true
    mockPerformanceState.postLcpRuntimeReady = true

    await act(() => {
      tree.render(
        <Wrapper>
          <TravelDetailsContainer />
        </Wrapper>,
      )
    })

    await act(() => {
      jest.advanceTimersByTime(300)
    })

    const overlayAfter = getOnlyHost(tree.container, node => node.props.testID === 'travel-details-skeleton-overlay')
    expect(overlayAfter.props.style.visibility).toBe('hidden')
    expect(overlayAfter.props.inert).toBeUndefined()
  })

  it('mounts the hero slider on web before LCP so media can preload under the LCP overlay', async () => {
    const Wrapper = withQueryClient()
    const tree = roots.createRoot()
    await act(() => {
      tree.render(
        <Wrapper>
          <TravelDetailsContainer />
        </Wrapper>,
      )
    })

    expect(getLastHeroSectionProps()?.renderSlider).toBe(true)

    mockPerformanceState.lcpLoaded = true
    mockPerformanceState.sliderReady = false
    mockPerformanceState.deferAllowed = true
    mockPerformanceState.postLcpRuntimeReady = true

    await act(() => {
      tree.render(
        <Wrapper>
          <TravelDetailsContainer />
        </Wrapper>,
      )
    })

    expect(getLastHeroSectionProps()?.renderSlider).toBe(true)
  })

  it('re-reads navigator on actual container rerender before the 500ms visual backstop', async () => {
    const flag = Object.getOwnPropertyDescriptor(navigator, 'webdriver')
    Object.defineProperty(navigator, 'webdriver', { configurable: true, value: false })
    mockGallery = [{ id: 1, url: 'https://example.com/hero.jpg' }]
    const Wrapper = withQueryClient()
    try {
      const tree = roots.createRoot()
      await act(() => tree.render(<Wrapper><TravelDetailsContainer /></Wrapper>))
      await act(() => { jest.advanceTimersByTime(20) })
      expect(getOnlyHost(tree.container, node => node.props.testID === 'travel-details-skeleton-overlay').props.style.visibility).toBe('visible')
      Object.defineProperty(navigator, 'webdriver', { configurable: true, value: true })
      await act(() => tree.render(<Wrapper><TravelDetailsContainer /></Wrapper>))
      await act(() => { jest.advanceTimersByTime(20) })
      expect(getOnlyHost(tree.container, node => node.props.testID === 'travel-details-skeleton-overlay').props.style.visibility).toBe('hidden')
    } finally {
      if (flag) Object.defineProperty(navigator, 'webdriver', flag)
      else Reflect.deleteProperty(navigator, 'webdriver')
    }
  })
})
