// PUSH-2: уход владельца сессии (выход, инвалидация, смена аккаунта) снимает
// его локальные квестовые напоминания. Вход гостя и восстановление сессии на
// старте напоминаний не трогают.

import { Platform } from 'react-native'

jest.mock('@/api/quests', () => ({ fetchQuestsList: jest.fn() }))
jest.mock('@/api/auth', () => ({
  logoutApi: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('@/api/user', () => ({ fetchUserProfile: jest.fn().mockResolvedValue(null) }))
jest.mock('@/utils/authTokenStore', () => ({
  clearSessionTokens: jest.fn().mockResolvedValue(undefined),
  getSessionWriteMark: jest.fn().mockReturnValue(0),
  persistSessionTokens: jest.fn().mockResolvedValue('persisted'),
}))
jest.mock('@/utils/storageBatch', () => ({
  removeStorageBatch: jest.fn().mockResolvedValue(undefined),
  setStorageBatch: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('@/services/pushRegistration', () => ({
  unregisterPushBeforeLogout: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('@/services/notifications', () => ({
  cancelScheduledQuestReminders: jest.fn().mockResolvedValue(undefined),
}))

const { useAuthStore, resetAuthStoreForTests } =
  require('@/stores/authStore') as typeof import('@/stores/authStore')
const { cancelScheduledQuestReminders } =
  require('@/services/notifications') as { cancelScheduledQuestReminders: jest.Mock }

const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

const signedIn = (userId: string) => ({
  isAuthenticated: true,
  authReady: true,
  userId,
  userName: userId,
  userToken: `token-${userId}`,
})

describe('PUSH-2: quest reminders are cancelled when the session owner leaves', () => {
  const originalPlatformOS = Platform.OS

  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' })
    resetAuthStoreForTests()
    jest.clearAllMocks()
  })

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatformOS })
    resetAuthStoreForTests()
  })

  it('logout cancels the scheduled quest reminders', async () => {
    useAuthStore.setState(signedIn('A'))
    await tick()
    expect(cancelScheduledQuestReminders).not.toHaveBeenCalled()

    await useAuthStore.getState().logout()
    await tick()

    expect(cancelScheduledQuestReminders).toHaveBeenCalledTimes(1)
  })

  it('switching directly to another account cancels the previous owner reminders', async () => {
    useAuthStore.setState(signedIn('A'))
    await tick()

    useAuthStore.setState(signedIn('B'))
    await tick()

    expect(cancelScheduledQuestReminders).toHaveBeenCalledTimes(1)
  })

  it('a guest signing in does not cancel anything', async () => {
    useAuthStore.setState({ isAuthenticated: false, authReady: true, userId: null })
    await tick()

    useAuthStore.setState(signedIn('A'))
    await tick()

    expect(cancelScheduledQuestReminders).not.toHaveBeenCalled()
  })

  it('web never loads the native notifications module', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' })
    useAuthStore.setState(signedIn('A'))
    await tick()

    await useAuthStore.getState().logout()
    await tick()

    expect(cancelScheduledQuestReminders).not.toHaveBeenCalled()
  })
})
