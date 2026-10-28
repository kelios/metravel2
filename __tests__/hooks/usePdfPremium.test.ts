// __tests__/hooks/usePdfPremium.test.ts
import { renderHook } from '@testing-library/react-native'

import { usePdfPremium } from '@/hooks/usePdfPremium'
import { queueAnalyticsEvent } from '@/utils/analytics'

jest.mock('@/utils/analytics', () => ({
  queueAnalyticsEvent: jest.fn(),
}))

const mockedQueueAnalyticsEvent = queueAnalyticsEvent as jest.MockedFunction<
  typeof queueAnalyticsEvent
>

describe('usePdfPremium', () => {
  beforeEach(() => {
    mockedQueueAnalyticsEvent.mockClear()
  })

  it('возвращает isPremium === true с активным стабом', async () => {
    const { result } = await renderHook(() => usePdfPremium())
    expect(result.current.isPremium).toBe(true)
  })

  it('requireUnlock шлёт событие Premium_Unlock_Click с контекстом', async () => {
    const { result } = await renderHook(() => usePdfPremium())
    result.current.requireUnlock('theme-picker')
    expect(mockedQueueAnalyticsEvent).toHaveBeenCalledWith('Premium_Unlock_Click', {
      context: 'theme-picker',
    })
  })

  it('trackPaywallView шлёт событие Premium_Paywall_View с контекстом', async () => {
    const { result } = await renderHook(() => usePdfPremium())
    result.current.trackPaywallView('export-screen')
    expect(mockedQueueAnalyticsEvent).toHaveBeenCalledWith('Premium_Paywall_View', {
      context: 'export-screen',
    })
  })
})
