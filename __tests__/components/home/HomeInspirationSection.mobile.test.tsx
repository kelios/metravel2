import { render, screen, fireEvent } from '@testing-library/react-native'
import { useQuery } from '@tanstack/react-query'
import { HomeInspirationSection } from '@/components/home/HomeInspirationSection'

const mockPush = jest.fn()

jest.mock('@tanstack/react-query')
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}))
// Ширина вьюпорта решает раскладку секции; по умолчанию — телефон 390.
let mockViewport: { isPhone: boolean; isLargePhone: boolean; width: number } = {
  isPhone: true,
  isLargePhone: false,
  width: 390,
}

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({ ...mockViewport }),
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
    mockViewport = { isPhone: true, isLargePhone: false, width: 390 }
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

  // #1414 (TestFlight 1.0.5 (8)): бейдж секции дублировал её же заголовок и
  // вместе с ним съедал экран до первой карточки. На телефоне он снят, на
  // широком экране остаётся — обе стороны контракта держим тестом.
  it('drops the section badge on a phone and keeps it on a wide viewport', () => {
    const section = (
      <HomeInspirationSection
        title="Идеи для ближайших выходных"
        subtitle="Реальные маршруты без долгого планирования"
        queryKey="home-travels-of-month"
        fetchFn={jest.fn()}
      />
    )

    const phone = render(section)
    expect(phone.queryByText('Подборка выходного дня')).toBeNull()
    expect(phone.getByText('Идеи для ближайших выходных')).toBeTruthy()
    phone.unmount()

    mockViewport = { isPhone: false, isLargePhone: false, width: 1280 }
    const wide = render(section)
    expect(wide.getByText('Подборка выходного дня')).toBeTruthy()
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
