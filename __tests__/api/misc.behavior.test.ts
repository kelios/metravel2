import {
  saveFormData,
  uploadImage,
  deleteImage,
  fetchFilters,
  fetchFiltersCountry,
  fetchAllCountries,
  sendFeedback,
  sendAIMessage,
  subscribeEmail,
} from '@/api/misc'
import type { TravelFormData } from '@/types/types'

const mockGetSecureItem = jest.fn()
const mockFetchWithTimeout = jest.fn()
const mockSafeJsonParse = jest.fn()
const mockValidateImageFile = jest.fn()
const mockValidateAIMessage = jest.fn()
const mockSanitizeInput = jest.fn((...args: any[]) => args[0])
const mockSanitizeRichText = jest.fn((...args: any[]) => args[0])
const mockDevError = jest.fn()
const mockApiClientPut = jest.fn()
const mockApiClientUploadFormData = jest.fn()
const mockApiClientRequest = jest.fn()
const mockApiClientDelete = jest.fn()

jest.mock('@/utils/secureStorage', () => ({
  getSecureItem: (...args: any[]) => mockGetSecureItem(...args),
}))

jest.mock('@/utils/fetchWithTimeout', () => ({
  fetchWithTimeout: (...args: any[]) => mockFetchWithTimeout(...args),
}))

jest.mock('@/utils/csrf', () => ({
  getCsrfHeader: () => ({ 'X-CSRFToken': 'test-csrf-token' }),
}))

jest.mock('@/utils/safeJsonParse', () => ({
  safeJsonParse: (...args: any[]) => mockSafeJsonParse(...args),
}))

jest.mock('@/utils/aiValidation', () => ({
  validateImageFile: (...args: any[]) => mockValidateImageFile(...args),
  validateAIMessage: (...args: any[]) => mockValidateAIMessage(...args),
}))

jest.mock('@/utils/security', () => ({
  sanitizeInput: (...args: any[]) => mockSanitizeInput(...args),
}))

jest.mock('@/utils/htmlUtils', () => ({
  stripBase64Images: (html: string) => html?.replace(/<img\s[^>]*src\s*=\s*["']data:[^"']+["'][^>]*\/?>/gi, '') ?? '',
}))

jest.mock('@/utils/sanitizeRichText', () => ({
  sanitizeRichText: (...args: any[]) => mockSanitizeRichText(...args),
}))

jest.mock('@/utils/logger', () => ({
  devError: (...args: any[]) => mockDevError(...args),
}))

