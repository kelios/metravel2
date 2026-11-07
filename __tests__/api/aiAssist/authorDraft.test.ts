/**
 * #2885: клиент `POST /ai/author-draft` — тело запроса, обрезка текста, коды сервера → `AuthorDraftError.kind`.
 */
import { AuthorDraftError, requestAuthorDraft, trimAuthorDraftText } from '@/api/aiAssist/authorDraft'
import { AI_AUTHOR_DRAFT_MAX_TEXT_CHARS } from '@/api/aiAssist/policy'

const jsonResponse = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
    json: async () => body,
  }) as unknown as Response

describe('requestAuthorDraft (#2885)', () => {
  it('шлёт text/kind/locale на {base}/ai/author-draft и возвращает варианты с остатком', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse(200, { variants: ['Гродно за два дня', ''], remaining: 4 }))
    const result = await requestAuthorDraft({ baseUrl: 'https://assist.test/', text: '  Текст   статьи ', kind: 'title', locale: 'be', fetchImpl })
    expect(result).toEqual({ variants: ['Гродно за два дня'], remaining: 4 })
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://assist.test/ai/author-draft')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({ text: 'Текст статьи', kind: 'title', locale: 'be' })
  })

  it('429 limit → kind limit с retry_after_sec; 503 и 429 busy → unavailable; 400 → bad_request; сеть → unavailable', async () => {
    const limit = requestAuthorDraft({ baseUrl: '', text: 'x', kind: 'meta', locale: 'ru', fetchImpl: jest.fn().mockResolvedValue(jsonResponse(429, { error: 'limit', retry_after_sec: 120 })) })
    await expect(limit).rejects.toMatchObject({ name: 'AuthorDraftError', kind: 'limit', retryAfterSec: 120 })

    const busy = requestAuthorDraft({ baseUrl: '', text: 'x', kind: 'meta', locale: 'ru', fetchImpl: jest.fn().mockResolvedValue(jsonResponse(429, { error: 'busy' }, { 'retry-after': '30' })) })
    await expect(busy).rejects.toMatchObject({ kind: 'unavailable', retryAfterSec: 30 })

    const down = requestAuthorDraft({ baseUrl: '', text: 'x', kind: 'lead', locale: 'ru', fetchImpl: jest.fn().mockResolvedValue(jsonResponse(503, { error: 'generator_unavailable', detail: 'AI_LLM_URL не задан' })) })
    await expect(down).rejects.toMatchObject({ kind: 'unavailable', status: 503, message: 'AI_LLM_URL не задан' })

    const bad = requestAuthorDraft({ baseUrl: '', text: 'x', kind: 'lead', locale: 'ru', fetchImpl: jest.fn().mockResolvedValue(jsonResponse(400, { error: 'bad_request' })) })
    await expect(bad).rejects.toMatchObject({ kind: 'bad_request' })

    const network = requestAuthorDraft({ baseUrl: '', text: 'x', kind: 'title', locale: 'ru', fetchImpl: jest.fn().mockRejectedValue(new TypeError('Failed to fetch')) })
    await expect(network).rejects.toBeInstanceOf(AuthorDraftError)
    await expect(network).rejects.toMatchObject({ kind: 'unavailable' })

    const empty = requestAuthorDraft({ baseUrl: '', text: 'x', kind: 'title', locale: 'ru', fetchImpl: jest.fn().mockResolvedValue(jsonResponse(200, { variants: [] })) })
    await expect(empty).rejects.toMatchObject({ kind: 'unavailable' })
  })

  it('таймаут обрывает запрос как unavailable; отмена снаружи пробрасывается как есть', async () => {
    const hanging = (_: unknown, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))))
    await expect(requestAuthorDraft({ baseUrl: '', text: 'x', kind: 'title', locale: 'ru', fetchImpl: hanging as typeof fetch, timeoutMs: 5 })).rejects.toMatchObject({
      kind: 'unavailable',
      message: expect.stringMatching(/timed out/),
    })
    const controller = new AbortController()
    const pending = requestAuthorDraft({ baseUrl: '', text: 'x', kind: 'title', locale: 'ru', fetchImpl: hanging as typeof fetch, signal: controller.signal })
    controller.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('trimAuthorDraftText: схлопывает пробелы и режет хвост по слову', () => {
    expect(trimAuthorDraftText(' a \n b ')).toBe('a b')
    const long = trimAuthorDraftText('слово '.repeat(AI_AUTHOR_DRAFT_MAX_TEXT_CHARS))
    expect(long.length).toBeLessThanOrEqual(AI_AUTHOR_DRAFT_MAX_TEXT_CHARS)
    expect(long.endsWith('слово')).toBe(true)
  })
})
