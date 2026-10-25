/**
 * Генератор ответа: провайдер `llamacpp` за интерфейсом `Generator` (#2460).
 *
 * Единственная реализация — OpenAI-совместимый HTTP `llama-server`
 * (`metravel-llm`): `POST {base}/v1/chat/completions`, `stream: true`,
 * `max_tokens` 400, `temperature` 0.3, `presence_penalty` 1.5, `enable_thinking: false`. Облачных SDK в
 * зависимостях нет и не будет: ответы посетителям даёт только своя модель
 * (решение владельца 17.10.2026).
 *
 * Стрим читается через `ReadableStream` там, где он есть (web); native `fetch`
 * тела не стримит — тогда SSE разбирается целиком из `text()`, контракт тот же.
 */

import type { AiChatMessage, AiGenerateResult, AiUsage } from './types'

export const LLAMACPP_MAX_TOKENS = 400
export const LLAMACPP_TEMPERATURE = 0.3
/**
 * Штраф за уже сказанное (замеры 25.10.2026, краковский вопрос, #2709). Старые карточки,
 * 12 прогонов: без штрафа 1 цикл и 7 протечек шаблона карточки статьи, `repeat_penalty` 1.1 —
 * 1 и 9, `frequency_penalty` 0.5 — 0 и 7, `presence_penalty` 1.0 — 0 и 5. Новые карточки
 * (путеводитель + квесты): `presence_penalty` 1.0 — круг пунктов в 5 из 10, ссылки в 7;
 * 1.5 — 3 из 8 и 8. Остаток циклов срезает `findRepetitionLoopCut`.
 */
export const LLAMACPP_PRESENCE_PENALTY = 1.5
export const LLAMACPP_MODEL_NAME = 'metravel-llm'
export const GENERATION_TIMEOUT_MS = 120_000
const DEFAULT_RETRY_AFTER_SEC = 30

export type AiGeneratorErrorKind = 'unavailable' | 'busy' | 'aborted' | 'bad_response'

export class AiGeneratorError extends Error {
  readonly kind: AiGeneratorErrorKind
  readonly status: number | null
  readonly retryAfterSec: number | null

  constructor(kind: AiGeneratorErrorKind, message: string, options: { status?: number | null; retryAfterSec?: number | null } = {}) {
    super(message)
    this.name = 'AiGeneratorError'
    this.kind = kind
    this.status = options.status ?? null
    this.retryAfterSec = options.retryAfterSec ?? null
  }
}

export const isAiGeneratorError = (error: unknown): error is AiGeneratorError =>
  error instanceof AiGeneratorError || (typeof error === 'object' && error !== null && (error as { name?: string }).name === 'AiGeneratorError')

export type GenerateRequest = {
  messages: AiChatMessage[]
  signal?: AbortSignal
  /** Вызывается на каждый фрагмент: дельта и накопленный текст. */
  onDelta?: (delta: string, full: string) => void
}

export interface Generator {
  generate(request: GenerateRequest): Promise<AiGenerateResult>
}

type SseUsage = { prompt_tokens?: number; completion_tokens?: number }

export type ParsedSseEvent = {
  delta: string
  done: boolean
  usage: SseUsage | null
}

/** Делит буфер SSE на готовые события; хвост без завершающей пустой строки возвращается. */
export const splitSseEvents = (buffer: string): { events: string[]; rest: string } => {
  const normalized = buffer.replace(/\r\n/g, '\n')
  const parts = normalized.split('\n\n')
  const rest = parts.pop() ?? ''
  return { events: parts.filter((part) => part.trim().length > 0), rest }
}

/** Одно событие SSE → дельта текста, признак конца и usage из финального чанка. */
export const parseSseEvent = (event: string): ParsedSseEvent | null => {
  const dataLines = event
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim())
  if (!dataLines.length) return null
  const data = dataLines.join('\n')
  if (data === '[DONE]') return { delta: '', done: true, usage: null }
  let payload: {
    choices?: Array<{ delta?: { content?: string | null }; finish_reason?: string | null }>
    usage?: SseUsage | null
    error?: { message?: string } | string
  }
  try {
    payload = JSON.parse(data)
  } catch {
    return null
  }
  if (payload.error) {
    const message = typeof payload.error === 'string' ? payload.error : payload.error.message || 'generator error'
    throw new AiGeneratorError('bad_response', message)
  }
  const choice = payload.choices?.[0]
  const delta = typeof choice?.delta?.content === 'string' ? choice.delta.content : ''
  const done = Boolean(choice?.finish_reason)
  return { delta, done, usage: payload.usage ?? null }
}

