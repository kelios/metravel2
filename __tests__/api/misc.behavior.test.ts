import {
  saveFormData,
  uploadImage,
  deleteImage,
  fetchFilters,
  fetchFiltersCountry,
  fetchAllCountries,
  sendFeedback,
  sendAIMessage,
} from '@/src/api/misc'
import type { TravelFormData } from '@/src/types/types'

const mockGetSecureItem = jest.fn()
const mockFetchWithTimeout = jest.fn()
const mockSafeJsonParse = jest.fn()
const mockValidateImageFile = jest.fn()
const mockValidateAIMessage = jest.fn()
const mockSanitizeInput = jest.fn((...args: any[]) => args[0])
const mockDevError = jest.fn()
const mockApiClientPut = jest.fn()
const mockApiClientUploadFormData = jest.fn()
const mockApiClientRequest = jest.fn()
const mockApiClientDelete = jest.fn()

jest.mock('@/src/utils/secureStorage', () => ({
  getSecureItem: (...args: any[]) => mockGetSecureItem(...args),
}))

jest.mock('@/src/utils/fetchWithTimeout', () => ({
  fetchWithTimeout: (...args: any[]) => mockFetchWithTimeout(...args),
}))

jest.mock('@/src/utils/safeJsonParse', () => ({
  safeJsonParse: (...args: any[]) => mockSafeJsonParse(...args),
}))

jest.mock('@/src/utils/validation', () => ({
  validateImageFile: (...args: any[]) => mockValidateImageFile(...args),
  validateAIMessage: (...args: any[]) => mockValidateAIMessage(...args),
}))

jest.mock('@/src/utils/security', () => ({
  sanitizeInput: (...args: any[]) => mockSanitizeInput(...args),
}))

jest.mock('@/src/utils/logger', () => ({
  devError: (...args: any[]) => mockDevError(...args),
}))

jest.mock('@/src/api/client', () => ({
  apiClient: {
    put: (...args: any[]) => mockApiClientPut(...args),
    uploadFormData: (...args: any[]) => mockApiClientUploadFormData(...args),
    request: (...args: any[]) => mockApiClientRequest(...args),
    delete: (...args: any[]) => mockApiClientDelete(...args),
  },
}))

const baseForm = ({
  id: '1',
  slug: 'trip',
  name: 'Trip',
  travel_image_thumb_url: '',
  travel_image_thumb_small_url: '',
  url: '/trip',
  youtube_link: '',
  userName: 'Tester',
  description: '',
  recommendation: '',
  plus: '',
  minus: '',
  cityName: '',
  countryName: '',
  countUnicIpView: '',
  gallery: [],
  travelAddress: [],
  userIds: '',
  year: '',
  monthName: '',
  number_days: 0,
  companions: [],
  countryCode: '',
} as unknown) as TravelFormData

