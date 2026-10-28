/**
 * @jest-environment jsdom
 */

import React, { act } from 'react'
import { cleanup as cleanupNative, render as renderNative } from '@testing-library/react-native'
import { HelmetProvider } from 'expo-router/vendor/react-helmet-async/lib'
import { activeHelmetHeads, readHelmetHead } from '../../helpers/helmetHead'
import { createRootRegistry } from '../../helpers/rawRootLifecycle'

const roots = createRootRegistry()
const mockSetOptions = jest.fn()
const mockUseIsFocused = jest.fn(() => false)

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useIsFocused: () => mockUseIsFocused(),
  useNavigation: () => ({ setOptions: mockSetOptions }),
}))

jest.mock('expo-router/head', () => require('../../helpers/helmetHead').createHelmetHeadMock())

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
    const RN = require('react-native')
    RN.Platform.OS = 'web'
    RN.Platform.select = (options: Record<string, unknown>) => options.web ?? options.default
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

  afterEach(async () => {
    await roots.cleanup()
    await cleanupNative()
    await act(() => {
      jest.runOnlyPendingTimers()
    })
    jest.useRealTimers()
    document.body.innerHTML = ''
  })

  it('does not overwrite title or head meta when the screen is not focused', async () => {
    await act(() => roots.createRoot().render(<TravelDetailsContainer />))

    await act(() => {
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

  it('releases the retained article head writer on blur and restores it on refocus', async () => {
    mockUseIsFocused.mockReturnValue(true)
    const articleCanonical = 'https://metravel.by/travels/energylandia-polskiy-disneylend'
    const rendered = roots.createRoot()
    await act(() => rendered.render(<TravelDetailsContainer />))
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(articleCanonical)
    expect(readHelmetHead().scripts.map(script => script.id)).toEqual(['travel-article-jsonld'])

    mockUseIsFocused.mockReturnValue(false)
    await act(() => rendered.render(<TravelDetailsContainer />))

    await act(async () => {
      document.head.querySelector('link[rel="canonical"]')?.setAttribute('href', 'https://metravel.by/search')
      // A late destination Head reconciliation must not wake an offscreen
      // article's actual LazyInstantSEO MutationObserver.
      document.head.insertAdjacentHTML('beforeend', '<meta name="destination-ready" content="search">')
      await Promise.resolve()
    })
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://metravel.by/search')
    expect(activeHelmetHeads.size).toBe(0)

    mockUseIsFocused.mockReturnValue(true)
    await act(() => rendered.render(<TravelDetailsContainer />))
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(articleCanonical)
    expect(readHelmetHead().scripts.map(script => script.id)).toEqual(['travel-article-jsonld'])
  })

  it.each(['android', 'ios'])('preserves the existing native head subtree on %s', async platform => {
    const RN = require('react-native')
    RN.Platform.OS = platform
    RN.Platform.select = (options: Record<string, unknown>) => options[platform] ?? options.native ?? options.default
    await renderNative(<TravelDetailsContainer />)
    expect(readHelmetHead().scripts.map(script => script.id)).toEqual(['travel-article-jsonld'])
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://metravel.by/search')
  })

  it('patches only head metadata without scanning or mutating matching body nodes', async () => {
    mockUseIsFocused.mockReturnValue(true)
    const bodyDecoy = document.createElement('meta')
    bodyDecoy.setAttribute('name', 'description')
    bodyDecoy.setAttribute('content', 'body-decoy')
    document.body.appendChild(bodyDecoy)

    await act(() => roots.createRoot().render(<TravelDetailsContainer />))

    expect(document.head.querySelector('meta[name="description"]')?.getAttribute('content')).toContain(
      'Путешествие в Energylandia',
    )
    expect(bodyDecoy.getAttribute('content')).toBe('body-decoy')
  })

  it('keeps the Helmet travel JSON-LD when it mounts after the preload tag', async () => {
    mockUseIsFocused.mockReturnValue(true)
    document.head.insertAdjacentHTML(
      'beforeend',
      '<script id="travel-article-jsonld" type="application/ld+json">{"source":"preload"}</script>',
    )

    await act(() => roots.createRoot().render(<TravelDetailsContainer />))

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

  // #1622: the static SSG build (removed in #2766; cached pages may still carry
  // it) embedded a bootstrap Article payload marked
  // `data-seo-jsonld="travel-article"` with no `id`.
  // That marker never matched the `#travel-article-jsonld` id selector, so the
  // static copy survived hydration alongside Helmet's managed tag — two
  // Article payloads for one page. The dedupe must also catch this marker.
  it('removes the static SSG Article marker once Helmet mounts its managed copy, without touching FAQ/BreadcrumbList (#1622 contract item 3)', async () => {
    mockUseIsFocused.mockReturnValue(true)
    // Simulate the full static SSG output for a travel page: Article marker
    // plus its sibling FAQPage marker and a marker-less BreadcrumbList — the
    // exact three tags the static SSG build injected per travel page.
    document.head.insertAdjacentHTML(
      'beforeend',
      [
        '<script type="application/ld+json" data-seo-jsonld="travel-article">{"source":"static-ssg","@type":"Article"}</script>',
        '<script type="application/ld+json" data-seo-jsonld="travel-faq">{"@type":"FAQPage"}</script>',
        '<script type="application/ld+json">{"@type":"BreadcrumbList"}</script>',
      ].join(''),
    )

    await act(() => roots.createRoot().render(<TravelDetailsContainer />))

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