/**
 * Зацикливание модели (#2709), два вида:
 * - один пункт три раза подряд через «;», «,» или перенос строки («Ratusz; Ratusz;
 *   Ratusz…» до `max_tokens`); пункт начинается с буквы и не содержит разделителей,
 *   смотрим только хвост — цикл растёт в конце;
 * - круг из нескольких пунктов списка (A, B, C, A, B, C…): законченная строка
 *   повторяет уже написанную, и следующая за ней — тоже ту, что шла после
 *   оригинала. Одна повторённая строка — не цикл: подзаголовок «Что посмотреть:»
 *   у каждого дня плана повторяется законно, а за ним идёт другое содержание.
 */
const REPETITION_LOOP_RE = /(\p{L}[^;\n]{2,199}?)(?:[ \t]*[;,\n][ \t\n]*\1){2,}/u
const REPETITION_WINDOW = 1500
const MIN_REPEATED_LINE_LENGTH = 12
const LIST_MARKER_RE = /^[\s\-–—•*·\d.)]+/
const TRAILING_SEPARATORS_RE = /[\s;,]+$/

const repeatedItemCut = (text: string): number | null => {
  const offset = Math.max(0, text.length - REPETITION_WINDOW)
  const match = REPETITION_LOOP_RE.exec(text.slice(offset))
  return match ? offset + match.index + match[1].length : null
}

/** Начало первой законченной строки, с которой повторяются две строки подряд. */
const repeatedLineCut = (text: string): number | null => {
  const lines = text.split('\n')
  const keys: string[] = []
  const starts: number[] = []
  let position = 0
  // Последняя строка ещё дописывается — сравниваются только законченные; пустые пропускаются.
  for (let i = 0; i < lines.length - 1; i += 1) {
    const key = lines[i].replace(LIST_MARKER_RE, '').trim().toLowerCase()
    if (key) {
      keys.push(key)
      starts.push(position)
    }
    position += lines[i].length + 1
  }
  const firstIndex = new Map<string, number>()
  for (let k = 0; k < keys.length; k += 1) {
    if (keys[k].length < MIN_REPEATED_LINE_LENGTH) continue
    const earlier = firstIndex.get(keys[k])
    if (earlier === undefined) firstIndex.set(keys[k], k)
    else if (k + 1 < keys.length && keys[k + 1] === keys[earlier + 1]) return starts[k]
  }
  return null
}

/** Длина текста без зацикленного хвоста (первое вхождение остаётся) или `null`, если цикла нет. */
export const findRepetitionLoopCut = (text: string): number | null => {
  const cuts = [repeatedItemCut(text), repeatedLineCut(text)].filter((cut): cut is number => cut !== null)
  if (!cuts.length) return null
  return text.slice(0, Math.min(...cuts)).replace(TRAILING_SEPARATORS_RE, '').length
}

const isAbortError = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { name?: string }).name === 'AbortError'

const parseRetryAfter = (value: string | null): number => {
  const seconds = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(seconds) && seconds > 0 ? seconds : DEFAULT_RETRY_AFTER_SEC
}

const buildUsage = (usage: SseUsage | null, startedAt: number, firstTokenAt: number | null, finishedAt: number): AiUsage => {
  const completion = typeof usage?.completion_tokens === 'number' ? usage.completion_tokens : null
  const generationMs = firstTokenAt ? finishedAt - firstTokenAt : 0
  return {
    prompt_tokens: typeof usage?.prompt_tokens === 'number' ? usage.prompt_tokens : null,
    completion_tokens: completion,
    ttft_ms: (firstTokenAt ?? finishedAt) - startedAt,
    tokens_per_s: completion && generationMs > 0 ? Math.round((completion / generationMs) * 1000 * 10) / 10 : null,
  }
}

export type LlamaCppGeneratorOptions = {
  fetchImpl?: typeof fetch
  timeoutMs?: number
  now?: () => number
}

export class LlamaCppGenerator implements Generator {
  private readonly baseUrl: string
  private readonly fetchImpl: typeof fetch
  private readonly timeoutMs: number
  private readonly now: () => number

