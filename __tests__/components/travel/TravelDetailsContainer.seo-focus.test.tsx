/**
 * @jest-environment jsdom
 */

import React from 'react'
import { act } from 'react-test-renderer'
import { render } from '@testing-library/react-native'

const mockSetOptions = jest.fn()
const mockUseIsFocused = jest.fn(() => false)

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useIsFocused: () => mockUseIsFocused(),
  useNavigation: () => ({ setOptions: mockSetOptions }),
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
  cacheTravelOffline: jest.fn(),
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
      postLcpRuntimeReady: false,
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

  it('keeps the Helmet travel JSON-LD when it mounts after the preload tag', async () => {
    mockUseIsFocused.mockReturnValue(true)
    document.head.insertAdjacentHTML(
      'beforeend',
      '<script id="travel-article-jsonld" type="application/ld+json">{"source":"preload"}</script>',
    )

    render(<TravelDetailsContainer />)

    expect(
      document.querySelector('script#travel-article-jsonld')?.textContent,
    ).toContain('preload')

    await act(async () => {
      document.head.insertAdjacentHTML(
        'beforeend',
        '<script id="travel-article-jsonld" type="application/ld+json" data-rh="true">{"source":"helmet"}</script>',
      )
      await Promise.resolve()
    })

    const scripts = document.querySelectorAll(
      'script#travel-article-jsonld[type="application/ld+json"]'
    )
    expect(scripts).toHaveLength(1)
    expect(scripts[0].getAttribute('data-rh')).toBe('true')
    expect(scripts[0].textContent).toContain('helmet')
  })

  // #1622: the SSG build embeds a bootstrap Article payload marked
  // `data-seo-jsonld="travel-article"` with no `id` (scripts/generate-seo-pages.js).
  // That marker never matched the `#travel-article-jsonld` id selector, so the
  // static copy survived hydration alongside Helmet's managed tag — two
  // Article payloads for one page. The dedupe must also catch this marker.
  it('removes the static SSG Article marker once Helmet mounts its managed copy, without touching FAQ/BreadcrumbList (#1622 contract item 3)', async () => {
    mockUseIsFocused.mockReturnValue(true)
    // Simulate the full static SSG output for a travel page: Article marker
    // plus its sibling FAQPage marker and a marker-less BreadcrumbList — the
    // exact three tags scripts/generate-seo-pages.js injects per travel page.
    document.head.insertAdjacentHTML(
      'beforeend',
      [
        '<script type="application/ld+json" data-seo-jsonld="travel-article">{"source":"static-ssg","@type":"Article"}</script>',
        '<script type="application/ld+json" data-seo-jsonld="travel-faq">{"@type":"FAQPage"}</script>',
        '<script type="application/ld+json">{"@type":"BreadcrumbList"}</script>',
      ].join(''),
    )

    render(<TravelDetailsContainer />)

    expect(
      document.querySelector('script[data-seo-jsonld="travel-article"]')?.textContent,
    ).toContain('static-ssg')

    await act(async () => {
      document.head.insertAdjacentHTML(
        'beforeend',
        '<script id="travel-article-jsonld" type="application/ld+json" data-rh="true">{"source":"helmet"}</script>',
      )
      await Promise.resolve()
    })

    const articleScripts = document.querySelectorAll(
      'script#travel-article-jsonld[type="application/ld+json"], script[data-seo-jsonld="travel-article"][type="application/ld+json"]'
    )
    expect(articleScripts).toHaveLength(1)
    expect(articleScripts[0].getAttribute('data-rh')).toBe('true')
    expect(articleScripts[0].textContent).toContain('helmet')

    // The FAQ marker and the marker-less BreadcrumbList must survive the
    // Article dedupe untouched — the ticket explicitly forbids dropping them
    // as collateral damage of a broadened Article selector.
    expect(document.querySelector('script[data-seo-jsonld="travel-faq"]')?.textContent).toContain(
      'FAQPage',
    )
    const allLdJson = document.querySelectorAll('script[type="application/ld+json"]')
    const breadcrumbStillPresent = Array.from(allLdJson).some((node) =>
      (node.textContent || '').includes('BreadcrumbList'),
    )
    expect(breadcrumbStillPresent).toBe(true)
  })
})
