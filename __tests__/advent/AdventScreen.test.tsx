import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { QueryClientProvider } from '@tanstack/react-query'

import AdventScreen from '@/components/advent/AdventScreen'
import { ApiError } from '@/api/clientErrors'
import { useAdventProgressStore } from '@/stores/adventProgressStore'
import { useAuthStore } from '@/stores/authStore'
import { i18n } from '@/i18n'
import { getAdventCampaign } from '@/services/advent/loadCampaign'
import { createTestQueryClient } from '../helpers/testQueryClient'
import { fakeToday } from './fakeToday'

// Сервер адвента (#2864/#2865): по умолчанию «не выкачен» (404), как на проде сейчас.
const mockFetchAdventCampaign = jest.fn()
const mockFetchAdventProgress = jest.fn()
const mockSyncAdventProgress = jest.fn()
const mockFetchYearInReview = jest.fn()
jest.mock('@/api/advent', () => ({
  ...jest.requireActual('@/api/advent'),
  fetchAdventCampaign: (...args: unknown[]) => mockFetchAdventCampaign(...args),
  fetchAdventProgress: (...args: unknown[]) => mockFetchAdventProgress(...args),
  syncAdventProgress: (...args: unknown[]) => mockSyncAdventProgress(...args),
  fetchYearInReview: (...args: unknown[]) => mockFetchYearInReview(...args),
}))
jest.mock('@/hooks/useAchievementsApi', () => ({ useMyAchievements: () => ({ data: undefined }) }))

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
  const client = createTestQueryClient()
  return await render(
    <QueryClientProvider client={client}>
      <AdventScreen />
    </QueryClientProvider>,
  )
}

const missing = () => Promise.reject(new ApiError(404, 'Not found'))

