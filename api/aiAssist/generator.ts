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
 * тела не стримит — тогда SSE разбирается целиком из `text()`, контракт тот же
 * (`consumeSseResponse`, общий с провайдером `ask`).
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
  /** Потолок ответа вместо `LLAMACPP_MAX_TOKENS`: помощник автора (#2885) просит три лида разом. */
  maxTokens?: number
  /**
   * Сколько рекомендаций оставить в ответе (#3216): стрим закрывается на следующей. Задаёт только
   * ответ ассистента; помощнику автора и фильтру карты списки нужны целиком.
   */
  maxRecommendations?: number
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

/**
 * Читает SSE-ответ до конца или пока `isFinished()` не скажет, что событий больше не
 * ждём: по мере прихода через `ReadableStream` (web) или целиком из `text()` (native
 * `fetch` тела не стримит). Все события одного куска отдаются `consume` — финальный
 * `usage` llama.cpp приходит после `finish_reason` в том же куске. Общий для
 * провайдеров `llamacpp` и `ask` (#2884).
 */
export const consumeSseResponse = async (
  response: Response,
  { consume, isFinished }: { consume: (event: string) => void; isFinished: () => boolean },
): Promise<void> => {
  const body = response.body as ReadableStream<Uint8Array> | null | undefined
  if (body && typeof body.getReader === 'function' && typeof TextDecoder !== 'undefined') {
    const reader = body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (!isFinished()) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const { events, rest } = splitSseEvents(buffer)
      buffer = rest
      for (const event of events) consume(event)
    }
    if (!isFinished() && buffer.trim()) consume(buffer)
    if (isFinished()) void reader.cancel().catch(() => undefined)
    return
  }
  const text = await response.text()
  const { events, rest } = splitSseEvents(text)
  for (const event of events) consume(event)
  if (rest.trim()) consume(rest)
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

const LIST_ITEM_RE = /^[ \t]*(?:[-*•]|\d+[.)])[ \t]+\S/
const LINK_IN_TEXT_RE = /\[[^\]\n]*\]\(\s*(https?:\/\/[^\s)\]>»"']+)|https?:\/\/[^\s)\]>»"']+/g
const URL_TRAILING_PUNCTUATION_RE = /[.,;:!?]+$/
const LAST_LINE_RE = /\n([^\n]*)$/
const LIST_INTRO_RE = /[:：][\s*_]*$/
const CLAUSE_END_RE = /[.!?;](?=[^.!?;]*$)/

/** Текст без хвоста из разделителей и без подводки к отрезанным пунктам («День 3:», «Ещё варианты:»). */
const trimCutTail = (text: string): string => {
  let kept = text.replace(TRAILING_SEPARATORS_RE, '')
  for (let last = LAST_LINE_RE.exec(kept); last && !LIST_ITEM_RE.test(last[1]) && LIST_INTRO_RE.test(last[1]); last = LAST_LINE_RE.exec(kept)) {
    kept = kept.slice(0, last.index).replace(TRAILING_SEPARATORS_RE, '')
  }
  return kept
}

/**
 * Где закончить фразу, если лишняя рекомендация началась посреди строки: после последней
 * границы («.», «!», «?», «;») между оставленной ссылкой и лишней, иначе по последней запятой,
 * иначе сразу за оставленной ссылкой («A, B, C и D» → «A, B, C»).
 */
const clauseEndBefore = (text: string, keptLinkEnd: number, overflowStart: number): number => {
  const between = text.slice(keptLinkEnd, overflowStart)
  const boundary = CLAUSE_END_RE.exec(between)
  if (boundary) return keptLinkEnd + boundary.index + (boundary[0] === ';' ? 0 : 1)
  const comma = between.lastIndexOf(',')
  return comma >= 0 ? keptLinkEnd + comma : keptLinkEnd
}

/**
 * Длина текста до первой рекомендации сверх лимита (#3216) или `null`, если лишних нет.
 *
 * Рекомендация — пункт списка либо новый адрес (первый адрес пункта — тот же пункт). Лишнее:
 * - пункт списка после `maxItems` рекомендаций и строка, все новые адреса которой сверх лимита
 *   («В карточках также — …») — режется с начала строки;
 * - адрес посреди строки, где лимит уже набран («A — …; B — …; C — …; D — …» одной фразой,
 *   замер 09.11.2026 на v6) — фраза заканчивается на границе перед ним (`clauseEndBefore`).
 * Последняя строка может быть недописанной — пункт виден по маркеру, адрес — как только
 * начался и разошёлся с уже названными. Подводка к отрезанным пунктам (строка с двоеточием
 * в конце прямо перед ними) уходит вместе с ними.
 */
export const findRecommendationOverflowCut = (text: string, maxItems: number): number | null => {
  if (!(maxItems > 0)) return null
  const seen = new Set<string>()
  let count = 0
  let position = 0
  for (const line of text.split('\n')) {
    const isItem = LIST_ITEM_RE.test(line)
    if (isItem && count >= maxItems) return trimCutTail(text.slice(0, position)).length
    if (isItem) count += 1
    // Первый новый адрес пункта списка принадлежит самому пункту и отдельно не считается.
    let itemLinkPending = isItem
    let keptLinkEnd: number | null = null
    for (const match of line.matchAll(LINK_IN_TEXT_RE)) {
      const url = (match[1] ?? match[0]).replace(URL_TRAILING_PUNCTUATION_RE, '')
      const start = position + (match.index ?? 0)
      let end = start + match[0].length
      if (!seen.has(url)) {
        // Адрес в конце потока ещё дописывается: начало уже названного — не новая рекомендация.
        if (end === text.length && [...seen].some((known) => known.startsWith(url))) continue
        if (itemLinkPending) itemLinkPending = false
        else if (count >= maxItems) {
          return trimCutTail(text.slice(0, keptLinkEnd === null ? position : clauseEndBefore(text, keptLinkEnd, start))).length
        } else count += 1
        seen.add(url)
      }
      if (text[end] === ')') end += 1
      keptLinkEnd = end
    }
    position += line.length + 1
  }
  return null
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

  async generate({ messages, signal, onDelta, maxTokens, maxRecommendations }: GenerateRequest): Promise<AiGenerateResult> {
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
    let stoppedEarly = false

    const consumeEvent = (event: string) => {
      if (stoppedEarly) return
      const parsed = parseSseEvent(event)
      if (!parsed) return
      if (parsed.usage) usage = parsed.usage
      if (parsed.delta) {
        if (firstTokenAt === null) firstTokenAt = this.now()
        full += parsed.delta
        // Цикл и рекомендации сверх лимита (#3216) не дописываются до max_tokens:
        // стрим закрывается на первом из них, хвост не показывается.
        const cuts = [findRepetitionLoopCut(full), maxRecommendations ? findRecommendationOverflowCut(full, maxRecommendations) : null].filter(
          (cut): cut is number => cut !== null,
        )
        if (cuts.length) {
          full = full.slice(0, Math.min(...cuts))
          onDelta?.('', full)
          stoppedEarly = true
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
            max_tokens: maxTokens ?? LLAMACPP_MAX_TOKENS,
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

      await consumeSseResponse(response, { consume: consumeEvent, isFinished: () => finished })

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
