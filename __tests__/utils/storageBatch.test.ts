import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  getStorageBatch,
  setStorageBatch,
  removeStorageBatch,
  getAllStorageKeys,
  clearAllStorage,
} from '@/utils/storageBatch'

jest.mock('@react-native-async-storage/async-storage', () => ({
  getMany: jest.fn(),
  setMany: jest.fn(),
  removeMany: jest.fn(),
  getAllKeys: jest.fn(),
  clear: jest.fn(),
}))

const mockedStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>

describe('storageBatch utils', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getStorageBatch', () => {
    it('returns empty object for empty keys', async () => {
      const result = await getStorageBatch([])
      expect(result).toEqual({})
      expect(mockedStorage.getMany).not.toHaveBeenCalled()
    })

    it('returns key-value map from getMany', async () => {
      mockedStorage.getMany.mockResolvedValueOnce({
        k1: 'v1',
        k2: null,
      })

      const result = await getStorageBatch(['k1', 'k2'])

      expect(mockedStorage.getMany).toHaveBeenCalledWith(['k1', 'k2'])
      expect(result).toEqual({ k1: 'v1', k2: null })
    })

    it('returns null for all keys when getMany throws', async () => {
      mockedStorage.getMany.mockRejectedValueOnce(new Error('boom'))

      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})

      const result = await getStorageBatch(['a', 'b'])

      expect(result).toEqual({ a: null, b: null })
      expect(mockedStorage.getMany).toHaveBeenCalled()

      consoleError.mockRestore()
    })
  })

  describe('setStorageBatch', () => {
    it('does nothing for empty items', async () => {
      await setStorageBatch([])
      expect(mockedStorage.setMany).not.toHaveBeenCalled()
    })

    it('calls setMany with items', async () => {
      const items: Array<[string, string]> = [
        ['a', '1'],
        ['b', '2'],
      ]

      await setStorageBatch(items)
      expect(mockedStorage.setMany).toHaveBeenCalledWith({ a: '1', b: '2' })
    })

    it('rethrows error when setMany fails', async () => {
      const error = new Error('set failed')
      mockedStorage.setMany.mockRejectedValueOnce(error)
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})

      await expect(setStorageBatch([['a', '1']])).rejects.toBe(error)

      consoleError.mockRestore()
    })
  })

  describe('removeStorageBatch', () => {
    it('does nothing for empty keys', async () => {
      await removeStorageBatch([])
      expect(mockedStorage.removeMany).not.toHaveBeenCalled()
    })

    it('calls removeMany with keys', async () => {
      await removeStorageBatch(['a', 'b'])
      expect(mockedStorage.removeMany).toHaveBeenCalledWith(['a', 'b'])
    })

    it('swallows errors from removeMany', async () => {
      mockedStorage.removeMany.mockRejectedValueOnce(new Error('remove failed'))
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})

      await removeStorageBatch(['a'])

      // Ошибка не должна пробрасываться наружу
      expect(mockedStorage.removeMany).toHaveBeenCalled()

      consoleError.mockRestore()
    })
  })

  describe('getAllStorageKeys', () => {
    it('returns keys array when getAllKeys succeeds', async () => {
      mockedStorage.getAllKeys.mockResolvedValueOnce(['x', 'y'])

      const keys = await getAllStorageKeys()
      expect(keys).toEqual(['x', 'y'])
    })

    it('returns empty array when getAllKeys throws', async () => {
      mockedStorage.getAllKeys.mockRejectedValueOnce(new Error('failed'))
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})

      const keys = await getAllStorageKeys()
      expect(keys).toEqual([])

      consoleError.mockRestore()
    })
  })

  describe('clearAllStorage', () => {
    it('calls AsyncStorage.clear on success', async () => {
      await clearAllStorage()
      expect(mockedStorage.clear).toHaveBeenCalled()
    })

    it('rethrows error when clear fails', async () => {
      const error = new Error('clear failed')
      mockedStorage.clear.mockRejectedValueOnce(error)
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})

      await expect(clearAllStorage()).rejects.toBe(error)

      consoleError.mockRestore()
    })
  })
})
