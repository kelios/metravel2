/**
 * #1516: узкий `PATCH /travels/{id}/content/` не имеет права быть слабее полного
 * `PUT /travels/upsert/`. У бэкенда собственной очистки rich-text нет, поэтому
 * санитизация — единственная защита, и она обязана работать на обоих путях.
 */
import { saveTravelContent } from '@/api/misc'

let mockIsWebPlatform = false
const mockGetSecureItem = jest.fn()
const mockApiClientRequest = jest.fn()

jest.mock('@/utils/secureStorage', () => ({
  getSecureItem: (...args: any[]) => mockGetSecureItem(...args),
}))

jest.mock('@/utils/authPlatform', () => ({
  usesWebCookieAuth: () => mockIsWebPlatform,
  shouldUseStoredAuthToken: () => !mockIsWebPlatform,
  hasUsableAuthCredential: (token: string | null) => mockIsWebPlatform || Boolean(token),
  getApiRequestCredentials: (skipAuth = false) =>
    mockIsWebPlatform ? { credentials: skipAuth ? 'omit' : 'include' } : {},
  ACCESS_TOKEN_STORAGE_KEY: 'access_token',
}))

jest.mock('@/api/client', () => ({
  apiClient: {
    request: (...args: any[]) => mockApiClientRequest(...args),
  },
  ApiError: class ApiError extends Error {},
}))

const readRequest = () => {
  const [endpoint, options] = mockApiClientRequest.mock.calls[0]
  return { endpoint, method: options.method, body: JSON.parse(options.body) }
}

describe('saveTravelContent', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockIsWebPlatform = false
    mockGetSecureItem.mockResolvedValue('token')
    mockApiClientRequest.mockResolvedValue({
      id: 619,
      slug: 'minsk',
      name: 'Минск',
      description: '<p>ok</p>',
      plus: '',
      minus: '',
      recommendation: '',
      changed_fields: ['description'],
      updated_at: '2026-08-25T10:00:00Z',
    })
  })

  it('шлёт PATCH на адресный эндпоинт статьи только с переданными полями', async () => {
    await saveTravelContent(619, { description: '<p>Новый абзац</p>' })

    const { endpoint, method, body } = readRequest()
    expect(endpoint).toBe('/travels/619/content/')
    expect(method).toBe('PATCH')
    expect(body).toEqual({ description: '<p>Новый абзац</p>' })
  })

  it('требует авторизацию так же, как полное сохранение', async () => {
    mockGetSecureItem.mockResolvedValue(null)

    await expect(saveTravelContent(619, { description: '<p>x</p>' })).rejects.toThrow()
    expect(mockApiClientRequest).not.toHaveBeenCalled()
  })

  it('вырезает встроенные base64-картинки из описания', async () => {
    await saveTravelContent(619, {
      description:
        '<p>До</p><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==" /><p>После</p>',
    })

    const { body } = readRequest()
    expect(body.description).not.toContain('base64')
    expect(body.description).toContain('До')
    expect(body.description).toContain('После')
  })

  it('очищает опасную разметку в описании', async () => {
    await saveTravelContent(619, {
      description: '<p onclick="steal()">Текст</p><script>alert(1)</script><a href="javascript:alert(1)">клик</a>',
    })

    const { body } = readRequest()
    expect(body.description).not.toContain('<script')
    expect(body.description).not.toContain('onclick')
    expect(body.description).not.toContain('javascript:')
    expect(body.description).toContain('Текст')
  })

  it('очищает опасную разметку в plus/minus/recommendation и в названии', async () => {
    await saveTravelContent(619, {
      name: 'Минск<script>alert(1)</script>',
      plus: '<script>alert(1)</script>Плюсы',
      minus: '<iframe src="http://evil"></iframe>Минусы',
      recommendation: '<p onerror="x=1">Советы</p>',
    })

    const { body } = readRequest()
    expect(body.name).toBe('Минск')
    expect(body.plus).toBe('Плюсы')
    expect(body.minus).toBe('Минусы')
    expect(body.recommendation).not.toContain('onerror')
  })

  it('обрезает поля по тем же лимитам, что и полное сохранение', async () => {
    await saveTravelContent(619, { plus: 'а'.repeat(6000) })

    const { body } = readRequest()
    expect(body.plus).toHaveLength(5000)
  })

  it('отклоняет слишком длинное название до отправки', async () => {
    await expect(saveTravelContent(619, { name: 'я'.repeat(201) })).rejects.toThrow()
    expect(mockApiClientRequest).not.toHaveBeenCalled()
  })

  it('не отправляет запрос без единого поля', async () => {
    await expect(saveTravelContent(619, {})).rejects.toThrow()
    expect(mockApiClientRequest).not.toHaveBeenCalled()
  })
})
