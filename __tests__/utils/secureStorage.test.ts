import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  setSecureItem,
  getSecureItem,
  removeSecureItem,
  isSecureStorageAvailable,
} from '@/src/utils/secureStorage'

const originalPlatformOS = Platform.OS
const originalWindow = global.window

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    setItem: jest.fn().mockResolvedValue(undefined),
    getItem: jest.fn().mockResolvedValue(null),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}))

const mockSecureStore: any = {
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  getItemAsync: jest.fn().mockResolvedValue('native-value'),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
  isAvailableAsync: jest.fn().mockResolvedValue(true),
}

jest.mock('expo-secure-store', () => mockSecureStore)

describe('secureStorage (web)', () => {
  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'web',
    })

    const local: Record<string, string> = {}
    const session: Record<string, string> = {}
    global.window = {
      localStorage: {
        getItem: jest.fn((key: string) => local[key] ?? null),
        setItem: jest.fn((key: string, value: string) => {
          local[key] = value
        }),
        removeItem: jest.fn((key: string) => {
          delete local[key]
        }),
      },
      sessionStorage: {
        getItem: jest.fn((key: string) => session[key] ?? null),
        setItem: jest.fn((key: string, value: string) => {
          session[key] = value
        }),
        removeItem: jest.fn((key: string) => {
          delete session[key]
        }),
      },
    } as any

    ;(AsyncStorage.setItem as jest.Mock).mockClear()
    ;(AsyncStorage.getItem as jest.Mock).mockClear()
    ;(AsyncStorage.removeItem as jest.Mock).mockClear()
  })

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: originalPlatformOS,
    })
    global.window = originalWindow as any
  })

  it('stores and retrieves value via localStorage with encryption', async () => {
    await setSecureItem('token', 'secret-value')

    const raw = (global.window as any).localStorage.getItem('secure_token')
    expect(raw).not.toBeNull()
    expect(raw).not.toBe('secret-value')

    const value = await getSecureItem('token')
    expect(value).toBe('secret-value')

    expect(AsyncStorage.setItem).not.toHaveBeenCalled()
    expect(AsyncStorage.getItem).not.toHaveBeenCalled()
  })

  it('falls back to AsyncStorage when localStorage is not available', async () => {
    ;(global.window as any).localStorage = undefined

    await setSecureItem('token', 'value')

    expect(AsyncStorage.setItem).toHaveBeenCalled()

    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
      (AsyncStorage.setItem as jest.Mock).mock.calls[0][1],
    )
    const value = await getSecureItem('token')
    expect(value).toBe('value')
  })

  it('removes item from sessionStorage', async () => {
    await setSecureItem('key', 'v')

    await removeSecureItem('key')

    expect((global.window as any).localStorage.removeItem).toHaveBeenCalledWith('secure_key')
  })

  it('checks availability of web secure storage', async () => {
    const available = await isSecureStorageAvailable()
    expect(available).toBe(true)
  })
})

describe('secureStorage (native)', () => {
  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'ios',
    })

    mockSecureStore.setItemAsync.mockClear()
    mockSecureStore.getItemAsync.mockClear()
    mockSecureStore.deleteItemAsync.mockClear()
    mockSecureStore.isAvailableAsync.mockClear()

    ;(AsyncStorage.setItem as jest.Mock).mockClear()
    ;(AsyncStorage.getItem as jest.Mock).mockClear()
    ;(AsyncStorage.removeItem as jest.Mock).mockClear()
  })

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: originalPlatformOS,
    })
  })

  it('uses expo-secure-store on native for set/get/remove', async () => {
    await setSecureItem('token', 'native-secret')
    expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith('token', 'native-secret')

    const value = await getSecureItem('token')
    expect(mockSecureStore.getItemAsync).toHaveBeenCalledWith('token')
    expect(value).toBe('native-value')

    await removeSecureItem('token')
    expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('token')
  })

  it('checks native secure storage availability via expo-secure-store', async () => {
    const available = await isSecureStorageAvailable()
    expect(mockSecureStore.isAvailableAsync).toHaveBeenCalled()
    expect(available).toBe(true)
  })
})
