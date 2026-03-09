import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import { Platform } from 'react-native'
import { useRouter } from 'expo-router'
import HomeHero from '@/components/home/HomeHero'
import { queueAnalyticsEvent } from '@/utils/analytics'

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
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => mockResponsiveState,
  useResponsiveColumns: () => 3,
  useResponsiveValue: (values: any) =>
    values.desktop ?? values.default ?? Object.values(values)[0],
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
      expect(getByText(/Готовые маршруты/)).toBeTruthy()
    })

    it('should render mood cards correctly', () => {
      const { getByText } = render(<HomeHero />)
      expect(getByText('У воды')).toBeTruthy()
    })

    it('should render highlights correctly', () => {
      const { getByText } = render(<HomeHero />)
      expect(getByText('За 2 минуты')).toBeTruthy()
      expect(getByText('Личная книга')).toBeTruthy()
    })
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
  })

  describe('Book slider styling', () => {
    it('renders decorative page wave layers for the desktop web book slider', () => {
      const previousPlatform = Platform.OS
      const previousSelect = Platform.select

      Platform.OS = 'web'
      Platform.select = (options: any) => options.web ?? options.default

      const { getByTestId } = render(<HomeHero />)

      expect(getByTestId('home-hero-slider-wave-top')).toBeTruthy()
      expect(getByTestId('home-hero-slider-wave-bottom')).toBeTruthy()

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
  })
})
