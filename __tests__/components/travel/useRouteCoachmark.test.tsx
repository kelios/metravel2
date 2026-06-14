import AsyncStorage from '@react-native-async-storage/async-storage'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import { Platform } from 'react-native'

import {
  isRouteCoachmarkDismissed,
  persistRouteCoachmarkDismissed,
} from '@/components/travel/stepRoute/coachmarkStorage'
import { MAP_COACHMARK_STORAGE_KEY } from '@/components/travel/stepRoute/helpers'
import { useRouteCoachmark } from '@/components/travel/stepRoute/hooks'

const ORIGINAL_PLATFORM_OS = Platform.OS

function setPlatformOs(os: typeof Platform.OS) {
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    value: os,
  })
}

describe('RouteCoachmark persistence', () => {
  beforeEach(async () => {
    jest.clearAllMocks()
    setPlatformOs('web')
    window.localStorage.clear()
    await AsyncStorage.clear()
  })

  afterEach(() => {
    setPlatformOs(ORIGINAL_PLATFORM_OS)
  })

  it('keeps web behavior on localStorage without using AsyncStorage', async () => {
    window.localStorage.setItem(MAP_COACHMARK_STORAGE_KEY, '1')

    await expect(isRouteCoachmarkDismissed()).resolves.toBe(true)

    expect(AsyncStorage.getItem).not.toHaveBeenCalled()

    window.localStorage.removeItem(MAP_COACHMARK_STORAGE_KEY)
    await persistRouteCoachmarkDismissed()

    expect(window.localStorage.getItem(MAP_COACHMARK_STORAGE_KEY)).toBe('1')
    expect(AsyncStorage.setItem).not.toHaveBeenCalled()
  })

  it('persists dismiss state through AsyncStorage on native', async () => {
    setPlatformOs('ios')

    await expect(isRouteCoachmarkDismissed()).resolves.toBe(false)
    await persistRouteCoachmarkDismissed()

    expect(AsyncStorage.getItem).toHaveBeenCalledWith(MAP_COACHMARK_STORAGE_KEY)
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(MAP_COACHMARK_STORAGE_KEY, '1')
    await expect(isRouteCoachmarkDismissed()).resolves.toBe(true)
  })

  it('hydrates native coachmark visibility and stores dismiss action', async () => {
    setPlatformOs('android')

    const { result, unmount } = renderHook(() => useRouteCoachmark(false))

    await waitFor(() => {
      expect(result.current.isVisible).toBe(true)
    })

    await act(async () => {
      result.current.dismiss()
    })

    expect(result.current.isVisible).toBe(false)

    await waitFor(() => {
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(MAP_COACHMARK_STORAGE_KEY, '1')
    })

    unmount()

    const second = renderHook(() => useRouteCoachmark(false))

    await waitFor(() => {
      expect(second.result.current.isVisible).toBe(false)
    })
  })

  it('hides coachmark immediately when route already has points', async () => {
    setPlatformOs('android')

    const { result } = renderHook(() => useRouteCoachmark(true))

    expect(result.current.isVisible).toBe(false)
    expect(AsyncStorage.getItem).not.toHaveBeenCalled()
  })
})
