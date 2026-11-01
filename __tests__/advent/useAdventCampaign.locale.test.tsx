/**
 * #2883 — хук кампании отдаёт контент дверец на активной локали и возвращает RU
 * при обратном переключении; даты, ссылки и ответы не меняются.
 */
import { act, renderHook } from '@testing-library/react-native'

import { useAdventCampaign } from '@/hooks/useAdventCampaign'
import { getAdventCampaign } from '@/services/advent/loadCampaign'
import { i18n } from '@/i18n'
import { fakeToday } from './fakeToday'

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: false, userId: null, authReady: true }),
}))

const be = require('../../data/advent/2026.be.json') as { doors: Record<string, { gift: { title: string } }> }

describe('useAdventCampaign — контент по локали (#2883)', () => {
  afterEach(async () => {
    jest.useRealTimers()
    await i18n.changeLanguage('ru')
  })

  it('BE-локаль даёт переведённый подарок, RU — исходный', async () => {
    fakeToday(new Date(2026, 11, 3, 12))
    await i18n.changeLanguage('ru')
    const { result } = await renderHook(() => useAdventCampaign())
    expect(result.current.doors[0].gift.title).toBe(getAdventCampaign().doors[0].gift.title)

    await act(async () => {
      await i18n.changeLanguage('be')
    })
    expect(result.current.doors[0].gift.title).toBe(be.doors['1'].gift.title)
    expect(result.current.doors[0].gift.link).toBe(getAdventCampaign().doors[0].gift.link)
    expect(result.current.doors[2].task.riddle?.questions[0].answer_pattern).toEqual(
      getAdventCampaign().doors[2].task.riddle?.questions[0].answer_pattern,
    )
    expect(result.current.doors[0].state).toBe('available')

    await act(async () => {
      await i18n.changeLanguage('ru')
    })
    expect(result.current.doors[0].gift.title).toBe(getAdventCampaign().doors[0].gift.title)
  })
})

describe('useAdventCampaign({ content: false })', () => {
  it('счётчики без переводов: тексты остаются RU даже на BE', async () => {
    fakeToday(new Date(2026, 11, 3, 12))
    await i18n.changeLanguage('be')
    const { result } = await renderHook(() => useAdventCampaign({ content: false }))
    expect(result.current.doors[0].gift.title).toBe(getAdventCampaign().doors[0].gift.title)
    expect(result.current.isInWindow).toBe(true)
  })
})
