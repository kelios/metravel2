import { TextDecoder as NodeTextDecoder, TextEncoder as NodeTextEncoder } from 'node:util'

import {
  AiGeneratorError,
  LLAMACPP_MAX_TOKENS,
  LLAMACPP_TEMPERATURE,
  LlamaCppGenerator,
  createGenerator,
  parseSseEvent,
  splitSseEvents,
} from '@/api/aiAssist/generator'
import type { AiChatMessage } from '@/api/aiAssist/types'

const messages: AiChatMessage[] = [
  { role: 'system', content: 'sys' },
  { role: 'user', content: 'Куда поехать?' },
]

const sse = (...payloads: Array<Record<string, unknown> | '[DONE]'>): string =>
  payloads.map((p) => `data: ${p === '[DONE]' ? p : JSON.stringify(p)}\n\n`).join('')

const chunk = (content: string) => ({ choices: [{ delta: { content }, finish_reason: null }] })
const finalChunk = { choices: [{ delta: {}, finish_reason: 'stop' }] }
const usageChunk = { choices: [], usage: { prompt_tokens: 120, completion_tokens: 12 } }

const streamBody = (parts: string[]) => {
  const encoder = new NodeTextEncoder()
  let index = 0
  return {
    getReader: () => ({
      read: async () =>
        index < parts.length
          ? { value: encoder.encode(parts[index++]), done: false }
          : { value: undefined, done: true },
      cancel: async () => undefined,
    }),
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

describe('aiAssist generator (#2460)', () => {
  const originalDecoder = (globalThis as { TextDecoder?: unknown }).TextDecoder
  beforeAll(() => {
    ;(globalThis as { TextDecoder?: unknown }).TextDecoder = NodeTextDecoder
  })
  afterAll(() => {
    ;(globalThis as { TextDecoder?: unknown }).TextDecoder = originalDecoder
  })

  it('разбирает SSE: события, дельты, [DONE] и usage', () => {
    const { events, rest } = splitSseEvents(`${sse(chunk('При'), chunk('вет'))}data: {"partial`)
    expect(events).toHaveLength(2)
    expect(rest).toBe('data: {"partial')
    expect(parseSseEvent(events[0])).toEqual({ delta: 'При', done: false, usage: null })
    expect(parseSseEvent('data: [DONE]')).toEqual({ delta: '', done: true, usage: null })
    expect(parseSseEvent(`data: ${JSON.stringify(usageChunk)}`)).toEqual({ delta: '', done: false, usage: usageChunk.usage })
    expect(parseSseEvent(': ping')).toBeNull()
  })

  it('шлёт OpenAI-совместимый запрос в llama-server с параметрами карточки и стримит дельты', async () => {
    const fetchImpl = jest.fn(async () =>
      makeResponse({ body: streamBody([sse(chunk('Поезжайте '), chunk('в Гродно')), sse(finalChunk, usageChunk, '[DONE]')]) }),
    )
    let now = 1000
    const generator = new LlamaCppGenerator('http://127.0.0.1:8080/', { fetchImpl: fetchImpl as unknown as typeof fetch, now: () => (now += 100) })
    const deltas: string[] = []
    const result = await generator.generate({ messages, onDelta: (delta) => deltas.push(delta) })

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('http://127.0.0.1:8080/v1/chat/completions')
    const body = JSON.parse(String(init.body))
    expect(body).toMatchObject({
      stream: true,
      max_tokens: LLAMACPP_MAX_TOKENS,
      temperature: LLAMACPP_TEMPERATURE,
      chat_template_kwargs: { enable_thinking: false },
      messages,
    })
    expect(deltas).toEqual(['Поезжайте ', 'в Гродно'])
    expect(result.text).toBe('Поезжайте в Гродно')
    expect(result.usage.prompt_tokens).toBe(120)
    expect(result.usage.completion_tokens).toBe(12)
    expect(result.usage.ttft_ms).toBeGreaterThan(0)
  })

  it('без стримящего тела (native fetch) читает SSE целиком из text()', async () => {
    const fetchImpl = jest.fn(async () => makeResponse({ text: sse(chunk('Да, '), chunk('есть квест'), finalChunk, '[DONE]') }))
    const generator = new LlamaCppGenerator('http://127.0.0.1:8080', { fetchImpl: fetchImpl as unknown as typeof fetch })
    const result = await generator.generate({ messages })
    expect(result.text).toBe('Да, есть квест')
  })

  it('недоступный сервер → ошибка kind=unavailable, сетевой сбой — тоже', async () => {
    const down = new LlamaCppGenerator('http://127.0.0.1:8080', {
      fetchImpl: (async () => makeResponse({ status: 503, text: 'down' })) as unknown as typeof fetch,
    })
    await expect(down.generate({ messages })).rejects.toMatchObject({ name: 'AiGeneratorError', kind: 'unavailable', status: 503 })

    const offline = new LlamaCppGenerator('http://127.0.0.1:8080', {
      fetchImpl: (async () => {
        throw new TypeError('Failed to fetch')
      }) as unknown as typeof fetch,
    })
    await expect(offline.generate({ messages })).rejects.toMatchObject({ kind: 'unavailable' })
  })

  it('429 → kind=busy с Retry-After', async () => {
    const busy = new LlamaCppGenerator('http://127.0.0.1:8080', {
      fetchImpl: (async () => makeResponse({ status: 429, headers: { 'Retry-After': '15' } })) as unknown as typeof fetch,
    })
    await expect(busy.generate({ messages })).rejects.toMatchObject({ kind: 'busy', retryAfterSec: 15 })
  })

  it('отмена сигналом → kind=aborted', async () => {
    const controller = new AbortController()
    const fetchImpl = (async (_url: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))
      })) as unknown as typeof fetch
    const generator = new LlamaCppGenerator('http://127.0.0.1:8080', { fetchImpl })
    const pending = generator.generate({ messages, signal: controller.signal })
    controller.abort()
    await expect(pending).rejects.toMatchObject({ kind: 'aborted' })
  })

  it('таймаут генерации — не отмена посетителем, а недоступность', async () => {
    const generator = new LlamaCppGenerator('http://127.0.0.1:8080', {
      timeoutMs: 5,
      fetchImpl: ((_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))
        })) as unknown as typeof fetch,
    })
    await expect(generator.generate({ messages })).rejects.toMatchObject({ kind: 'unavailable' })
  })

  it('ошибка внутри потока → bad_response; без адреса провайдера нет', async () => {
    const generator = new LlamaCppGenerator('http://127.0.0.1:8080', {
      fetchImpl: (async () => makeResponse({ text: 'data: {"error":{"message":"context too long"}}\n\n' })) as unknown as typeof fetch,
    })
    await expect(generator.generate({ messages })).rejects.toBeInstanceOf(AiGeneratorError)
    expect(createGenerator('')).toBeNull()
    expect(createGenerator('http://127.0.0.1:8080')).toBeInstanceOf(LlamaCppGenerator)
  })
})