describe('api/misc', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    ;(global as any).File = class FakeFile {}
  })

  it('saveFormData requires auth and propagates non-ok responses', async () => {
    mockGetSecureItem.mockResolvedValue(null)
    await expect(saveFormData(baseForm)).rejects.toThrow('Пользователь не авторизован')

    mockGetSecureItem.mockResolvedValue('token')
    mockApiClientPut.mockRejectedValue(new Error('Ошибка при создании записи на сервере'))
    await expect(saveFormData(baseForm)).rejects.toThrow('Ошибка при создании записи на сервере')
  })

  it('saveFormData returns parsed response on success', async () => {
    mockGetSecureItem.mockResolvedValue('token')
    mockApiClientPut.mockResolvedValue({ ...baseForm, id: 2 })

    const result = await saveFormData(baseForm)
    expect(result.id).toBe(2)
    expect(mockApiClientPut).toHaveBeenCalled()
  })

  it('uploadImage validates file and requires token', async () => {
    mockGetSecureItem.mockResolvedValue(null)
    await expect(uploadImage(new FormData())).rejects.toThrow('Пользователь не авторизован')

    mockGetSecureItem.mockResolvedValue('token')
    mockValidateImageFile.mockReturnValue({ valid: false, error: 'bad' })
    class CustomFormData extends FormData {
      get(name: string) {
        return new File([], `${name}.png`)
      }
    }
    const fd = new CustomFormData()
    fd.append('file', new File([], 'a.png'))
    await expect(uploadImage(fd)).rejects.toThrow('bad')
  })

  it('uploadImage posts to API and parses response', async () => {
    mockGetSecureItem.mockResolvedValue('token')
    mockValidateImageFile.mockReturnValue({ valid: true })
    mockApiClientUploadFormData.mockResolvedValue({ ok: true })

    const fd = new FormData()
    fd.append('file', new File([], 'a.png'))
    const result = await uploadImage(fd)
    expect(result).toEqual({ ok: true })
  })

  it('uploadImage throws error text on non-200 responses', async () => {
    mockGetSecureItem.mockResolvedValue('token')
    mockValidateImageFile.mockReturnValue({ valid: true })

    mockApiClientUploadFormData.mockRejectedValue(new Error('server failed'))

    const fd = new FormData()
    fd.append('file', new File([], 'a.png'))

    await expect(uploadImage(fd)).rejects.toThrow('server failed')
  })

  it('deleteImage enforces auth and success status', async () => {
    mockGetSecureItem.mockResolvedValue(null)
    await expect(deleteImage('1')).rejects.toThrow('Пользователь не авторизован')

    mockGetSecureItem.mockResolvedValue('token')
    mockApiClientPut.mockResolvedValue(undefined)
    mockApiClientUploadFormData.mockResolvedValue(undefined)
    mockApiClientDelete.mockResolvedValue({ status: 204 })
    await expect(deleteImage('1')).resolves.toBeDefined()

    mockApiClientDelete.mockRejectedValue(new Error('bad'))
    await expect(deleteImage('1')).rejects.toThrow('Ошибка удаления изображения')
  })

  it('fetchFilters and country/all fall back to empty on errors', async () => {
    mockFetchWithTimeout.mockRejectedValue(new Error('network'))
    const filters = await fetchFilters()
    const countries = await fetchFiltersCountry()
    const all = await fetchAllCountries()
    expect(filters).toEqual([])
    expect(countries).toEqual([])
    expect(all).toEqual([])
    expect(mockDevError).toHaveBeenCalled()
  })

  it('sendFeedback validates required fields and server errors', async () => {
    await expect(sendFeedback('', ' ', ' ')).rejects.toThrow('Все поля должны быть заполнены')

    mockSanitizeInput.mockImplementation((v: string) => v.trim())
    mockFetchWithTimeout.mockResolvedValue({ ok: false })
    mockSafeJsonParse.mockResolvedValue({ message: 'oops' })
    await expect(sendFeedback('A', 'b@c.com', 'Hi')).rejects.toThrow('oops')
  })

  it('sendFeedback prefers field-specific validation errors when present', async () => {
    mockSanitizeInput.mockImplementation((v: string) => v.trim())
    mockFetchWithTimeout.mockResolvedValue({ ok: false })
    mockSafeJsonParse.mockResolvedValue({ email: ['bad email'], detail: 'fallback' })

    await expect(sendFeedback('A', 'b@c.com', 'Hi')).rejects.toThrow('bad email')
  })

  it('sendAIMessage validates input and handles success', async () => {
    mockValidateAIMessage.mockReturnValue({ valid: false, error: 'bad' })
    await expect(sendAIMessage(' ')).rejects.toThrow('bad')

    mockValidateAIMessage.mockReturnValue({ valid: true })
    mockFetchWithTimeout.mockResolvedValue({ ok: true })
    mockSafeJsonParse.mockResolvedValue({ answer: 'hi' })

    const res = await sendAIMessage('hello')
    expect(res).toEqual({ answer: 'hi' })
  })

  it('sendAIMessage throws when server responds non-ok', async () => {
    mockValidateAIMessage.mockReturnValue({ valid: true })
    mockFetchWithTimeout.mockResolvedValue({ ok: false, statusText: 'Bad Request' })

    await expect(sendAIMessage('hello')).rejects.toThrow('AI request failed: Bad Request')
  })
})
