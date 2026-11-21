/** @jest-environment node */
/**
 * Сеть сборки внешнего индекса маршрутов (#3431, А5): пауза по заголовку `Retry-After` — с потолком.
 * Среда node: запрос идёт через `AbortSignal.timeout`, которого в jsdom нет.
 */
import { fetchCached, MAX_RETRY_AFTER_MS, NetworkError, retryAfterMs } from '@/scripts/ai-index/world/net'

describe('внешний индекс маршрутов: Retry-After', () => {
  const original = global.fetch
  afterEach(() => {
    global.fetch = original
  })

  it('читает секунды и дату HTTP; пустой и кривой заголовок — нет паузы', () => {
    expect(retryAfterMs('65')).toBe(65_000)
    expect(retryAfterMs('0')).toBe(0)
    const now = Date.parse('2026-11-15T00:00:00Z')
    expect(retryAfterMs('Sun, 15 Nov 2026 00:02:00 GMT', now)).toBe(120_000)
    // Дата в прошлом — ждать нечего.
    expect(retryAfterMs('Sun, 15 Nov 2026 00:00:00 GMT', now + 5000)).toBe(0)
    for (const header of [null, undefined, '', 'soon', '-5', '1e9']) expect(retryAfterMs(header, now)).toBeNull()
  })

  it('сервис просит ждать дольше потолка — запрос закрывается сразу, без часового ожидания и без повторов', async () => {
    const calls: string[] = []
    global.fetch = (async (url: string) => {
      calls.push(String(url))
      return new Response('slow down', { status: 429, headers: { 'retry-after': String(MAX_RETRY_AFTER_MS / 1000 + 1) } })
    }) as typeof fetch
    const started = Date.now()
    await expect(fetchCached('https://example.org/data', { retries: 3 })).rejects.toThrow(NetworkError)
    await expect(fetchCached('https://example.org/data', { retries: 3 })).rejects.toThrow(/просит подождать 601 с — больше потолка 600 с/)
    expect(calls).toHaveLength(2)
    expect(Date.now() - started).toBeLessThan(2000)
  })

  it('пауза в пределах потолка соблюдается: повтор идёт после неё и приносит ответ', async () => {
    let attempt = 0
    global.fetch = (async () => {
      attempt += 1
      return attempt === 1 ? new Response('busy', { status: 503, headers: { 'retry-after': '0.05' } }) : new Response('ok', { status: 200 })
    }) as typeof fetch
    const body = await fetchCached('https://example.org/data', { retries: 2, retryPauseMs: 60_000 })
    expect(body?.toString('utf8')).toBe('ok')
    expect(attempt).toBe(2)
  })
})