describe('AdventScreen (#2861)', () => {
  beforeEach(async () => {
    useAdventProgressStore.setState({ byOwner: {} })
    mockAuth = { isAuthenticated: true, userId: '7', authReady: true }
    useAuthStore.setState({ isAuthenticated: false, userId: null })
    mockFetchAdventCampaign.mockImplementation(missing)
    mockFetchAdventProgress.mockImplementation(missing)
    mockSyncAdventProgress.mockImplementation(missing)
    mockFetchYearInReview.mockImplementation(missing)
    await i18n.changeLanguage('ru')
  })
  afterEach(() => jest.useRealTimers())

  it('renders 27 doors with 1–3 available on 03.12 and the rest locked', async () => {
    const screen = await renderAt(new Date(2026, 11, 3, 12))
    for (let day = 1; day <= 27; day += 1) expect(screen.getByTestId(`advent-door-${day}`)).toBeTruthy()
    expect(screen.getByTestId('advent-door-3').props.accessibilityState.disabled).toBe(false)
    expect(screen.getByTestId('advent-door-4').props.accessibilityState.disabled).toBe(true)
    expect(screen.getByText('Открыто 0 из 24 дверец')).toBeTruthy()
    expect(screen.getByTestId('advent-house-facade')).toBeTruthy()
    expect(screen.getByTestId('advent-bonus-doors')).toBeTruthy()
    expect(screen.getByText('25 декабря')).toBeTruthy()
    expect(screen.getByText('31 декабря')).toBeTruthy()
    expect(screen.getByText('7 января')).toBeTruthy()
    expect(screen.queryByText('26')).toBeNull()
    expect(screen.queryByText('27')).toBeNull()
    expect(screen.getByTestId('advent-countdown').props.children).toMatch(/Дверца 4 откроется/)
  })

  it('uses the existing open flow for today’s primary action and keeps prelaunch doors locked', async () => {
    const screen = await renderAt(new Date(2026, 11, 1, 12))
    expect(screen.getByTestId('advent-today-action')).toBeTruthy()
    await fireEvent.press(screen.getByTestId('advent-today-open'))
    expect(screen.getByTestId('advent-door-sheet-1')).toBeTruthy()
    expect(useAdventProgressStore.getState().byOwner.u7.tasksDone['1']).toBe('2026-12-01')
  })

  it('shows an honest countdown before launch, without a current-day action or fake progress', async () => {
    const screen = await renderAt(new Date(2026, 10, 2, 12))
    expect(screen.queryByTestId('advent-today-action')).toBeNull()
    expect(screen.getByTestId('advent-countdown').props.children).toMatch(/Дверца 1 откроется/)
    await fireEvent.press(screen.getByTestId('advent-door-1'))
    expect(screen.queryByTestId('advent-door-sheet-1')).toBeNull()
    expect(screen.getByText('Открыто 0 из 24 дверец')).toBeTruthy()
    expect(useAdventProgressStore.getState().byOwner.u7).toBeUndefined()
  })

  it.each([true, false])('keeps the secret bonus title hidden until opened (authenticated=%s)', async (isAuthenticated) => {
    mockAuth = { isAuthenticated, userId: isAuthenticated ? '7' : null as unknown as string, authReady: true }
    const secret = getAdventCampaign().doors.find((door) => door.secret)!
    const screen = await renderAt(new Date(2027, 0, 7, 12))
    expect(screen.getByText(`Дверца ${secret.day}: Секрет`)).toBeTruthy()
    expect(screen.queryByText(secret.gift.title, { exact: false })).toBeNull()

    await fireEvent.press(screen.getByTestId('advent-today-open'))
    expect(screen.getByTestId(`advent-door-sheet-${secret.day}`)).toBeTruthy()
    expect(screen.getByText(secret.gift.title)).toBeTruthy()
    expect(screen.getByText(`Дверца ${secret.day}: ${secret.gift.title}`)).toBeTruthy()
  })

  it('opens a door into the sheet, marks the task done and updates progress', async () => {
    const screen = await renderAt(new Date(2026, 11, 11, 12))
    await fireEvent.press(screen.getByTestId('advent-door-11'))
    expect(screen.getByTestId('advent-door-sheet-11')).toBeTruthy()
    expect(screen.getByText('Открыто 1 из 24 дверец')).toBeTruthy()
    expect(screen.queryByTestId('advent-task-server-credit-hint')).toBeNull()
    await fireEvent.press(screen.getByTestId('advent-task-done-button'))
    expect(screen.getByTestId('advent-task-done')).toBeTruthy()
    const progress = useAdventProgressStore.getState().byOwner.u7
    expect(progress.opened['11']).toBe('2026-12-11')
    expect(progress.tasksDone['11']).toBe('2026-12-11')
    expect(screen.getByText('Заданий выполнено: 1')).toBeTruthy()
  })

  // #2940: статусы «Хочу/Планирую/Был», подписку, оценку, peer-значок и шаг
  // квеста засчитывает сервер — ручной отметки нет, вместо неё подсказка.
  it('shows the action link and a server-credit hint instead of the manual "done" button', async () => {
    const screen = await renderAt(new Date(2026, 11, 3, 12))
    await fireEvent.press(screen.getByTestId('advent-door-2'))
    expect(screen.getByText('Скрытые места Беларуси')).toBeTruthy()
    expect(screen.getByTestId('advent-task-cta')).toBeTruthy()
    expect(screen.getByText('Засчитаем, когда вы это сделаете')).toBeTruthy()
    expect(screen.queryByTestId('advent-task-done-button')).toBeNull()
    expect(useAdventProgressStore.getState().byOwner.u7.tasksDone['2']).toBeUndefined()
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

  describe('server progress (#2867)', () => {
    beforeEach(() => {
      useAuthStore.setState({ isAuthenticated: true, userId: '7' })
    })

    it('moves guest progress of this device into the account after sign-in', async () => {
      useAdventProgressStore.setState({ byOwner: { guest: { opened: { '1': '2026-12-01' }, tasksDone: {} } } })
      const screen = await renderAt(new Date(2026, 11, 2, 12))
      await waitFor(() => expect(useAdventProgressStore.getState().byOwner.u7?.opened['1']).toBe('2026-12-01'))
      expect(useAdventProgressStore.getState().byOwner.guest).toBeUndefined()
      expect(screen.getByText('Открыто 1 из 24 дверец')).toBeTruthy()
    })

    it('merges server progress, shows the credited mark instead of the button and syncs local extras once', async () => {
      useAdventProgressStore.setState({ byOwner: { u7: { opened: { '1': '2026-12-01' }, tasksDone: {} } } })
      mockFetchAdventProgress.mockResolvedValue({ opened: { '2': '2026-12-02' }, tasksDone: { '2': '2026-12-02' }, streak: 2 })
      mockSyncAdventProgress.mockImplementation(async (maps: { opened: Record<string, string>; tasksDone: Record<string, string> }) => ({
        opened: maps.opened,
        tasksDone: maps.tasksDone,
        streak: 2,
      }))
      const screen = await renderAt(new Date(2026, 11, 2, 12))
      expect(await screen.findByTestId('advent-sync-synced')).toBeTruthy()
      expect(mockSyncAdventProgress).toHaveBeenCalledTimes(1)
      expect(mockSyncAdventProgress.mock.calls[0][0]).toEqual({
        opened: { '1': '2026-12-01', '2': '2026-12-02' },
        tasksDone: { '2': '2026-12-02' },
      })
      // Серия видна в шапке и в шеринг-карточке — обе берут серверное значение.
      expect(screen.getAllByText('Серия день в день: 2')).toHaveLength(2)
      await fireEvent.press(screen.getByTestId('advent-door-2'))
      expect(screen.getByTestId('advent-task-credited')).toBeTruthy()
      expect(screen.queryByTestId('advent-task-done-button')).toBeNull()
    })

    it('after the server credits a site action the status reads "saved to account" (#2940)', async () => {
      useAdventProgressStore.setState({ byOwner: { u7: { opened: { '2': '2026-12-02' }, tasksDone: {} } } })
      mockFetchAdventProgress.mockResolvedValue({ opened: { '2': '2026-12-02' }, tasksDone: { '2': '2026-12-02' }, streak: 1 })
      const screen = await renderAt(new Date(2026, 11, 2, 12))
      expect(await screen.findByTestId('advent-sync-synced')).toBeTruthy()
      expect(screen.getByText('Прогресс сохранён в аккаунте')).toBeTruthy()
      expect(mockSyncAdventProgress).not.toHaveBeenCalled()
      await fireEvent.press(screen.getByTestId('advent-door-2'))
      expect(screen.getByTestId('advent-task-credited')).toBeTruthy()
      expect(screen.queryByTestId('advent-task-server-credit-hint')).toBeNull()
    })

    it('a manual mark on a server-credited door is not pushed and does not stick at "this device only" (#2940)', async () => {
      // Отметка «Сделано» с другого устройства или до флага: сервер её отбрасывает.
      useAdventProgressStore.setState({
        byOwner: { u7: { opened: { '2': '2026-12-02', '3': '2026-12-03' }, tasksDone: { '2': '2026-12-02' } } },
      })
      mockFetchAdventProgress.mockResolvedValue({ opened: { '2': '2026-12-02' }, tasksDone: {}, streak: 1 })
      mockSyncAdventProgress.mockImplementation(async (maps: { opened: Record<string, string>; tasksDone: Record<string, string> }) => ({
        opened: maps.opened,
        tasksDone: {},
        streak: 2,
      }))
      const screen = await renderAt(new Date(2026, 11, 3, 12))
      expect(await screen.findByTestId('advent-sync-synced')).toBeTruthy()
      expect(mockSyncAdventProgress).toHaveBeenCalledTimes(1)
      expect(mockSyncAdventProgress.mock.calls[0][0]).toEqual({
        opened: { '2': '2026-12-02', '3': '2026-12-03' },
        tasksDone: {},
      })
      expect(screen.queryByTestId('advent-sync-local')).toBeNull()
    })

    it('does not claim "saved to account" when the server response drops a local door', async () => {
      useAdventProgressStore.setState({ byOwner: { u7: { opened: { '2': '2026-12-02' }, tasksDone: {} } } })
      mockFetchAdventProgress.mockResolvedValue({ opened: {}, tasksDone: {}, streak: 0 })
      mockSyncAdventProgress.mockResolvedValue({ opened: {}, tasksDone: {}, streak: 0 })
      const screen = await renderAt(new Date(2026, 11, 2, 12))
      await waitFor(() => expect(mockSyncAdventProgress).toHaveBeenCalledTimes(1))
      expect(await screen.findByTestId('advent-sync-local')).toBeTruthy()
      expect(screen.queryByTestId('advent-sync-synced')).toBeNull()
      expect(mockSyncAdventProgress).toHaveBeenCalledTimes(1)
    })

    it('stays on local progress and says so when the advent backend is not deployed', async () => {
      const screen = await renderAt(new Date(2026, 11, 2, 12))
      expect(await screen.findByTestId('advent-sync-local')).toBeTruthy()
      await fireEvent.press(screen.getByTestId('advent-door-2'))
      expect(useAdventProgressStore.getState().byOwner.u7.opened['2']).toBe('2026-12-02')
      expect(mockSyncAdventProgress).not.toHaveBeenCalled()
    })

    it('shows the year-in-review postcard on door 24 when the aggregate is unavailable (#2868)', async () => {
      const screen = await renderAt(new Date(2026, 11, 24, 12))
      await fireEvent.press(screen.getByTestId('advent-door-24'))
      expect(await screen.findByTestId('advent-yir-unavailable')).toBeTruthy()
    })
  })

  it('offers the N/24 share card once a door is opened (#2868)', async () => {
    const screen = await renderAt(new Date(2026, 11, 3, 12))
    expect(screen.queryByTestId('advent-share-card')).toBeNull()
    await fireEvent.press(screen.getByTestId('advent-door-2'))
    expect(screen.getByText('Мой адвент 1/24')).toBeTruthy()
  })
})
