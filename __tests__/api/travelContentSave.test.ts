/**
 * #1516: узкий `PATCH /travels/{id}/content/` не имеет права быть слабее полного
 * `PUT /travels/upsert/`: frontend безопасно нормализует HTML до записи,
 * а backend отдельно вычисляет canonical safe_html для чтения.
 */
import { saveFormData, saveTravelContent } from '@/api/misc'
import { getEmptyFormData } from '@/utils/travelFormUtils'

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
    expect(body.minus).toContain('Минусы')
    expect(body.minus).not.toContain('iframe')
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

  it.each(['PUT', 'PATCH'])('%s normalizes every rich-text field with the same safe body pipeline', async (method) => {
    const source = '<p class="ql-align-center"><span class="ql-font-serif ql-size-large">Текст</span></p>' +
      '<ol><li data-list="bullet" class="ql-indent-2"><span class="ql-ui" contenteditable="false"></span>Пункт</li></ol>' +
      '<section class="seo-faq"><details><summary>Вопрос?</summary><p>Ответ</p></details></section>' +
      '<img src="data:image/png;base64,AAAA"><script>steal()</script><p onclick="steal()">Конец</p>'
    const fields = { description: source, plus: source, minus: source, recommendation: source }
    if (method === 'PATCH') await saveTravelContent(619, fields)
    else await saveFormData({ ...getEmptyFormData('619'), name: 'Тестовая статья', ...fields })

    const { body, method: actualMethod } = readRequest()
    expect(actualMethod).toBe(method)
    for (const field of Object.keys(fields)) {
      expect(body[field]).toBe(body.description)
      expect(body[field]).toContain('class="ql-align-center"')
      expect(body[field]).toContain('class="ql-font-serif ql-size-large"')
      expect(body[field]).toContain('<ul><li class="ql-indent-2">Пункт</li></ul>')
      expect(body[field]).toContain('<details><summary>Вопрос?</summary>')
      expect(body[field]).toContain('seo-faq')
      expect(body[field]).not.toMatch(/data-list|ql-ui|base64|<script|onclick/)
    }
  })
})
