import { render } from '@testing-library/react-native'

import MoreScreen from '@/app/(tabs)/more'
import { i18n } from '@/i18n'
import { fakeToday } from './fakeToday'

jest.mock('@/context/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: false, userId: null, authReady: true }) }))

describe('More page lists the advent link only inside the campaign window (#2866)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('ru')
  })
  afterEach(() => jest.useRealTimers())

  it('hides /advent on 30.11', async () => {
    fakeToday(new Date(2026, 10, 30, 12))
    const screen = await render(<MoreScreen />)
    expect(screen.queryByText('Адвент-календарь')).toBeNull()
    expect(screen.getByText('Случайный маршрут')).toBeTruthy()
  })

  it('shows /advent on 01.12 after mount', async () => {
    fakeToday(new Date(2026, 11, 1, 12))
    const screen = await render(<MoreScreen />)
    expect(await screen.findByText('Адвент-календарь')).toBeTruthy()
  })
})
