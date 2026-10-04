import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import { Platform, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import HomeHero from '@/components/home/HomeHero'
import { queueAnalyticsEvent } from '@/utils/analytics'
import { openExternalUrl, openExternalUrlInNewTab } from '@/utils/externalLinks'

const mockImageCardMedia = jest.fn((props: any) => {
  const React = require('react')
  const { View } = require('react-native')
  return React.createElement(View, { testID: 'mock-image-card-media', ...props })
})

const mockResponsiveState = {
  isPhone: false,
  isLargePhone: false,
  isSmallPhone: false,
  isTablet: false,
  isLargeTablet: false,
  isDesktop: true,
  isPortrait: false,
  width: 1280,
  isHydrated: true,
}

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
}))
jest.mock('@/utils/analytics')
jest.mock('@/utils/externalLinks', () => ({
  openExternalUrl: jest.fn(),
  openExternalUrlInNewTab: jest.fn(),
}))
jest.mock('@/components/ui/ImageCardMedia', () => ({
  __esModule: true,
  default: (props: any) => mockImageCardMedia(props),
  isIOSSafariUserAgent: (userAgent: string, maxTouchPoints = 0) => {
    const normalizedUserAgent = String(userAgent || '')
    const isIOSDevice =
      /iPad|iPhone|iPod/i.test(normalizedUserAgent) ||
      (/Macintosh/i.test(normalizedUserAgent) && maxTouchPoints > 1)
    const isSafari =
      /Safari/i.test(normalizedUserAgent) &&
      !/(Chrome|CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo|GSA|Chromium|Firefox)/i.test(
        normalizedUserAgent,
      )

    return isIOSDevice && isSafari
  },
}))
jest.mock('@/components/home/useHomeViewport', () => ({
  useHomeViewport: () => mockResponsiveState,
}))

const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>
const mockQueueAnalyticsEvent = queueAnalyticsEvent as jest.MockedFunction<
  typeof queueAnalyticsEvent
>

