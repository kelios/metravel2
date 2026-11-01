import { TextDecoder as NodeTextDecoder, TextEncoder as NodeTextEncoder } from 'node:util'

import { ASK_HISTORY_TEXT_LIMIT, AskError, HttpAskClient, askErrorFromResponse, createAskClient, parseAskSseEvent } from '@/api/aiAssist/askProvider'
import type { AiHistoryItem } from '@/api/aiAssist/types'

const sse = (...events: Array<[string, Record<string, unknown>]>): string =>
  events.map(([name, data]) => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`).join('')

const sourcePayload = {
  type: 'travel',
  source_id: 816,
  title: 'Ярмарки Польши',
  url: 'https://metravel.by/travels/816',
  path: '/travels/816',
  snippet: 'Рождественские ярмарки Кракова',
  score: 0.8,
}

const streamBody = (parts: string[]) => {
  const encoder = new NodeTextEncoder()
  let index = 0
  const cancel = jest.fn(async () => undefined)
  return {
    cancel,
    stream: {
      getReader: () => ({
        read: async () =>
          index < parts.length ? { value: encoder.encode(parts[index++]), done: false } : { value: undefined, done: true },
        cancel,
      }),
    },
  }
}

const makeResponse = (init: { status?: number; body?: unknown; text?: string; headers?: Record<string, string> }) =>
  ({
    ok: (init.status ?? 200) >= 200 && (init.status ?? 200) < 300,
    status: init.status ?? 200,
    headers: { get: (name: string) => init.headers?.[name] ?? null },
    body: init.body ?? null,
    text: async () => init.text ?? '',
  }) as unknown as Response

const history: AiHistoryItem[] = [
  { role: 'user', text: 'Какие квесты есть в Гродно?' },
  { role: 'assistant', text: 'Смотрите квест по Гродно.' },
]

describe('aiAssist провайдер ask (#2884)', () => {
  const originalDecoder = (globalThis as { TextDecoder?: unknown }).TextDecoder
  beforeAll(() => {
    ;(globalThis as { TextDecoder?: unknown }).TextDecoder = NodeTextDecoder
  })
  afterAll(() => {
    ;(globalThis as { TextDecoder?: unknown }).TextDecoder = originalDecoder
  })

  it('разбирает именованные события SSE: sources в форме AiSource, text и done с числами сервера', () => {
    const sources = parseAskSseEvent(`event: sources\ndata: ${JSON.stringify({ sources: [sourcePayload, { type: 'other', url: 'x' }], degraded: true, remaining: '17' })}`)
    expect(sources).toEqual({
      name: 'sources',
      data: {
        sources: [{ ...sourcePayload, source_id: '816' }],
        degraded: true,
        remaining: 17,
      },
    })
    expect(parseAskSseEvent('event: text\ndata: {"text":"Привет"}')).toEqual({ name: 'text', data: { text: 'Привет' } })
    expect(parseAskSseEvent('event: done\ndata: {"status":"off_topic","reason":"offtopic_warning","strikes":2,"strikes_to_block":3}')).toEqual({
      name: 'done',
      data: { status: 'off_topic', reason: 'offtopic_warning', strikes: 2, strikesToBlock: 3, removedLinks: 0, usage: null, remaining: null },
    })
    expect(parseAskSseEvent('event: done\ndata: {"status":"done","removed_links":1,"remaining":18,"usage":{"prompt_tokens":100,"completion_tokens":20,"ttft_ms":50,"tokens_per_s":40}}')).toMatchObject({
      name: 'done',
      data: { status: 'done', removedLinks: 1, remaining: 18, usage: { prompt_tokens: 100, completion_tokens: 20, ttft_ms: 50, tokens_per_s: 40 } },
    })
    // Неизвестный статус не ломает экран — ход завершается ошибкой; чужие события и битый JSON пропускаются.
    expect(parseAskSseEvent('event: done\ndata: {"status":"weird"}')).toMatchObject({ name: 'done', data: { status: 'error' } })
    expect(parseAskSseEvent('event: ping\ndata: {}')).toBeNull()
    expect(parseAskSseEvent('event: text\ndata: {oops')).toBeNull()
    expect(parseAskSseEvent('data: {"text":"без имени"}')).toBeNull()
  })

  it('один POST /ai/ask с q, locale и history; поток отдаёт источники, накопленный текст и done', async () => {
    const { stream, cancel } = streamBody([
      sse(['sources', { sources: [sourcePayload], degraded: false, remaining: 19 }]),
      `event: text\ndata: {"text":"Загляните в "}\n\nevent: text\ndata: {"text":"Загляните в [Ярмарки](https://metravel.by/trav`,
      `els/816)"}\n\n`,
      sse(['done', { status: 'done', removed_links: 1, usage: { prompt_tokens: 100, completion_tokens: 20, ttft_ms: 50, tokens_per_s: 40 }, remaining: 19 }]),
    ])
    const fetchImpl = jest.fn(async () => makeResponse({ body: stream }))
    const client = createAskClient('http://127.0.0.1:8787/', { fetchImpl: fetchImpl as unknown as typeof fetch })
    const onSources = jest.fn()
    const onText = jest.fn()

    const result = await client.ask({ question: 'А какой из них подойдёт детям?', locale: 'ru', history, onSources, onText })

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('http://127.0.0.1:8787/ai/ask')
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual({ q: 'А какой из них подойдёт детям?', locale: 'ru', history })
    expect(onSources).toHaveBeenCalledWith({ sources: [{ ...sourcePayload, source_id: '816' }], degraded: false, remaining: 19 })
    expect(onText.mock.calls.map(([text]) => text)).toEqual(['Загляните в ', 'Загляните в [Ярмарки](https://metravel.by/travels/816)'])
    expect(result).toEqual({
      sources: [{ ...sourcePayload, source_id: '816' }],
      text: 'Загляните в [Ярмарки](https://metravel.by/travels/816)',
      done: { status: 'done', reason: null, strikes: null, strikesToBlock: null, removedLinks: 1, usage: { prompt_tokens: 100, completion_tokens: 20, ttft_ms: 50, tokens_per_s: 40 }, remaining: 19 },
    })
    expect(cancel).toHaveBeenCalled()
  })

  it('история длиннее серверного потолка обрезается до ASK_HISTORY_TEXT_LIMIT, а не получает 400', async () => {
    const fetchImpl = jest.fn(async () => makeResponse({ text: sse(['done', { status: 'no_sources' }]) }))
    const client = new HttpAskClient('', { fetchImpl: fetchImpl as unknown as typeof fetch })
    const longAnswer = 'а'.repeat(ASK_HISTORY_TEXT_LIMIT + 300)
    await client.ask({ question: 'А там музеи?', locale: 'ru', history: [history[0], { role: 'assistant', text: longAnswer }] })
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(JSON.parse(String(init.body)).history).toEqual([history[0], { role: 'assistant', text: longAnswer.slice(0, ASK_HISTORY_TEXT_LIMIT) }])
  })

  it('same-origin адрес: пустой base → относительный /ai/ask; без ReadableStream SSE читается из text()', async () => {
    const fetchImpl = jest.fn(async () =>
      makeResponse({ text: sse(['sources', { sources: [], degraded: false, remaining: 19 }], ['done', { status: 'no_sources' }]) }),
    )
    const client = new HttpAskClient('', { fetchImpl: fetchImpl as unknown as typeof fetch })
    const result = await client.ask({ question: 'Исландия зимой', locale: 'ru', history: [] })
    expect((fetchImpl.mock.calls[0] as unknown as [string])[0]).toBe('/ai/ask')
    expect(result.sources).toEqual([])
    expect(result.done.status).toBe('no_sources')
  })

  it('поток оборвался без done → unavailable, источники и текст сохраняются', async () => {
    const { stream } = streamBody([sse(['sources', { sources: [sourcePayload], degraded: false, remaining: 19 }], ['text', { text: 'Начало' }])])
    const client = createAskClient('', { fetchImpl: (async () => makeResponse({ body: stream })) as unknown as typeof fetch })
    const result = await client.ask({ question: 'q', locale: 'ru', history: [] })
    expect(result.done.status).toBe('unavailable')
    expect(result.text).toBe('Начало')
    expect(result.sources).toHaveLength(1)
  })

  it('коды отказа сервера → виды ошибок экрана с Retry-After и strikes', () => {
    expect(askErrorFromResponse(429, { error: 'limit', retry_after_sec: 3600 }, '7200')).toMatchObject({ kind: 'limit', status: 429, retryAfterSec: 3600 })
    expect(askErrorFromResponse(429, { error: 'offtopic_blocked', strikes: 3 }, '120')).toMatchObject({ kind: 'offtopic_blocked', retryAfterSec: 120, strikes: 3 })
    expect(askErrorFromResponse(429, { error: 'busy' }, null)).toMatchObject({ kind: 'busy', retryAfterSec: 30 })
    expect(askErrorFromResponse(503, { error: 'generator_unavailable' }, '30')).toMatchObject({ kind: 'unavailable', status: 503, retryAfterSec: 30 })
    expect(askErrorFromResponse(503, { error: 'busy' }, '15')).toMatchObject({ kind: 'busy', retryAfterSec: 15 })
    expect(askErrorFromResponse(502, null, null)).toMatchObject({ kind: 'unavailable', status: 502 })
  })

  it('отказ до потока бросает AskError по телу ответа; сеть и таймаут — unavailable, отмена — aborted', async () => {
    const limited = createAskClient('', {
      fetchImpl: (async () => makeResponse({ status: 429, text: JSON.stringify({ error: 'limit', retry_after_sec: 100 }), headers: { 'Retry-After': '100' } })) as unknown as typeof fetch,
    })
    await expect(limited.ask({ question: 'q', locale: 'ru', history: [] })).rejects.toMatchObject({ name: 'AskError', kind: 'limit', retryAfterSec: 100 })

    const down = createAskClient('', {
      fetchImpl: (async () => {
        throw new TypeError('Failed to fetch')
      }) as unknown as typeof fetch,
    })
    await expect(down.ask({ question: 'q', locale: 'ru', history: [] })).rejects.toMatchObject({ kind: 'unavailable' })

    const slow = createAskClient('', {
      timeoutMs: 5,
      fetchImpl: ((_: string, init: RequestInit) =>
        new Promise((_resolve, reject) => init.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))))) as unknown as typeof fetch,
    })
    await expect(slow.ask({ question: 'q', locale: 'ru', history: [] })).rejects.toMatchObject({ kind: 'unavailable' })

    const controller = new AbortController()
    const cancelled = createAskClient('', {
      fetchImpl: ((_: string, init: RequestInit) =>
        new Promise((_resolve, reject) => init.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))))) as unknown as typeof fetch,
    })
    const pending = cancelled.ask({ question: 'q', locale: 'ru', history: [], signal: controller.signal })
    controller.abort()
    await expect(pending).rejects.toMatchObject({ kind: 'aborted' })
    expect(new AskError('busy', 'x', { retryAfterSec: 5 })).toMatchObject({ name: 'AskError', kind: 'busy', retryAfterSec: 5, strikes: null })
  })
})
