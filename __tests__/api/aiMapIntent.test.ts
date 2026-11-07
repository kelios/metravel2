/**
 * #2887: клиент `POST /ai/intent` — тело запроса, нормализация ответа, виды отказов.
 */
import { AI_MAP_INTENT_TIMEOUT_MS, AiMapIntentError, fetchMapIntent, normalizeMapIntentQuery } from '@/api/aiMapIntent'
import { fetchWithTimeout } from '@/utils/fetchWithTimeout'

jest.mock('@/utils/fetchWithTimeout', () => ({ fetchWithTimeout: jest.fn() }))

const mockedFetch = fetchWithTimeout as jest.MockedFunction<typeof fetchWithTimeout>
const jsonResponse = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body }) as unknown as Response

beforeEach(() => mockedFetch.mockReset())

describe('fetchMapIntent', () => {
  it('POST {q, locale} с таймаутом 8 с; ответ нормализован до категорий карты', async () => {
    mockedFetch.mockResolvedValue(jsonResponse(200, { categories: ['viewpoints', 'castles'], radius_km: 50, center: { name: 'Несвиж' }, constraints: { camper: true } }))
    const signal = new AbortController().signal
    const intent = await fetchMapIntent('  смотровые   у Несвижа ', 'ru', signal)
    expect(mockedFetch).toHaveBeenCalledTimes(1)
    const [url, init, timeout] = mockedFetch.mock.calls[0]
    expect(String(url)).toMatch(/\/ai\/intent$/)
    expect(init).toMatchObject({ method: 'POST', signal })
    expect(JSON.parse(String(init?.body))).toEqual({ q: 'смотровые у Несвижа', locale: 'ru' })
    expect(timeout).toBe(AI_MAP_INTENT_TIMEOUT_MS)
    expect(intent).toEqual({ categories: ['viewpoints'], radius_km: 50, center: { name: 'Несвиж' }, constraints: { camper: true } })
  })

  it('короткий запрос — bad_request без запроса', async () => {
    await expect(fetchMapIntent('ab', 'ru')).rejects.toMatchObject({ kind: 'bad_request' })
    expect(mockedFetch).not.toHaveBeenCalled()
  })

  it.each([
    [422, { error: 'invalid_intent' }, 'invalid'],
    [503, { error: 'generator_unavailable' }, 'unavailable'],
    [429, { error: 'limit' }, 'limit'],
    [429, { error: 'busy' }, 'unavailable'],
    [400, { error: 'bad_request' }, 'bad_request'],
  ])('%s %j → AiMapIntentError %s', async (status, body, kind) => {
    mockedFetch.mockResolvedValue(jsonResponse(status, body))
    const error = await fetchMapIntent('замки под Гродно', 'ru').catch((e) => e)
    expect(error).toBeInstanceOf(AiMapIntentError)
    expect(error).toMatchObject({ kind, status })
  })

  it('сеть/таймаут → unavailable, внешняя отмена пробрасывается как есть', async () => {
    const timeout = new Error('timeout')
    timeout.name = 'TimeoutError'
    mockedFetch.mockRejectedValueOnce(timeout)
    await expect(fetchMapIntent('замки под Гродно', 'ru')).rejects.toMatchObject({ kind: 'unavailable' })
    const abort = new Error('aborted')
    abort.name = 'AbortError'
    mockedFetch.mockRejectedValueOnce(abort)
    await expect(fetchMapIntent('замки под Гродно', 'ru')).rejects.toBe(abort)
  })

  it('200 без категорий карты → invalid', async () => {
    mockedFetch.mockResolvedValue(jsonResponse(200, { categories: ['castles'], radius_km: 50, center: null }))
    await expect(fetchMapIntent('замки под Гродно', 'ru')).rejects.toMatchObject({ kind: 'invalid', status: 200 })
  })

  it('normalizeMapIntentQuery режет хвост по максимуму службы', () => {
    expect(normalizeMapIntentQuery(`${'x'.repeat(400)}`)).toHaveLength(300)
  })
})
