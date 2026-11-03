import { act, fireEvent, render } from '@testing-library/react-native'
import { QueryClientProvider } from '@tanstack/react-query'

import AdventScreen from '@/components/advent/AdventScreen'
import { i18n } from '@/i18n'
import { useAdventProgressStore } from '@/stores/adventProgressStore'
import { sendAnalyticsEvent } from '@/utils/analytics'
import { createTestQueryClient } from '../helpers/testQueryClient'
import { fakeToday } from './fakeToday'

let mockAuth = { authReady: true, isAuthenticated: true, isSuperuser: false, userId: '7' }
const mockSync = jest.fn()
jest.mock('@/context/AuthContext', () => ({ useAuth: () => mockAuth }))
jest.mock('@/hooks/useAdventApi', () => ({
  useAdventCampaignQuery: () => null,
  useAdventServerSync: (params: unknown) => mockSync(params),
}))
jest.mock('@/components/achievements/BadgeUnlockToast', () => () => null)
jest.mock('@/components/ui/BottomSheet', () => ({ visible, children, onClose }: {
  visible: boolean
  children: React.ReactNode
  onClose: () => void
}) => {
  const { View } = require('react-native')
  return visible ? <View testID="preview-test-sheet" onTouchEnd={onClose}>{children}</View> : null
})
jest.mock('@/utils/analytics', () => ({ sendAnalyticsEvent: jest.fn(), queueAnalyticsEvent: jest.fn() }))

const renderScreen = async () => {
  const client = createTestQueryClient()
  const screen = () => <QueryClientProvider client={client}><AdventScreen /></QueryClientProvider>
  return { ...await render(screen()), screen }
}

describe('Advent admin preview', () => {
  beforeEach(async () => {
    mockAuth = { authReady: true, isAuthenticated: true, isSuperuser: false, userId: '7' }
    mockSync.mockReturnValue({ state: 'local', serverStreak: null, creditedDays: new Set() })
    jest.mocked(sendAnalyticsEvent).mockClear()
    useAdventProgressStore.setState({ byOwner: {} })
    fakeToday(new Date(2026, 10, 3, 12))
    await i18n.changeLanguage('ru')
  })

  afterEach(() => jest.useRealTimers())

  it.each([
    { isAuthenticated: true, isSuperuser: false, authReady: true },
    { isAuthenticated: false, isSuperuser: true, authReady: true },
    { isAuthenticated: true, isSuperuser: true, authReady: false },
  ])('keeps future doors locked without a ready superuser session (%o)', async (auth) => {
    mockAuth = { ...mockAuth, ...auth }
    const view = await renderScreen()
    expect(view.queryByTestId('advent-preview-toggle')).toBeNull()
    expect(view.getByTestId('advent-door-3').props.accessibilityState.disabled).toBe(true)
  })

  it('opens future and bonus doors and replays a riddle without changing progress', async () => {
    mockAuth.isSuperuser = true
    const view = await renderScreen()
    await fireEvent.press(view.getByTestId('advent-preview-toggle'))
    expect(mockSync).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: false }))
    for (let day = 1; day <= 27; day += 1) {
      expect(view.getByTestId(`advent-door-${day}`).props.accessibilityState.disabled).toBe(false)
    }

    await fireEvent.press(view.getByTestId('advent-door-1'))
    expect(view.getByTestId('advent-task-done')).toBeTruthy()
    await fireEvent(view.getByTestId('preview-test-sheet'), 'touchEnd')

    await fireEvent.press(view.getByTestId('advent-door-27'))
    expect(view.getByTestId('advent-door-sheet-27')).toBeTruthy()
    await fireEvent(view.getByTestId('preview-test-sheet'), 'touchEnd')
    await fireEvent.press(view.getByTestId('advent-door-3'))
    await fireEvent.changeText(view.getByTestId('advent-riddle-input'), 'несвиж')
    await fireEvent.press(view.getByTestId('advent-riddle-check'))
    expect(view.getByTestId('advent-task-done')).toBeTruthy()
    await fireEvent(view.getByTestId('preview-test-sheet'), 'touchEnd')
    await fireEvent.press(view.getByTestId('advent-door-3'))
    expect(view.getByTestId('advent-riddle-input').props.value).toBe('')
    expect(useAdventProgressStore.getState().byOwner).toEqual({})
    expect(sendAnalyticsEvent).not.toHaveBeenCalled()

    mockAuth.isSuperuser = false
    await act(() => view.rerender(view.screen()))
    expect(view.queryByTestId('advent-door-sheet-3')).toBeNull()
    expect(view.queryByTestId('advent-preview-toggle')).toBeNull()
    expect(view.getByTestId('advent-door-3').props.accessibilityState.disabled).toBe(true)

    mockAuth.isSuperuser = true
    await act(() => view.rerender(view.screen()))
    expect(view.getByTestId('advent-preview-toggle')).toBeTruthy()
    expect(view.queryByTestId('advent-door-sheet-3')).toBeNull()
    expect(view.getByTestId('advent-door-3').props.accessibilityState.disabled).toBe(true)
  })
})