  constructor(baseUrl: string, options: LlamaCppGeneratorOptions = {}) {
    this.baseUrl = String(baseUrl ?? '').trim().replace(/\/+$/, '')
    this.fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init))
    this.timeoutMs = options.timeoutMs ?? GENERATION_TIMEOUT_MS
    this.now = options.now ?? (() => Date.now())
  }

  async generate({ messages, signal, onDelta }: GenerateRequest): Promise<AiGenerateResult> {
    if (!this.baseUrl) throw new AiGeneratorError('unavailable', 'assistant url is not configured')
    const controller = new AbortController()
    // Таймаут — не отмена посетителем: иначе экран молча показывал бы «ответ
    // остановлен» там, где сервер модели не ответил за две минуты.
    let timedOut = false
    const timeout = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, this.timeoutMs)
    const forwardAbort = () => controller.abort()
    if (signal) {
      if (signal.aborted) controller.abort()
      else signal.addEventListener('abort', forwardAbort, { once: true })
    }

    const startedAt = this.now()
    let firstTokenAt: number | null = null
    let full = ''
    let usage: SseUsage | null = null
    let finished = false
    let stoppedOnLoop = false

    const consumeEvent = (event: string) => {
      if (stoppedOnLoop) return
      const parsed = parseSseEvent(event)
      if (!parsed) return
      if (parsed.usage) usage = parsed.usage
      if (parsed.delta) {
        if (firstTokenAt === null) firstTokenAt = this.now()
        full += parsed.delta
        const loopCut = findRepetitionLoopCut(full)
        if (loopCut !== null) {
          // Цикл не дописывается до max_tokens: стрим закрывается, хвост не показывается.
          full = full.slice(0, loopCut)
          onDelta?.('', full)
          stoppedOnLoop = true
          finished = true
          return
        }
        onDelta?.(parsed.delta, full)
      }
      if (parsed.done) finished = true
    }

    try {
      let response: Response
      try {
        response = await this.fetchImpl(`${this.baseUrl}/v1/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
          body: JSON.stringify({
            model: LLAMACPP_MODEL_NAME,
            messages,
            stream: true,
            stream_options: { include_usage: true },
            max_tokens: LLAMACPP_MAX_TOKENS,
            temperature: LLAMACPP_TEMPERATURE,
            presence_penalty: LLAMACPP_PRESENCE_PENALTY,
            chat_template_kwargs: { enable_thinking: false },
          }),
          signal: controller.signal,
        })
      } catch (error) {
        if (signal?.aborted) throw new AiGeneratorError('aborted', 'generation aborted')
        if (timedOut) throw new AiGeneratorError('unavailable', `generator timed out after ${this.timeoutMs} ms`)
        if (isAbortError(error)) throw new AiGeneratorError('aborted', 'generation aborted')
        throw new AiGeneratorError('unavailable', 'generator unreachable')
      }

      if (response.status === 429) {
        throw new AiGeneratorError('busy', 'generator busy', {
          status: 429,
          retryAfterSec: parseRetryAfter(response.headers?.get?.('Retry-After') ?? null),
        })
      }
      if (!response.ok) {
        throw new AiGeneratorError('unavailable', `generator responded ${response.status}`, { status: response.status })
      }

      const body = response.body as ReadableStream<Uint8Array> | null | undefined
      if (body && typeof body.getReader === 'function' && typeof TextDecoder !== 'undefined') {
        const reader = body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        while (!finished) {
          const { value, done } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const { events, rest } = splitSseEvents(buffer)
          buffer = rest
          for (const event of events) consumeEvent(event)
        }
        if (!finished && buffer.trim()) consumeEvent(buffer)
        if (finished) void reader.cancel().catch(() => undefined)
      } else {
        const text = await response.text()
        const { events, rest } = splitSseEvents(text)
        for (const event of events) consumeEvent(event)
        if (rest.trim()) consumeEvent(rest)
      }

      return { text: full, usage: buildUsage(usage, startedAt, firstTokenAt, this.now()) }
    } catch (error) {
      if (isAiGeneratorError(error)) throw error
      if (signal?.aborted) throw new AiGeneratorError('aborted', 'generation aborted')
      if (timedOut) throw new AiGeneratorError('unavailable', `generator timed out after ${this.timeoutMs} ms`)
      if (isAbortError(error)) throw new AiGeneratorError('aborted', 'generation aborted')
      throw new AiGeneratorError('unavailable', 'generator stream failed')
    } finally {
      clearTimeout(timeout)
      signal?.removeEventListener('abort', forwardAbort)
    }
  }
}

/** Провайдер по адресу из конфигурации; `null`, если адрес не задан. */
export const createGenerator = (baseUrl: string, options?: LlamaCppGeneratorOptions): Generator | null =>
  baseUrl ? new LlamaCppGenerator(baseUrl, options) : null
