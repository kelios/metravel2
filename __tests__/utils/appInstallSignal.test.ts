import { Platform } from 'react-native'

import {
  emitAppInstallSignal,
  getAppInstallSignal,
  noteTravelViewForAppInstall,
  resetAppInstallSignalForTests,
  subscribeAppInstallSignal,
} from '@/utils/appInstallSignal'

describe('appInstallSignal (#2907)', () => {
  const originalPlatform = Platform.OS
  beforeAll(() => { Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' }) })
  afterAll(() => { Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform }) })
  beforeEach(() => {
    resetAppInstallSignalForTests()
    window.sessionStorage.clear()
  })

  it('keeps the first signal and notifies subscribers once', () => {
    const listener = jest.fn()
    const unsubscribe = subscribeAppInstallSignal(listener)
    emitAppInstallSignal('quest_start')
    emitAppInstallSignal('offline_save')
    expect(getAppInstallSignal()).toBe('quest_start')
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
  })

  it('signals the second distinct travel of a session, not a reload of the first', () => {
    noteTravelViewForAppInstall(101)
    noteTravelViewForAppInstall(101)
    expect(getAppInstallSignal()).toBeNull()
    noteTravelViewForAppInstall(202)
    expect(getAppInstallSignal()).toBe('second_travel')
  })

  it('ignores a travel without an id', () => {
    noteTravelViewForAppInstall(undefined)
    noteTravelViewForAppInstall('')
    expect(window.sessionStorage.length).toBe(0)
  })

  it('stays silent outside web', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' })
    try {
      emitAppInstallSignal('quest_start')
      expect(getAppInstallSignal()).toBeNull()
    } finally {
      Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' })
    }
  })
})
