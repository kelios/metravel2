/**
 * Чем клиент подтверждает личность вопроса для `/ai/ask` (#3354): web — cookie сессии того же origin,
 * приложения — заголовок с токеном и только на origin API сайта. Идентификатор пользователя не уходит никогда.
 */
import { isSiteAssistOrigin, resolveAskAuth } from '@/api/aiAssist/askAuth'
import { HttpAskClient, parseAskSseEvent } from '@/api/aiAssist/askProvider'

const mockUsesToken = jest.fn(() => true)
const mockGetSecureItem = jest.fn(async (_key: string): Promise<string | null> => null)

jest.mock('@/api/apiConfig', () => ({ API_BASE_URL: 'https://site.example.test/api' }))
jest.mock('@/utils/authPlatform', () => ({
  ACCESS_TOKEN_STORAGE_KEY: 'userToken',
  shouldUseStoredAuthToken: () => mockUsesToken(),
}))
jest.mock('@/utils/secureStorage', () => ({ getSecureItem: (key: string) => mockGetSecureItem(key) }))

const SITE = 'https://site.example.test'
const TOKEN = 'test-token-visitor-a-0001'

const sse = (...events: Array<[string, Record<string, unknown>]>): string => events.map(([name, data]) => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`).join('')
const okStream = () =>
  ({ ok: true, status: 200, headers: { get: () => null }, body: null, text: async () => sse(['sources', { sources: [], degraded: false, remaining: 19 }], ['done', { status: 'no_sources', profile: true }]) }) as unknown as Response

describe('подтверждение личности для /ai/ask (#3354)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUsesToken.mockReturnValue(true)
    mockGetSecureItem.mockResolvedValue(null)
  })

  it('web: токен в HttpOnly-cookie — запрос того же origin несёт её сам, заголовка нет', async () => {
    mockUsesToken.mockReturnValue(false)
    expect(await resolveAskAuth('')).toEqual({ credentials: 'same-origin' })
    // Служба по отдельному адресу cookie сайта не получает.
    expect(await resolveAskAuth('https://assist.example.test')).toBeNull()
    expect(mockGetSecureItem).not.toHaveBeenCalled()
  })

  it('приложение: заголовок с токеном — только службе на origin API сайта', async () => {
    mockGetSecureItem.mockResolvedValue(TOKEN)
    expect(await resolveAskAuth(SITE)).toEqual({ headers: { Authorization: `Token ${TOKEN}` } })
    expect(mockGetSecureItem).toHaveBeenCalledWith('userToken')
    expect(await resolveAskAuth('http://192.168.50.36:8787')).toBeNull()
    expect(await resolveAskAuth('https://site.example.test.evil.example')).toBeNull()
    expect(await resolveAskAuth('')).toBeNull()
  })

  it('приложение без сессии — вопрос гостя', async () => {
    expect(await resolveAskAuth(SITE)).toBeNull()
  })

  it('origin службы сравнивается с origin API без учёта пути и регистра', () => {
    expect(isSiteAssistOrigin('https://SITE.example.test', 'https://site.example.test/api')).toBe(true)
    expect(isSiteAssistOrigin('http://site.example.test', 'https://site.example.test/api')).toBe(false)
    expect(isSiteAssistOrigin('https://site.example.test:8443', 'https://site.example.test/api')).toBe(false)
    expect(isSiteAssistOrigin('', 'https://site.example.test/api')).toBe(false)
  })
})

describe('клиент службы: личность уходит только с вопросом (#3354)', () => {
  it('заголовок и режим cookie добавляются к POST /ai/ask; тело личности не несёт', async () => {
    const fetchImpl = jest.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => okStream())
    const client = new HttpAskClient(SITE, { fetchImpl: fetchImpl as unknown as typeof fetch, auth: async () => ({ headers: { Authorization: `Token ${TOKEN}` }, credentials: 'same-origin' }) })
    const result = await client.ask({ question: 'Куда поехать?', locale: 'ru', history: [] })
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe(`${SITE}/ai/ask`)
    expect(init?.headers).toEqual({ 'Content-Type': 'application/json', Accept: 'text/event-stream', Authorization: `Token ${TOKEN}` })
    expect(init?.credentials).toBe('same-origin')
    expect(JSON.parse(String(init?.body))).toEqual({ q: 'Куда поехать?', locale: 'ru', history: [] })
    expect(String(init?.body)).not.toContain(TOKEN)
    expect(result.done.profile).toBe(true)
  })

  it('без подтверждения запрос прежний; сбой чтения токена — вопрос гостя, а не ошибка', async () => {
    for (const auth of [undefined, async () => null, async () => Promise.reject(new Error('хранилище недоступно'))] as const) {
      const fetchImpl = jest.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => okStream())
      const client = new HttpAskClient(SITE, { fetchImpl: fetchImpl as unknown as typeof fetch, ...(auth ? { auth } : {}) })
      await client.ask({ question: 'Куда поехать?', locale: 'ru', history: [] })
      const init = fetchImpl.mock.calls[0][1]
      expect(init?.headers).toEqual({ 'Content-Type': 'application/json', Accept: 'text/event-stream' })
      expect(init).not.toHaveProperty('credentials')
    }
  })

  it('оценка ответа подтверждения личности не получает', async () => {
    const fetchImpl = jest.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => ({ ok: true }) as Response)
    const auth = jest.fn(async () => ({ headers: { Authorization: `Token ${TOKEN}` } }))
    const client = new HttpAskClient(SITE, { fetchImpl: fetchImpl as unknown as typeof fetch, auth })
    await client.feedback({ turnId: 't1', vote: 'up' })
    expect(auth).not.toHaveBeenCalled()
    expect(fetchImpl.mock.calls[0][1]?.headers).toEqual({ 'Content-Type': 'application/json' })
  })

  it('признак личного контекста читается из done только как true', () => {
    const done = (payload: Record<string, unknown>) => parseAskSseEvent(`event: done\ndata: ${JSON.stringify({ status: 'done', ...payload })}`)
    expect(done({ profile: true })).toMatchObject({ name: 'done', data: { profile: true } })
    for (const value of [false, 'true', 1, null, { id: 5 }]) expect((done({ profile: value }) as { data: Record<string, unknown> }).data).not.toHaveProperty('profile')
    expect((done({}) as { data: Record<string, unknown> }).data).not.toHaveProperty('profile')
  })
})

describe('клиент службы: отмена во время чтения токена (#3354)', () => {
  it('вопрос отменён, пока читался токен, — запрос не уходит', async () => {
    const fetchImpl = jest.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => okStream())
    const controller = new AbortController()
    const client = new HttpAskClient(SITE, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      auth: async () => {
        controller.abort()
        return { headers: { Authorization: `Token ${TOKEN}` } }
      },
    })
    await expect(client.ask({ question: 'Куда поехать?', locale: 'ru', history: [], signal: controller.signal })).rejects.toMatchObject({ name: 'AskError', kind: 'aborted' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
