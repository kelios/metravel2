import campaign from '@/data/advent/2026.json'
import type { AdventCampaignConfig } from '@/types/advent'
import { isAdventCampaignWindow, toLocalIsoDate } from '@/constants/advent'
import {
  computeStreak,
  countOpenedMain,
  findNextLockedDoor,
  findTodayDoor,
  getDoorState,
  isCampaignDay,
  millisecondsUntilDoor,
} from '@/utils/advent/adventCalendar'

const config = campaign as AdventCampaignConfig
const doors = config.doors
const empty = { opened: {}, tasksDone: {} }
const statesOn = (iso: string, progress = empty) => doors.map((door) => getDoorState(door, iso, progress))

describe('advent calendar door states (#2861)', () => {
  it('keeps every door locked on 30.11 and shows door 1 as the next one', () => {
    expect(new Set(statesOn('2026-11-30'))).toEqual(new Set(['locked']))
    expect(findNextLockedDoor(doors, '2026-11-30')?.day).toBe(1)
    expect(isCampaignDay(config, '2026-11-30')).toBe(false)
  })

  it('opens exactly door 1 on 01.12 by local date', () => {
    const states = statesOn('2026-12-01')
    expect(states[0]).toBe('available')
    expect(states.slice(1).every((state) => state === 'locked')).toBe(true)
    expect(findTodayDoor(doors, '2026-12-01')?.day).toBe(1)
    expect(isCampaignDay(config, '2026-12-01')).toBe(true)
  })

  it('makes doors 1–3 available on 03.12 and keeps 4–27 locked with dates', () => {
    const states = statesOn('2026-12-03')
    expect(states.slice(0, 3)).toEqual(['available', 'available', 'available'])
    expect(states.slice(3).every((state) => state === 'locked')).toBe(true)
    expect(findNextLockedDoor(doors, '2026-12-03')?.date).toBe('2026-12-04')
  })

  it('opens all 24 main doors on 24.12 and the first bonus on 25.12', () => {
    expect(statesOn('2026-12-24').filter((state) => state === 'available')).toHaveLength(24)
    const christmas = statesOn('2026-12-25')
    expect(christmas.filter((state) => state === 'available')).toHaveLength(25)
    expect(christmas[25]).toBe('locked')
    expect(findNextLockedDoor(doors, '2026-12-25')?.date).toBe('2026-12-31')
  })

  it('opens the secret door on 07.01 and keeps everything open after the window', () => {
    expect(statesOn('2027-01-07').every((state) => state === 'available')).toBe(true)
    expect(findNextLockedDoor(doors, '2027-01-07')).toBeNull()
    expect(statesOn('2027-01-08').every((state) => state === 'available')).toBe(true)
    expect(isCampaignDay(config, '2027-01-08')).toBe(false)
  })

  it('reflects opened and done progress per door', () => {
    const progress = { opened: { '1': '2026-12-01', '2': '2026-12-02' }, tasksDone: { '1': '2026-12-01' } }
    const states = statesOn('2026-12-02', progress)
    expect(states[0]).toBe('done')
    expect(states[1]).toBe('opened')
    expect(countOpenedMain(doors, progress)).toBe(2)
  })

  it('counts a same-day streak and resets it after a missed day', () => {
    const onTime = { opened: { '1': '2026-12-01', '2': '2026-12-02', '3': '2026-12-03' }, tasksDone: {} }
    expect(computeStreak(doors, '2026-12-03', onTime)).toBe(3)
    // 04.12 not opened yet today: the streak holds until the day passes.
    expect(computeStreak(doors, '2026-12-04', onTime)).toBe(3)
    // 05.12 arrives with door 4 never opened: the streak is gone, door 4 still opens.
    expect(computeStreak(doors, '2026-12-05', onTime)).toBe(0)
    expect(getDoorState(doors[3], '2026-12-05', onTime)).toBe('available')
    const late = { opened: { ...onTime.opened, '4': '2026-12-05', '5': '2026-12-05' }, tasksDone: {} }
    expect(computeStreak(doors, '2026-12-05', late)).toBe(1)
  })

  it('ignores bonus doors in the streak', () => {
    const opened: Record<string, string> = {}
    doors.slice(0, 24).forEach((door) => {
      opened[String(door.day)] = door.date
    })
    expect(computeStreak(doors, '2026-12-31', { opened, tasksDone: {} })).toBe(24)
  })

  it('counts down to the local midnight of the next door', () => {
    const now = new Date(2026, 11, 3, 22, 30)
    expect(millisecondsUntilDoor(doors[3], now)).toBe(90 * 60 * 1000)
  })
})

describe('campaign window by local date', () => {
  it('uses the client calendar date, not UTC', () => {
    expect(toLocalIsoDate(new Date(2026, 11, 1, 0, 0, 1))).toBe('2026-12-01')
    expect(toLocalIsoDate(new Date(2026, 10, 30, 23, 59, 59))).toBe('2026-11-30')
  })

  it('is open from 01.12 to 07.01 inclusive', () => {
    expect(isAdventCampaignWindow(new Date(2026, 10, 30, 12))).toBe(false)
    expect(isAdventCampaignWindow(new Date(2026, 11, 1, 0, 0, 1))).toBe(true)
    expect(isAdventCampaignWindow(new Date(2027, 0, 7, 23, 59))).toBe(true)
    expect(isAdventCampaignWindow(new Date(2027, 0, 8, 0, 0, 1))).toBe(false)
  })
})
