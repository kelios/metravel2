import React from 'react'
import { act, render } from '@testing-library/react-native'
import { Platform } from 'react-native'

import AdventCountdown, { formatUntil } from '@/components/advent/AdventCountdown'
import type { AdventDoorView } from '@/hooks/useAdventCampaign'
import { millisecondsUntilDoor } from '@/utils/advent/adventCalendar'

/**
 * #3467: `useLocalCalendarDate` в тот же день больше не отдаёт новый Date на
 * возврат во вкладку, поэтому отсчёт сам догоняет часы по focus/visibility,
 * а не ждёт следующего минутного тика.
 */
describe('AdventCountdown', () => {
  const door = { day: 5, date: '2026-12-05', state: 'locked' } as unknown as AdventDoorView

  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' })
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('catches up immediately when the tab regains focus on the same day', async () => {
    const now = new Date(2026, 11, 4, 10, 0, 0)
    jest.setSystemTime(now)
    const { getByTestId } = await render(<AdventCountdown nextDoor={door} now={now} hydrated />)
    const initialText = getByTestId('advent-countdown').props.children
    expect(initialText).toContain(formatUntil(millisecondsUntilDoor(door, now)))

    // Вкладка пролежала в фоне 13 часов 30 минут; минутный тик ещё не пришёл.
    const later = new Date(2026, 11, 4, 23, 30, 0)
    jest.setSystemTime(later)
    await act(async () => {
      window.dispatchEvent(new Event('focus'))
    })

    expect(getByTestId('advent-countdown').props.children).toContain(
      formatUntil(millisecondsUntilDoor(door, later)),
    )
  })

  it('counts from the wall clock when mounted later the same day than the base now', async () => {
    // Хук кампании держит утренний объект весь день; шторку дока открыли вечером.
    const base = new Date(2026, 11, 4, 10, 0, 0)
    const evening = new Date(2026, 11, 4, 16, 0, 0)
    jest.setSystemTime(evening)
    const { getByTestId } = await render(<AdventCountdown nextDoor={door} now={base} hydrated />)

    expect(getByTestId('advent-countdown').props.children).toContain(
      formatUntil(millisecondsUntilDoor(door, evening)),
    )
  })
})
