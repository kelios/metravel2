import { fireEvent, render } from '@testing-library/react-native'

import AdventScreen from '@/components/advent/AdventScreen'
import { useAdventProgressStore } from '@/stores/adventProgressStore'
import { i18n } from '@/i18n'
import { fakeToday } from './fakeToday'

let mockAuth = { isAuthenticated: true, userId: '7', authReady: true }
jest.mock('@/context/AuthContext', () => ({ useAuth: () => mockAuth }))
jest.mock('@/utils/analytics', () => ({ sendAnalyticsEvent: jest.fn(), queueAnalyticsEvent: jest.fn() }))
// Лист дверцы живёт в Modal — в jest его тело рисуем напрямую (как в badgeDetail.localeSelection).
jest.mock('@/components/ui/BottomSheet', () => {
  const React = require('react')
  const { View } = require('react-native')
  return ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
    visible ? React.createElement(View, { testID: 'advent-sheet-mock' }, children) : null
})
jest.mock('@/hooks/useResponsive', () => ({ useResponsive: () => ({ isPhone: false, isLargePhone: false, width: 1280, height: 800 }) }))

const renderAt = async (date: Date) => {
  fakeToday(date)
  return await render(<AdventScreen />)
}

describe('AdventScreen (#2861)', () => {
  beforeEach(async () => {
    useAdventProgressStore.setState({ byOwner: {} })
    mockAuth = { isAuthenticated: true, userId: '7', authReady: true }
    await i18n.changeLanguage('ru')
  })
  afterEach(() => jest.useRealTimers())

  it('renders 27 doors with 1–3 available on 03.12 and the rest locked', async () => {
    const screen = await renderAt(new Date(2026, 11, 3, 12))
    for (let day = 1; day <= 27; day += 1) expect(screen.getByTestId(`advent-door-${day}`)).toBeTruthy()
    expect(screen.getByTestId('advent-door-3').props.accessibilityState.disabled).toBe(false)
    expect(screen.getByTestId('advent-door-4').props.accessibilityState.disabled).toBe(true)
    expect(screen.getByText('Открыто 0 из 24 дверец')).toBeTruthy()
    expect(screen.getByTestId('advent-countdown').props.children).toMatch(/Дверца 4 откроется/)
  })

  it('opens a door into the sheet, marks the task done and updates progress', async () => {
    const screen = await renderAt(new Date(2026, 11, 3, 12))
    await fireEvent.press(screen.getByTestId('advent-door-2'))
    expect(screen.getByTestId('advent-door-sheet-2')).toBeTruthy()
    expect(screen.getByText('Скрытые места Беларуси')).toBeTruthy()
    expect(screen.getByText('Открыто 1 из 24 дверец')).toBeTruthy()
    await fireEvent.press(screen.getByTestId('advent-task-done-button'))
    expect(screen.getByTestId('advent-task-done')).toBeTruthy()
    const progress = useAdventProgressStore.getState().byOwner.u7
    expect(progress.opened['2']).toBe('2026-12-03')
    expect(progress.tasksDone['2']).toBe('2026-12-03')
    expect(screen.getByText('Заданий выполнено: 1')).toBeTruthy()
  })

  it('checks a riddle answer in place: wrong shows a hint, right completes the task', async () => {
    const screen = await renderAt(new Date(2026, 11, 3, 12))
    await fireEvent.press(screen.getByTestId('advent-door-3'))
    await fireEvent.changeText(screen.getByTestId('advent-riddle-input'), 'Мир')
    await fireEvent.press(screen.getByTestId('advent-riddle-check'))
    expect(screen.getByTestId('advent-riddle-wrong').props.children.join('')).toMatch(/Подсказка/)
    await fireEvent.changeText(screen.getByTestId('advent-riddle-input'), 'несвиж')
    await fireEvent.press(screen.getByTestId('advent-riddle-check'))
    expect(useAdventProgressStore.getState().byOwner.u7.tasksDone['3']).toBe('2026-12-03')
  })

  it('completes an open-type door by opening it for a signed-in user', async () => {
    const screen = await renderAt(new Date(2026, 11, 1, 12))
    await fireEvent.press(screen.getByTestId('advent-door-1'))
    expect(useAdventProgressStore.getState().byOwner.u7.tasksDone['1']).toBe('2026-12-01')
    expect(screen.getByTestId('advent-task-done')).toBeTruthy()
  })

  it('lets a guest open the gift but routes tasks to login with a return path', async () => {
    mockAuth = { isAuthenticated: false, userId: null as unknown as string, authReady: true }
    const screen = await renderAt(new Date(2026, 11, 1, 12))
    await fireEvent.press(screen.getByTestId('advent-door-1'))
    expect(screen.getByTestId('advent-guest-block')).toBeTruthy()
    expect(useAdventProgressStore.getState().byOwner.guest.opened['1']).toBe('2026-12-01')
    expect(useAdventProgressStore.getState().byOwner.guest.tasksDone['1']).toBeUndefined()
    const { router } = jest.requireMock('expo-router') as { router: { push: jest.Mock } }
    await fireEvent.press(screen.getByTestId('advent-guest-login'))
    expect(router.push).toHaveBeenCalledWith(expect.stringMatching(/^\/login\?redirect=%2Fadvent%3Fday%3D1&intent=advent$/))
  })

  it('does not write progress while auth is not ready', async () => {
    mockAuth = { isAuthenticated: false, userId: null as unknown as string, authReady: false }
    const screen = await renderAt(new Date(2026, 11, 1, 12))
    await fireEvent.press(screen.getByTestId('advent-door-1'))
    expect(useAdventProgressStore.getState().byOwner).toEqual({})
  })

  it('opens the door from the ?day= return path through the same press flow', async () => {
    const expoRouter = jest.requireMock('expo-router') as { useLocalSearchParams: () => Record<string, string> }
    const original = expoRouter.useLocalSearchParams
    expoRouter.useLocalSearchParams = () => ({ day: '1' })
    try {
      const screen = await renderAt(new Date(2026, 11, 1, 12))
      expect(await screen.findByTestId('advent-door-sheet-1')).toBeTruthy()
      expect(useAdventProgressStore.getState().byOwner.u7.tasksDone['1']).toBe('2026-12-01')
    } finally {
      expoRouter.useLocalSearchParams = original
    }
  })

  it('keeps progress separate between identities', async () => {
    useAdventProgressStore.setState({ byOwner: { u7: { opened: { '1': '2026-12-01' }, tasksDone: {} } } })
    mockAuth = { isAuthenticated: true, userId: '8', authReady: true }
    const screen = await renderAt(new Date(2026, 11, 2, 12))
    expect(screen.getByText('Открыто 0 из 24 дверец')).toBeTruthy()
    await fireEvent.press(screen.getByTestId('advent-door-1'))
    expect(useAdventProgressStore.getState().byOwner.u8.opened['1']).toBe('2026-12-02')
    expect(useAdventProgressStore.getState().byOwner.u7.tasksDone).toEqual({})
  })
})
