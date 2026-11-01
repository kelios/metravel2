import { render } from '@testing-library/react-native'
import { Platform } from 'react-native'

import { useAdventCampaign } from '@/hooks/useAdventCampaign'
import { useAdventProgressStore } from '@/stores/adventProgressStore'
import { fakeToday } from './fakeToday'

jest.mock('@/context/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: true, userId: '7', authReady: true }) }))

// Пишет состояние хука на КАЖДОМ рендере: первый — то, что уйдёт в статический HTML.
const seen: Array<{ hydrated: boolean; locked: number; opened: number; inWindow: boolean }> = []
function Probe() {
  const campaign = useAdventCampaign()
  seen.push({
    hydrated: campaign.hydrated,
    locked: campaign.doors.filter((door) => door.state === 'locked').length,
    opened: campaign.openedCount,
    inWindow: campaign.isInWindow,
  })
  return null
}

describe('web first render is date-independent (#2861 hydration)', () => {
  afterEach(() => {
    jest.useRealTimers()
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' })
  })

  it('renders every door locked and the window closed before mount, then the real state', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' })
    useAdventProgressStore.setState({ byOwner: { u7: { opened: { '1': '2026-12-01' }, tasksDone: {} } } })
    seen.length = 0
    fakeToday(new Date(2026, 11, 3, 12))
    await render(<Probe />)
    expect(seen[0]).toEqual({ hydrated: false, locked: 27, opened: 0, inWindow: false })
    expect(seen[seen.length - 1]).toEqual({ hydrated: true, locked: 24, opened: 1, inWindow: true })
  })

  it('is hydrated from the first render on native', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' })
    useAdventProgressStore.setState({ byOwner: {} })
    seen.length = 0
    fakeToday(new Date(2026, 11, 3, 12))
    await render(<Probe />)
    expect(seen[0].hydrated).toBe(true)
    expect(seen[0].locked).toBe(24)
  })
})