jest.mock('@/api/client', () => ({
  apiClient: {
    put: (...args: any[]) => mockApiClientPut(...args),
    uploadFormData: (...args: any[]) => mockApiClientUploadFormData(...args),
    uploadFormDataWithProgress: (...args: any[]) => mockApiClientUploadFormData(...args),
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
    mockSanitizeInput.mockImplementation((...args: any[]) => args[0])
    mockSanitizeRichText.mockImplementation((...args: any[]) => args[0])
    ;(global as any).File = class FakeFile {}
  })

  it('saveFormData requires auth and propagates non-ok responses', async () => {
    mockGetSecureItem.mockResolvedValue(null)
    await expect(saveFormData(baseForm)).rejects.toThrow('Пользователь не авторизован')

    mockGetSecureItem.mockResolvedValue('token')
    mockApiClientRequest.mockRejectedValue(new Error('Ошибка при создании записи на сервере'))
    await expect(saveFormData(baseForm)).rejects.toThrow('Ошибка при создании записи на сервере')
  })

  it('saveFormData returns parsed response on success', async () => {
    mockGetSecureItem.mockResolvedValue('token')
    mockApiClientRequest.mockResolvedValue({ ...baseForm, id: 2 })

    const result = await saveFormData(baseForm)
    expect(result.id).toBe(2)
    expect(mockApiClientRequest).toHaveBeenCalled()
  })

  it('saveFormData sanitizes rich-text description without stripping supported embeds', async () => {
    mockGetSecureItem.mockResolvedValue('token')
    mockApiClientRequest.mockResolvedValue({ ...baseForm, id: 2 })
    mockSanitizeRichText.mockImplementation((value: string) => value)

    const description =
      '<p>Intro</p><iframe src="https://www.youtube.com/embed/Bk_gnrqrDww" width="560" height="315"></iframe>'

    await saveFormData({
      ...baseForm,
      description,
    })

    expect(mockSanitizeRichText).toHaveBeenCalledWith(description)
    expect(mockSanitizeInput).not.toHaveBeenCalledWith(description)

    const requestOptions = mockApiClientRequest.mock.calls[0][1]
    const body = JSON.parse(requestOptions.body)
    expect(body.description).toContain('<iframe')
    expect(body.description).toContain('youtube.com/embed/Bk_gnrqrDww')
  })

  it('saveFormData keeps duplicated array-reference fields in serialized payload', async () => {
    mockGetSecureItem.mockResolvedValue('token')
    mockApiClientRequest.mockResolvedValue({ ...baseForm, id: 2 })

    const shared = [3796] as any
    const payload = {
      ...baseForm,
      name: 'Valid travel name',
      thumbs200ForCollectionArr: shared,
      travelImageThumbUrlArr: shared,
      travelImageThumbUrArr: shared,
      travelImageAddress: shared,
    } as any

    await saveFormData(payload)

    const requestOptions = mockApiClientRequest.mock.calls[0][1]
    const body = JSON.parse(requestOptions.body)
    expect(body.thumbs200ForCollectionArr).toEqual([3796])
    expect(body.travelImageThumbUrlArr).toEqual([3796])
    expect(body.travelImageThumbUrArr).toEqual([3796])
    expect(body.travelImageAddress).toEqual([3796])
  })

  it('saveFormData allows draft autosave payload without a user-entered name', async () => {
    mockGetSecureItem.mockResolvedValue('token')
    mockApiClientRequest.mockResolvedValue({ ...baseForm, id: 2, name: '__draft_placeholder__name__abc123' })

    const payload = {
      ...baseForm,
      id: null,
      name: '',
      publish: false,
      moderation: false,
    } as any

    await expect(saveFormData(payload, undefined, { autosave: true })).resolves.toBeDefined()
    expect(mockApiClientRequest).toHaveBeenCalled()
  })

  it('saveFormData still requires name for manual draft save', async () => {
    mockGetSecureItem.mockResolvedValue('token')

    const payload = {
      ...baseForm,
      id: null,
      name: '',
      publish: false,
      moderation: false,
    } as any

    await expect(saveFormData(payload)).rejects.toThrow('Название обязательно для заполнения')
  })

  it('saveFormData rejects publish-intent payload when description is empty', async () => {
    mockGetSecureItem.mockResolvedValue('token')

    const payload = {
      ...baseForm,
      name: 'Valid travel name',
      description: '<p><br></p>',
      coordsMeTravel: [{ lat: 50, lng: 30, country: 1, address: 'Test', categories: [], image: '', id: 1 }],
      countries: ['1'],
      categories: ['1'],
      publish: true,
      moderation: false,
    } as any

    await expect(saveFormData(payload, undefined, { intent: 'publish' })).rejects.toThrow('description')
    expect(mockApiClientRequest).not.toHaveBeenCalled()
  })

  it('saveFormData rejects publish-intent payload when categories are empty', async () => {
    mockGetSecureItem.mockResolvedValue('token')

    const payload = {
      ...baseForm,
      name: 'Valid travel name',
      description: 'A'.repeat(60),
      coordsMeTravel: [{ lat: 50, lng: 30, country: 1, address: 'Test', categories: [], image: '', id: 1 }],
      countries: ['1'],
      categories: [],
      publish: true,
      moderation: false,
    } as any

    await expect(saveFormData(payload, undefined, { intent: 'publish' })).rejects.toThrow('categories')
    expect(mockApiClientRequest).not.toHaveBeenCalled()
  })

  it('saveFormData (background save intent) does NOT moderation-validate a published travel with empty categories', async () => {
    // Тикет #505: фоновый/инкрементальный сейв уже опубликованной поездки
    // (publish=true) не должен блокироваться требованием полноты категорий —
    // он лишь персистит текущее состояние и должен дойти до сетевого вызова.
    mockGetSecureItem.mockResolvedValue('token')
    mockApiClientRequest.mockResolvedValue({ ...baseForm, id: 225 })

    const payload = {
      ...baseForm,
      id: 225,
      name: 'Already published trip',
      description: 'A'.repeat(60),
      coordsMeTravel: [{ lat: 50, lng: 30, country: 1, address: 'Test', categories: [], image: '', id: 1 }],
      countries: ['1'],
      categories: [],
      publish: true,
      moderation: true,
    } as any

    await expect(saveFormData(payload, undefined, { intent: 'save' })).resolves.toBeDefined()
    expect(mockApiClientRequest).toHaveBeenCalled()
  })

  it('saveFormData (autosave intent) does NOT moderation-validate a published travel with empty categories', async () => {
    mockGetSecureItem.mockResolvedValue('token')
    mockApiClientRequest.mockResolvedValue({ ...baseForm, id: 225 })

    const payload = {
      ...baseForm,
      id: 225,
      name: 'Already published trip',
      description: 'A'.repeat(60),
      coordsMeTravel: [{ lat: 50, lng: 30, country: 1, address: 'Test', categories: [], image: '', id: 1 }],
      countries: ['1'],
      categories: [],
      publish: true,
      moderation: true,
    } as any

    await expect(saveFormData(payload, undefined, { autosave: true })).resolves.toBeDefined()
    expect(mockApiClientRequest).toHaveBeenCalled()
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

  it('fetchFilters returns fallback without JSON parsing on non-ok response', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: false, status: 502, statusText: 'Bad Gateway' })

    const result = await fetchFilters()

    expect(result).toEqual({
      countries: [],
      categories: [],
      categoryTravelAddress: [],
      companions: [],
      complexity: [],
      month: [],
      over_nights_stay: [],
      sortings: [],
      transports: [],
      year: '',
    })
    expect(mockSafeJsonParse).not.toHaveBeenCalled()
  })

  it('fetchAllCountries returns fallback without JSON parsing on non-ok response', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: false, status: 502, statusText: 'Bad Gateway' })

    const result = await fetchAllCountries()

    expect(result).toEqual([])
    expect(mockSafeJsonParse).not.toHaveBeenCalled()
  })

  it('fetchFiltersCountry returns fallback without JSON parsing on non-ok response', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: false, status: 502, statusText: 'Bad Gateway' })

    const result = await fetchFiltersCountry()

    expect(result).toEqual([])
    expect(mockSafeJsonParse).not.toHaveBeenCalled()
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
    expect(filters).toEqual({
      countries: [],
      categories: [],
      categoryTravelAddress: [],
      companions: [],
      complexity: [],
      month: [],
      over_nights_stay: [],
      sortings: [],
      transports: [],
      year: '',
    })
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

  it('sendFeedback sends the X-CSRFToken header on the POST (Django SessionAuth CSRF guard)', async () => {
    mockSanitizeInput.mockImplementation((v: string) => v.trim())
    mockFetchWithTimeout.mockResolvedValue({ ok: true })
    mockSafeJsonParse.mockResolvedValue({ message: 'ok' })

    await sendFeedback('A', 'b@c.com', 'Hi')

    const [, init] = mockFetchWithTimeout.mock.calls[0]
    expect(init.headers['X-CSRFToken']).toBe('test-csrf-token')
  })

  it('subscribeEmail and sendAIMessage also send the X-CSRFToken header', async () => {
    mockSanitizeInput.mockImplementation((v: string) => v.trim())
    mockValidateAIMessage.mockReturnValue({ valid: true })
    mockFetchWithTimeout.mockResolvedValue({ ok: true, status: 201 })
    mockSafeJsonParse.mockResolvedValue({ ok: true, status: 'created' })

    await subscribeEmail('a@b.com', 'home')
    expect(mockFetchWithTimeout.mock.calls[0][1].headers['X-CSRFToken']).toBe('test-csrf-token')

    mockFetchWithTimeout.mockClear()
    mockFetchWithTimeout.mockResolvedValue({ ok: true })
    mockSafeJsonParse.mockResolvedValue({ answer: 'hi' })

    await sendAIMessage('hello')
    expect(mockFetchWithTimeout.mock.calls[0][1].headers['X-CSRFToken']).toBe('test-csrf-token')
  })

  it('sendFeedback prefers field-specific validation errors when present', async () => {
    mockSanitizeInput.mockImplementation((v: string) => v.trim())
    mockFetchWithTimeout.mockResolvedValue({ ok: false })
    mockSafeJsonParse.mockResolvedValue({ email: ['bad email'], detail: 'fallback' })

    await expect(sendFeedback('A', 'b@c.com', 'Hi')).rejects.toThrow('bad email')
  })

  it('subscribeEmail requires an email and returns created on success', async () => {
    await expect(subscribeEmail('  ', 'home')).rejects.toThrow('Введите email')

    mockSanitizeInput.mockImplementation((v: string) => v.trim())
    mockFetchWithTimeout.mockResolvedValue({ ok: true, status: 201 })
    mockSafeJsonParse.mockResolvedValue({ ok: true, status: 'created' })

    await expect(subscribeEmail('a@b.com', 'home', 'https://metravel.by/')).resolves.toEqual({
      ok: true,
      status: 'created',
    })

    const [url, init] = mockFetchWithTimeout.mock.calls[0]
    expect(String(url)).toMatch(/\/subscribe\/$/)
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({
      email: 'a@b.com',
      source: 'home',
      page_url: 'https://metravel.by/',
    })
  })

  it('subscribeEmail maps a duplicate (200 exists) response', async () => {
    mockSanitizeInput.mockImplementation((v: string) => v.trim())
    mockFetchWithTimeout.mockResolvedValue({ ok: true, status: 200 })
    mockSafeJsonParse.mockResolvedValue({ ok: true, status: 'exists' })

    await expect(subscribeEmail('a@b.com', 'article')).resolves.toEqual({
      ok: true,
      status: 'exists',
    })
  })

  it('subscribeEmail surfaces field validation (400) and throttle (429)', async () => {
    mockSanitizeInput.mockImplementation((v: string) => v.trim())

    mockFetchWithTimeout.mockResolvedValue({ ok: false, status: 400 })
    mockSafeJsonParse.mockResolvedValue({ email: ['Enter a valid email address.'] })
    await expect(subscribeEmail('nope', 'home')).rejects.toThrow('Enter a valid email address.')

    mockFetchWithTimeout.mockResolvedValue({ ok: false, status: 429 })
    mockSafeJsonParse.mockResolvedValue({})
    await expect(subscribeEmail('a@b.com', 'home')).rejects.toThrow('Слишком много попыток. Попробуйте позже.')
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

  it('saveFormData strips base64 images from description before sending', async () => {
    mockGetSecureItem.mockResolvedValue('token')
    mockSanitizeInput.mockImplementation((v: string) => v)
    mockApiClientRequest.mockResolvedValue({ ...baseForm, id: 2 })

    const base64Img = '<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" />'
    const payload = {
      ...baseForm,
      name: 'Travel with images',
      description: `<p>Hello</p>${base64Img}<p>World</p>`,
    } as any

    await saveFormData(payload)

    const requestOptions = mockApiClientRequest.mock.calls[0][1]
    const body = JSON.parse(requestOptions.body)
    expect(body.description).not.toContain('data:image')
    expect(body.description).toContain('Hello')
    expect(body.description).toContain('World')
  })
})
