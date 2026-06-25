import { render, screen, fireEvent } from '@testing-library/react-native'
import { useQuery } from '@tanstack/react-query'
import { HomeInspirationSection } from '@/components/home/HomeInspirationSection'

const mockPush = jest.fn()

jest.mock('@tanstack/react-query')
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}))
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({
    isPhone: true,
    isLargePhone: false,
    width: 390,
  }),
}))
jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => ({
    text: '#111111',
    textMuted: '#666666',
    brand: '#aa7744',
    primary: '#bb8844',
    primarySoft: '#f6eee6',
    primaryText: '#7a5723',
    primaryAlpha30: 'rgba(187, 136, 68, 0.3)',
    surface: '#ffffff',
    backgroundSecondary: '#faf8f5',
    borderLight: '#e5ded4',
  }),
}))
jest.mock('@/utils/analytics', () => ({
  sendAnalyticsEvent: jest.fn(),
}))
jest.mock('@/components/listTravel/RenderTravelItem', () => {
  const { Text } = require('react-native')

  return function MockRenderTravelItem({
    item,
  }: {
    item: { name?: string; id?: string | number }
  }) {
    return <Text>{item.name ?? item.id}</Text>
  }
})

const mockUseQuery = useQuery as jest.MockedFunction<typeof useQuery>

describe('HomeInspirationSection mobile weekend showcase', () => {
  beforeEach(() => {
    mockUseQuery.mockReturnValue({
      data: {
        results: [
          { id: 1, name: 'Маршрут 1' },
          { id: 2, name: 'Маршрут 2' },
          { id: 3, name: 'Маршрут 3' },
          { id: 4, name: 'Маршрут 4' },
        ],
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    } as any)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('renders every weekend route on mobile instead of truncating to two cards', () => {
    render(
      <HomeInspirationSection
        title="Идеи для ближайших выходных"
        subtitle="Реальные маршруты без долгого планирования"
        queryKey="home-travels-of-month"
        fetchFn={jest.fn()}
      />,
    )

    expect(screen.getByText('Маршрут 1')).toBeTruthy()
    expect(screen.getByText('Маршрут 2')).toBeTruthy()
    expect(screen.getByText('Маршрут 3')).toBeTruthy()
    expect(screen.getByText('Маршрут 4')).toBeTruthy()
  })

  it('shows a working "Все маршруты" CTA that navigates to the catalog', () => {
    render(
      <HomeInspirationSection
        title="Идеи для ближайших выходных"
        subtitle="Реальные маршруты без долгого планирования"
        queryKey="home-travels-of-month"
        fetchFn={jest.fn()}
      />,
    )

    fireEvent.press(screen.getByText('Все маршруты'))
    expect(mockPush).toHaveBeenCalledWith('/search')
  })
})
