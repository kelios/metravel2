import { act, renderHook } from '@testing-library/react-native'
import { AppState, Linking, Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

import { rememberActiveQuestRoute, readActiveQuestRouteForResume } from '@/utils/activeQuestResume'

const mockPush = jest.fn()
let mockPathname = '/'
let mockRootNavigationState: { key?: string } | undefined = { key: 'root' }
const mockGetInitialNotificationResponse = jest.fn()
const mockGetInitialURL = jest.fn()
// В jest-setup мок Linking без getInitialURL.
;(Linking as unknown as { getInitialURL: typeof mockGetInitialURL }).getInitialURL = mockGetInitialURL

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => mockPathname,
  useRootNavigationState: () => mockRootNavigationState,
}))

jest.mock('@/services/notifications', () => ({
  getInitialNotificationResponse: () => mockGetInitialNotificationResponse(),
}))

const { useResumeActiveQuest } =
  require('@/hooks/useResumeActiveQuest.native') as typeof import('@/hooks/useResumeActiveQuest.native')
const { useRememberActiveQuestRoute } =
  require('@/hooks/useRememberActiveQuestRoute') as typeof import('@/hooks/useRememberActiveQuestRoute')

const QUEST = '/quests/minsk/minsk-cmok'
const originalPlatformOS = Platform.OS

const flush = async () => {
  await act(async () => {
    for (let i = 0; i < 5; i += 1) await Promise.resolve()
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

beforeEach(async () => {
  await AsyncStorage.clear()
  mockPush.mockReset()
  mockPathname = '/'
  mockRootNavigationState = { key: 'root' }
  mockGetInitialNotificationResponse.mockReset().mockResolvedValue(null)
  mockGetInitialURL.mockReset().mockResolvedValue(null)
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' })
})

afterEach(() => {
  jest.restoreAllMocks()
  Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatformOS })
})

describe('useResumeActiveQuest', () => {
  it('reopens the remembered quest on a cold start at home', async () => {
    await rememberActiveQuestRoute(QUEST)
    await renderHook(() => useResumeActiveQuest())
    await flush()
    expect(mockPush).toHaveBeenCalledTimes(1)
    expect(mockPush).toHaveBeenCalledWith(QUEST)
  })

  it('waits for the navigation container', async () => {
    await rememberActiveQuestRoute(QUEST)
    mockRootNavigationState = undefined
    const { rerender } = await renderHook(() => useResumeActiveQuest())
    await flush()
    expect(mockPush).not.toHaveBeenCalled()

    mockRootNavigationState = { key: 'root' }
    await rerender({})
    await flush()
    expect(mockPush).toHaveBeenCalledWith(QUEST)
  })

  it('does nothing without a remembered quest', async () => {
    await renderHook(() => useResumeActiveQuest())
    await flush()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('yields to a deep link launch', async () => {
    await rememberActiveQuestRoute(QUEST)
    mockGetInitialURL.mockResolvedValue('https://metravel.by/travels/x')
    await renderHook(() => useResumeActiveQuest())
    await flush()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('yields to a notification tap launch', async () => {
    await rememberActiveQuestRoute(QUEST)
    mockGetInitialNotificationResponse.mockResolvedValue({ id: 'n1', data: { url: '/travels/x' } })
    await renderHook(() => useResumeActiveQuest())
    await flush()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('does not move a user who is already off the home screen', async () => {
    await rememberActiveQuestRoute(QUEST)
    mockPathname = '/travels/x'
    await renderHook(() => useResumeActiveQuest())
    await flush()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('decides once per launch', async () => {
    await rememberActiveQuestRoute(QUEST)
    const { rerender } = await renderHook(() => useResumeActiveQuest())
    await flush()
    await rerender({})
    await flush()
    expect(mockPush).toHaveBeenCalledTimes(1)
  })
})

describe('useRememberActiveQuestRoute', () => {
  it('remembers the focused quest and forgets it on blur', async () => {
    const { rerender } = await renderHook(
      ({ active }: { active: boolean }) => useRememberActiveQuestRoute(QUEST, active),
      { initialProps: { active: true } },
    )
    await flush()
    await expect(readActiveQuestRouteForResume()).resolves.toBe(QUEST)

    await rerender({ active: false })
    await flush()
    await expect(readActiveQuestRouteForResume()).resolves.toBeNull()
  })

  it('keeps the record while the app goes to the background', async () => {
    const listeners: Array<(state: string) => void> = []
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, listener: (state: string) => void) => {
      listeners.push(listener)
      return { remove: jest.fn() }
    }) as never)

    await renderHook(() => useRememberActiveQuestRoute(QUEST, true))
    await flush()
    await act(async () => {
      listeners.forEach((listener) => listener('background'))
    })
    await flush()
    await expect(readActiveQuestRouteForResume()).resolves.toBe(QUEST)
  })

  it('is a no-op on web', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' })
    await renderHook(() => useRememberActiveQuestRoute(QUEST, true))
    await flush()
    await expect(readActiveQuestRouteForResume()).resolves.toBeNull()
  })
})
