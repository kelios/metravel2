import { TextDecoder as NodeTextDecoder, TextEncoder as NodeTextEncoder } from 'node:util'

import {
  AiGeneratorError,
  LLAMACPP_MAX_TOKENS,
  LLAMACPP_PRESENCE_PENALTY,
  LLAMACPP_TEMPERATURE,
  LlamaCppGenerator,
  createGenerator,
  findRepetitionLoopCut,
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
      presence_penalty: LLAMACPP_PRESENCE_PENALTY,
      chat_template_kwargs: { enable_thinking: false },
      messages,
    })
    expect(deltas).toEqual(['Поезжайте ', 'в Гродно'])
    expect(result.text).toBe('Поезжайте в Гродно')
    expect(result.usage.prompt_tokens).toBe(120)
    expect(result.usage.completion_tokens).toBe(12)
    expect(result.usage.ttft_ms).toBeGreaterThan(0)
  })

  it('зацикленный хвост обрезается: пункт по кругу (#2709), обычные перечисления не трогаются', () => {
    const looped = 'Точки маршрута: Pałac w Krakowie; Rynek Główny; Ratusz; Ratusz; Ratusz; Ratus'
    expect(looped.slice(0, findRepetitionLoopCut(looped) ?? looped.length)).toBe('Точки маршрута: Pałac w Krakowie; Rynek Główny; Ratusz')
    const lines = 'Вот что есть:\nРынок Вавеля\nРынок Вавеля\nРынок Вавеля\nРынок'
    expect(lines.slice(0, findRepetitionLoopCut(lines) ?? lines.length)).toBe('Вот что есть:\nРынок Вавеля')
    expect(findRepetitionLoopCut('Краков, Вроцлав, Катовице, Гданьск и Познань')).toBeNull()
    expect(findRepetitionLoopCut('• Маршрут по центру:\n• Веломаршрут:\n• Ойцовский парк:')).toBeNull()
    expect(findRepetitionLoopCut('Kościół Wawelski; Kościół Wawelski; Katedra')).toBeNull()
    // Круг из нескольких пунктов: обрезка с первой повторённой строки (живой ответ модели 25.10).
    const cycle = [
      'Вот что стоит посмотреть:',
      '- Краков: путеводитель по местам — лучший старт.',
      '- Квест по Кракову: Вавельский дракон — приключение.',
      '- Краков: путеводитель по местам — лучший старт.',
      '- Квест по Кракову: Вавельский дракон — приключение.',
      '- Краков: путев',
    ].join('\n')
    expect(cycle.slice(0, findRepetitionLoopCut(cycle) ?? cycle.length)).toBe(
      'Вот что стоит посмотреть:\n- Краков: путеводитель по местам — лучший старт.\n- Квест по Кракову: Вавельский дракон — приключение.',
    )
    // Короткие одинаковые строки («Подробнее:») и пустые — не цикл.
    expect(findRepetitionLoopCut('Подробнее:\nА\n\nПодробнее:\nБ\n')).toBeNull()
    // Подзаголовок у каждого дня плана — не цикл: за ним другое содержание.
    expect(
      findRepetitionLoopCut('День 1\n**Что посмотреть:**\n\n- Вавель\nДень 2\n**Что посмотреть:**\n\n- Казимеж\n'),
    ).toBeNull()
  })

  it('на цикле стрим закрывается, а в ответ и последнюю дельту идёт текст без хвоста', async () => {
    const cancel = jest.fn(async () => undefined)
    const body = streamBody([sse(chunk('Точки: Ratusz'), chunk('; Ratusz'), chunk('; Ratusz'), chunk('; Ratusz; Ratusz'))])
    const reader = body.getReader()
    const fetchImpl = jest.fn(async () => makeResponse({ body: { getReader: () => ({ ...reader, cancel }) } }))
    const generator = new LlamaCppGenerator('http://127.0.0.1:8080', { fetchImpl: fetchImpl as unknown as typeof fetch })
    const fulls: string[] = []
    const result = await generator.generate({ messages, onDelta: (_delta, full) => fulls.push(full) })
    expect(result.text).toBe('Точки: Ratusz')
    expect(fulls[fulls.length - 1]).toBe('Точки: Ratusz')
    expect(fulls.some((full) => full.includes('Ratusz; Ratusz; Ratusz'))).toBe(false)
    expect(cancel).toHaveBeenCalled()

    // native fetch без стрима: события после цикла не дописываются.
    const nativeFetch = jest.fn(async () => makeResponse({ text: sse(chunk('А; Рынок; Рынок; Рынок'), chunk(' и дальше'), finalChunk, '[DONE]') }))
    const native = await new LlamaCppGenerator('http://127.0.0.1:8080', { fetchImpl: nativeFetch as unknown as typeof fetch }).generate({ messages })
    expect(native.text).toBe('А; Рынок')
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
