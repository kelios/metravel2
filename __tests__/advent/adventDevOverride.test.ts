import { Platform } from 'react-native'

import { getAdventNow, readDevTodayOverride } from '@/constants/advent'

const setSearch = (search: string) => {
  window.history.replaceState({}, '', `/advent${search}`)
}

describe('DEV-only ?today= override (#2861)', () => {
  const originalEnv = process.env.NODE_ENV
  afterEach(() => {
    process.env.NODE_ENV = originalEnv
    setSearch('')
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' })
  })

  it('reads a valid date from the query on web outside production', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' })
    process.env.NODE_ENV = 'development'
    setSearch('?today=2026-12-03')
    expect(readDevTodayOverride()?.getDate()).toBe(3)
    expect(getAdventNow().getMonth()).toBe(11)
  })

  it('ignores malformed values', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' })
    process.env.NODE_ENV = 'development'
    setSearch('?today=tomorrow')
    expect(readDevTodayOverride()).toBeNull()
  })

  it('is disabled in production builds and on native', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' })
    process.env.NODE_ENV = 'production'
    setSearch('?today=2026-12-03')
    expect(readDevTodayOverride()).toBeNull()
    process.env.NODE_ENV = 'development'
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' })
    expect(readDevTodayOverride()).toBeNull()
  })
})
