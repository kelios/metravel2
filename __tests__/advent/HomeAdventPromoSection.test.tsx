import { fireEvent, render } from '@testing-library/react-native'

import HomeAdventPromoSection from '@/components/home/HomeAdventPromoSection'
import { useAdventProgressStore } from '@/stores/adventProgressStore'
import { i18n } from '@/i18n'
import { fakeToday } from './fakeToday'

const mockPush = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}))
jest.mock('@/utils/analytics', () => ({ sendAnalyticsEvent: jest.fn(), queueAnalyticsEvent: jest.fn() }))
jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true, userId: '7', authReady: true }),
}))
let mockResponsive = { isPhone: false, isLargePhone: false, width: 1280 }
jest.mock('@/hooks/useResponsive', () => ({ useResponsive: () => mockResponsive }))

const renderAt = async (date: Date) => {
  fakeToday(date)
  return await render(<HomeAdventPromoSection />)
}

describe('HomeAdventPromoSection visibility window (#2866)', () => {
  beforeEach(async () => {
    useAdventProgressStore.setState({ byOwner: {} })
    mockPush.mockClear()
    await i18n.changeLanguage('ru')
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  it('is hidden on 30.11 and 08.01', async () => {
    expect((await renderAt(new Date(2026, 10, 30, 12))).queryByTestId('home-advent-promo')).toBeNull()
    expect((await renderAt(new Date(2027, 0, 8, 12))).queryByTestId('home-advent-promo')).toBeNull()
  })

  it('shows door 1 on 01.12 and navigates to /advent', async () => {
    const screen = await renderAt(new Date(2026, 11, 1, 9))
    expect(screen.getByTestId('home-advent-promo')).toBeTruthy()
    expect(screen.getByText(/Дверца 1:/)).toBeTruthy()
    expect(screen.getByText('Открыто 0 из 24')).toBeTruthy()
    await fireEvent.press(screen.getByTestId('home-advent-cta'))
    expect(mockPush).toHaveBeenCalledWith('/advent')
  })

  it('shows the secret door title on its own day and reads the owner progress', async () => {
    useAdventProgressStore.setState({ byOwner: { u7: { opened: { '1': '2026-12-01', '2': '2026-12-02' }, tasksDone: {} } } })
    const screen = await renderAt(new Date(2027, 0, 7, 12))
    expect(screen.getByText('Дверца 27: Коляды: секретная дверца')).toBeTruthy()
    expect(screen.getByText('Открыто 2 из 24')).toBeTruthy()
  })

  it('hides the secret door title while it is still locked', async () => {
    const screen = await renderAt(new Date(2027, 0, 3, 12))
    expect(screen.getByText('Дверца 27: Секрет')).toBeTruthy()
  })

  it('renders the mobile layout on a phone', async () => {
    mockResponsive = { isPhone: true, isLargePhone: false, width: 390 }
    const screen = await renderAt(new Date(2026, 11, 5, 12))
    expect(screen.getByTestId('home-advent-cta')).toBeTruthy()
    mockResponsive = { isPhone: false, isLargePhone: false, width: 1280 }
  })
})
