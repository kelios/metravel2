import { fireEvent, render } from '@testing-library/react-native'

import AdventProgressCard from '@/components/profile/AdventProgressCard'
import { useAdventProgressStore } from '@/stores/adventProgressStore'
import { i18n } from '@/i18n'
import { fakeToday } from './fakeToday'

const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }))
let mockAuth = { isAuthenticated: true, userId: '7', authReady: true }
jest.mock('@/context/AuthContext', () => ({ useAuth: () => mockAuth }))

describe('AdventProgressCard in the profile overview (#2866)', () => {
  beforeEach(async () => {
    useAdventProgressStore.setState({ byOwner: {} })
    await i18n.changeLanguage('ru')
  })
  afterEach(() => jest.useRealTimers())

  it('is hidden outside the campaign window', async () => {
    fakeToday(new Date(2026, 10, 30, 12))
    expect((await render(<AdventProgressCard />)).queryByTestId('profile-advent-card')).toBeNull()
  })

  it('shows progress and streak of the signed-in user only', async () => {
    fakeToday(new Date(2026, 11, 3, 12))
    useAdventProgressStore.setState({
      byOwner: {
        u7: { opened: { '1': '2026-12-01', '2': '2026-12-02', '3': '2026-12-03' }, tasksDone: {} },
        u8: { opened: { '1': '2026-12-01' }, tasksDone: {} },
      },
    })
    const screen = await render(<AdventProgressCard />)
    expect(screen.getByText('3 из 24 дверец · Серия: 3')).toBeTruthy()
    await fireEvent.press(screen.getByTestId('profile-advent-card'))
    expect(mockPush).toHaveBeenCalledWith('/advent')
  })

  it('shows zero for another identity', async () => {
    fakeToday(new Date(2026, 11, 3, 12))
    useAdventProgressStore.setState({ byOwner: { u7: { opened: { '1': '2026-12-01' }, tasksDone: {} } } })
    mockAuth = { isAuthenticated: true, userId: '9', authReady: true }
    expect((await render(<AdventProgressCard />)).getByText('0 из 24 дверец · Серия: 0')).toBeTruthy()
    mockAuth = { isAuthenticated: true, userId: '7', authReady: true }
  })
})
