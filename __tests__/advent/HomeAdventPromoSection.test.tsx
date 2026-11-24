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
// Облегчённые копии фасада есть только в web-бандле (#3488); jest собирает под native.
jest.mock('@/constants/adventFacadeBannerSources', () => jest.requireActual('@/constants/adventFacadeBannerSources.web'))
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

  it('is hidden before the announce (23.11) and after the campaign (08.01)', async () => {
    expect((await renderAt(new Date(2026, 10, 23, 12))).queryByTestId('home-advent-promo')).toBeNull()
    expect((await renderAt(new Date(2027, 0, 8, 12))).queryByTestId('home-advent-promo')).toBeNull()
  })

  it('announces the first door before the start without progress (#3481)', async () => {
    const screen = await renderAt(new Date(2026, 10, 24, 12))
    expect(screen.getByTestId('home-advent-promo')).toBeTruthy()
    expect(screen.getByText('Первая дверца откроется 1 декабря — загляните заранее')).toBeTruthy()
    expect(screen.queryByText(/Открыто \d+ из 24/)).toBeNull()
    expect(screen.getByText('Заглянуть в календарь')).toBeTruthy()
    await fireEvent.press(screen.getByTestId('home-advent-cta'))
    expect(mockPush).toHaveBeenCalledWith('/advent')
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
    // Окно 5 — второй ряд фасада: полоса ряда в полном разрешении, не весь фасад (#3488).
    expect(screen.getByTestId('home-advent-window-source-row-2', { includeHiddenElements: true })).toBeTruthy()
    mockResponsive = { isPhone: false, isLargePhone: false, width: 1280 }
  })

  it('crops the light facade copies instead of the full 239 KB artwork (#3488)', async () => {
    expect((await renderAt(new Date(2026, 11, 5, 12))).getByTestId('home-advent-window-source-small', { includeHiddenElements: true })).toBeTruthy()
    mockResponsive = { isPhone: true, isLargePhone: false, width: 390 }
    // Анонс — крыша дома под луной.
    expect((await renderAt(new Date(2026, 10, 24, 12))).getByTestId('home-advent-window-source-roof', { includeHiddenElements: true })).toBeTruthy()
    mockResponsive = { isPhone: false, isLargePhone: false, width: 1280 }
  })

  it('loads no facade copy until the screen width is known (#3488)', async () => {
    // Кадр до гидратации: ширина 0, раскладка — догадка «desktop».
    mockResponsive = { isPhone: false, isLargePhone: false, width: 0 }
    const screen = await renderAt(new Date(2026, 11, 5, 12))
    expect(screen.getByTestId('home-advent-window', { includeHiddenElements: true })).toBeTruthy()
    expect(screen.queryByTestId(/home-advent-window-source-/, { includeHiddenElements: true })).toBeNull()
    mockResponsive = { isPhone: false, isLargePhone: false, width: 1280 }
  })
})
