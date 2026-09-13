import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  setSecureItem,
  getSecureItem,
  readSecureItem,
  removeSecureItem,
  isSecureStorageAvailable,
} from '@/utils/secureStorage'

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

  it('falls back to in-memory store when localStorage is not available', async () => {
    ;(global.window as any).localStorage = undefined

    await setSecureItem('token', 'value')
    // No AsyncStorage write on web — value is kept in the per-session memory store.
    expect(AsyncStorage.setItem).not.toHaveBeenCalled()

    const value = await getSecureItem('token')
    expect(value).toBe('value')
  })

  it('keeps a non-auth secret readable in memory when setItem throws', async () => {
    ;(global.window as any).localStorage.setItem = jest.fn(() => {
      throw new DOMException('QuotaExceededError', 'QuotaExceededError')
    })

    await expect(setSecureItem('privatePreference', 'value-123')).resolves.toBeUndefined()

    // getItem still returns null (nothing persisted), so the read must fall back
    // to the in-memory copy written during the failed setItem.
    const value = await getSecureItem('privatePreference')
    expect(value).toBe('value-123')
  })

  it('does not throw when accessing localStorage throws (block-all-cookies)', async () => {
    Object.defineProperty(global.window as any, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('The operation is insecure.', 'SecurityError')
      },
    })

    await expect(setSecureItem('privatePreference', 'value-456')).resolves.toBeUndefined()
    const value = await getSecureItem('privatePreference')
    expect(value).toBe('value-456')
  })

  it('never persists or returns web auth tokens and purges legacy keys', async () => {
    ;(global.window as any).localStorage.setItem('secure_userToken', 'legacy-token')

    await expect(setSecureItem('userToken', 'new-token')).resolves.toBeUndefined()
    await expect(getSecureItem('userToken')).resolves.toBeNull()

    expect((global.window as any).localStorage.removeItem).toHaveBeenCalledWith('secure_userToken')
    expect((global.window as any).localStorage.getItem('secure_userToken')).toBeNull()
  })

  it('removes item from localStorage', async () => {
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
    mockSecureStore.getItemAsync.mockReset()
    mockSecureStore.getItemAsync.mockResolvedValue('native-value')
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

  // #1921: молчаливый `null` при сбое Keychain был неотличим от «токена нет» —
  // приложение оставалось «залогиненным» и отправляло запись без заголовка
  // авторизации, теряя её.
  it('перечитывает хранилище при сбое и возвращает значение со второй попытки', async () => {
    mockSecureStore.getItemAsync
      .mockRejectedValueOnce(new Error('keychain busy'))
      .mockResolvedValueOnce('native-value')

    const read = await readSecureItem('token')

    expect(mockSecureStore.getItemAsync).toHaveBeenCalledTimes(2)
    expect(read).toEqual({ value: 'native-value', unavailable: false })
  })

  it('отличает отказ хранилища от пустого значения', async () => {
    mockSecureStore.getItemAsync.mockRejectedValue(new Error('keychain unavailable'))

    const failed = await readSecureItem('token')
    expect(failed).toEqual({ value: null, unavailable: true })

    mockSecureStore.getItemAsync.mockReset()
    mockSecureStore.getItemAsync.mockResolvedValue(null)

    const empty = await readSecureItem('token')
    expect(empty).toEqual({ value: null, unavailable: false })
    // Старый контракт не меняется: `getSecureItem` по-прежнему отдаёт значение.
    expect(await getSecureItem('token')).toBeNull()
  })

  it('checks native secure storage availability via expo-secure-store', async () => {
    const available = await isSecureStorageAvailable()
    expect(mockSecureStore.isAvailableAsync).toHaveBeenCalled()
    expect(available).toBe(true)
  })
})