describe('HomeHero Component', () => {
  const mockPush = jest.fn()

  beforeEach(() => {
    Object.assign(mockResponsiveState, {
      isPhone: false,
      isLargePhone: false,
      isSmallPhone: false,
      isTablet: false,
      isLargeTablet: false,
      isDesktop: true,
      isPortrait: false,
      width: 1280,
      isHydrated: true,
    })
    ;(mockUseRouter as jest.Mock).mockReturnValue({ push: mockPush } as any)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should render title correctly', () => {
      const { getByText } = render(<HomeHero />)
      expect(getByText(/Куда поехать/)).toBeTruthy()
    })

    it('should render subtitle correctly', () => {
      const { getByText } = render(<HomeHero />)
      expect(getByText(/Реальные маршруты/)).toBeTruthy()
    })

    it('should render mood cards correctly', () => {
      const { getByText } = render(<HomeHero />)
      expect(getByText('У воды')).toBeTruthy()
    })

    // Note: Feature highlights (За 2 минуты, Личная книга, etc.) are only shown
    // in tablet layout (770-1279px) on web platform. This is tested via E2E tests.
  })

  describe('Button Labels', () => {
    it('should render only "Смотреть маршруты" CTA', () => {
      const { getByText, queryByText } = render(<HomeHero travelsCount={5} />)
      expect(getByText('Смотреть маршруты')).toBeTruthy()
      expect(queryByText('Добавить первую поездку')).toBeNull()
      expect(queryByText('Открыть мою книгу')).toBeNull()
    })
  })

  describe('Navigation', () => {
    it('should navigate to search when clicking "Смотреть маршруты"', () => {
      const { getByText } = render(<HomeHero />)
      const button = getByText('Смотреть маршруты')

      fireEvent.press(button)

      expect(mockPush).toHaveBeenCalledWith('/search')
      expect(mockQueueAnalyticsEvent).toHaveBeenCalledWith(
        'HomeClick_OpenSearch',
      )
    })

    it('native: book cover link goes through the single openExternalUrl decision point (#2144)', () => {
      const { getByLabelText } = render(<HomeHero />)

      fireEvent.press(getByLabelText(/Открыть маршрут недели: Озеро Сорапис/))

      // openExternalUrl opens a site path that has an app screen via
      // expo-router (see the book-cover invariant below), so no own router.push.
      expect(openExternalUrl).toHaveBeenCalledWith(
        'https://metravel.by/travels/ozero-sorapis-krugovoi-marshrut-215-217-kak-doiti-chto-zhdat-po-puti-i-chto-posmotret-riadom?returnTo=%2Fsearch',
        expect.objectContaining({ allowRelative: true }),
      )
      expect(mockPush).not.toHaveBeenCalled()
      expect(openExternalUrlInNewTab).not.toHaveBeenCalled()
    })
  })

  describe('Responsive Design', () => {
    it('should render on different screen sizes', () => {
      const { getByText } = render(<HomeHero />)
      expect(getByText(/Куда поехать/)).toBeTruthy()
    })

    it('keeps compact hero layout on intermediate widths before the book breakpoint', () => {
      Object.assign(mockResponsiveState, {
        isLargeTablet: true,
        isDesktop: false,
        width: 1025,
        isPortrait: true,
      })

      const { getByText } = render(<HomeHero />)

      expect(getByText('Популярные маршруты')).toBeTruthy()
      expect(getByText('Маршрут недели')).toBeTruthy()
    })

    it('lets the tablet media box derive its height from its real flex-column width', () => {
      Object.assign(mockResponsiveState, {
        isDesktop: false,
        isTablet: true,
        isPortrait: true,
        width: 1025,
      })

      render(<HomeHero />)

      const tabletMedia = mockImageCardMedia.mock.calls
        .map(([props]) => props)
        .find((props) => props.loading === 'eager' && props.alt?.includes('Сорапис'))

      expect(tabletMedia?.height).toBeUndefined()
      expect(StyleSheet.flatten(tabletMedia?.style)).toEqual(
        expect.objectContaining({ width: '100%', aspectRatio: 3 / 2 }),
      )
    })

    it('renders every home hero media surface with contain fit and blur backdrop', () => {
      Object.assign(mockResponsiveState, {
        isDesktop: false,
        width: 1025,
        isPortrait: true,
      })

      render(<HomeHero />)

      expect(mockImageCardMedia).toHaveBeenCalled()
      mockImageCardMedia.mock.calls.forEach(([props]) => {
        expect(props.fit).toBe('contain')
        expect(props.blurBackground).toBe(true)
        expect(props.allowCriticalWebBlur).toBe(true)
      })
    })

    it('lets the featured media derive its height from the real container width', () => {
      Object.assign(mockResponsiveState, {
        isDesktop: false,
        isPhone: true,
        isPortrait: true,
        width: 390,
      })

      render(<HomeHero />)

      const featuredMedia = mockImageCardMedia.mock.calls
        .map(([props]) => props)
        .find((props) => props.loading === 'eager' && props.alt?.includes('Сорапис'))

      expect(featuredMedia).toEqual(
        expect.objectContaining({
          fit: 'contain',
        }),
      )
      expect(featuredMedia?.width).toBeUndefined()
      expect(featuredMedia?.height).toBeUndefined()
      expect(StyleSheet.flatten(featuredMedia?.style)).toEqual(
        expect.objectContaining({ width: '100%', aspectRatio: 3 / 2 }),
      )
    })
  })

  describe('Book slider styling', () => {
    it('renders the desktop hero book shell without relying on post-import platform mutation', () => {
      const previousPlatform = Platform.OS
      const previousSelect = Platform.select

      Platform.OS = 'web'
      Platform.select = (options: any) => options.web ?? options.default

      const { getByTestId, getByText } = render(<HomeHero />)

      expect(getByTestId('home-hero-left-page')).toBeTruthy()
      expect(getByText('Популярные маршруты')).toBeTruthy()

      Platform.OS = previousPlatform
      Platform.select = previousSelect
    })
  })

  describe('Accessibility', () => {
    it('should have accessible buttons with proper labels', () => {
      const { getByLabelText } = render(<HomeHero />)
      expect(getByLabelText('Смотреть маршруты')).toBeTruthy()
    })
  })

  describe('book cover links (#2144)', () => {
    it('every metravel book cover href has an app screen, so native opens it in the app', () => {
      const { resolveAppRouteForSiteUrl } = require('@/utils/siteLinks')
      const { BOOK_IMAGES_FOR_TEST } = require('@/components/home/HomeHero')
      const hrefs = BOOK_IMAGES_FOR_TEST.filter((img: any) => img.href).map((img: any) => img.href)
      expect(hrefs.length).toBeGreaterThan(0)
      hrefs.forEach((href: string) => {
        expect(resolveAppRouteForSiteUrl(href)).toBe(
          href.replace(/^https?:\/\/(www\.)?metravel\.by/i, '').split('#')[0] || '/',
        )
      })
    })
  })

  describe('MOOD_CARDS filterParams — navigation logic', () => {
    it('MOOD_CARDS array has correct filterParams for each card', () => {
      const { MOOD_CARDS_FOR_TEST } = require('@/components/home/HomeHero')
      if (!MOOD_CARDS_FOR_TEST) {
        return
      }
      expect(MOOD_CARDS_FOR_TEST[0].filters).toEqual({
        categoryTravelAddress: [84, 110, 113, 193],
      })
      expect(MOOD_CARDS_FOR_TEST[1].filters).toEqual({
        categoryTravelAddress: [33, 43],
      })
      expect(MOOD_CARDS_FOR_TEST[2].filters).toEqual({
        categoryTravelAddress: [114, 115, 116, 117, 118, 119, 120],
      })
      expect(MOOD_CARDS_FOR_TEST[3].filters).toEqual({
        categories: [21, 22, 2],
      })
    })
  })

  describe('Book cover BOOK_IMAGES — data integrity', () => {
    it('first image (Тропа ведьм) has valid href/title/subtitle', () => {
      const { BOOK_IMAGES_FOR_TEST } = require('@/components/home/HomeHero')
      if (!BOOK_IMAGES_FOR_TEST) return
      expect(BOOK_IMAGES_FOR_TEST[0].href).toMatch(
        /^https:\/\/metravel\.by\/travels\//,
      )
      expect(BOOK_IMAGES_FOR_TEST[0].title).toBeTruthy()
      expect(BOOK_IMAGES_FOR_TEST[0].subtitle).toBeTruthy()
    })

    it('remaining images have href pointing to metravel.by', () => {
      const { BOOK_IMAGES_FOR_TEST } = require('@/components/home/HomeHero')
      if (!BOOK_IMAGES_FOR_TEST) return
      const withHref = BOOK_IMAGES_FOR_TEST.filter((img: any) => img.href)
      expect(withHref.length).toBeGreaterThan(0)
      withHref.forEach((img: any) => {
        expect(img.href).toMatch(/^https:\/\/metravel\.by\/travels\//)
        expect(img.title).toBeTruthy()
        expect(img.subtitle).toBeTruthy()
      })
    })

    it('builds the same optimized slide preload url shape used by the slider media', () => {
      const { BOOK_IMAGES_FOR_TEST, buildHomeHeroSlidePreloadUrl } = require('@/components/home/HomeHero')
      const remoteSlide = BOOK_IMAGES_FOR_TEST.find((image: any) => {
        return buildHomeHeroSlidePreloadUrl(image.source, 480)
      })
      const preloadUrl = remoteSlide
        ? buildHomeHeroSlidePreloadUrl(remoteSlide.source, 480)
        : null

      expect(preloadUrl).toBeTruthy()
      expect(preloadUrl).toContain('w=480')
      // #1204: `q`/`fit` уходят только на legacy-роут. Семейство раздаётся готовыми
      // производными, и лишние параметры дали бы вторую запись кэша на тот же файл.
      expect(preloadUrl).not.toMatch(/[?&]q=/)
      expect(preloadUrl).not.toMatch(/[?&]fit=/)
      // #1113: `h` в URL больше нет — прокси ресайзит только по ширине, а высота
      // делала ссылку зависимой от геометрии контейнера. Важно, что preload и сам
      // <img> строятся одним `optimizeImageUrl`, поэтому форма URL у них по-прежнему
      // совпадает и preload не приводит ко второй загрузке того же фото.
      expect(preloadUrl).not.toMatch(/[?&]h=/)
    })

    it('disables home slider blur only for iPhone Safari', () => {
      const { shouldDisableHomeHeroSliderBlur } = require('@/components/home/HomeHero')

      expect(
        shouldDisableHomeHeroSliderBlur(
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
          5,
        ),
      ).toBe(true)

      expect(
        shouldDisableHomeHeroSliderBlur(
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          0,
        ),
      ).toBe(false)
    })
  })
})
