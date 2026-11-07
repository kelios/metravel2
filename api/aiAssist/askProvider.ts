/**
 * Провайдер `ask` (#2884): экран ассистента ходит в серверный `POST /ai/ask`
 * службы metravel-assist (#2713), а не в `llama-server` напрямую. Сервер сам
 * фильтрует темы, считает лимит и блок на IP, подбирает карточки по индексу и
 * держит страж ссылок; клиент только показывает поток `sources → text* → done`.
 *
 * Контракт ответа (`scripts/ai-assist/ask.ts`):
 * - отказы ДО потока — JSON `{error, detail, retry_after_sec?, strikes?, strikes_to_block?}`
 *   с кодами `429 limit | offtopic_blocked | busy`, `503 generator_unavailable | busy`
 *   и заголовком `Retry-After`;
 * - поток — SSE с именованными событиями: `sources {sources, degraded, remaining}`,
 *   `text {text}` (накопленный текст после стража, не дельта), `done {status, …}`.
 *
 * Стрим читается общим `consumeSseResponse` из `generator.ts`: `ReadableStream` на
 * web, целиком из `text()` на native — контракт тот же.
 */

import { GENERATION_TIMEOUT_MS, consumeSseResponse } from './generator'
import type { AiSourceRef } from './sourceRef'
import type { AiHistoryItem, AiSource, AiUsage } from './types'

const DEFAULT_RETRY_AFTER_SEC = 30
/**
 * Потолок текста одного сообщения истории — `MAX_HISTORY_TEXT_LENGTH` сервера
 * (`scripts/ai-assist/ask.ts`): длиннее сервер отвечает 400, и уточнение после
 * длинного ответа модели (400 токенов) не уходило бы никогда. Промпт и так режет
 * историю до той же длины (`prompt.ts`), поэтому обрезка смысла не меняет.
 */
export const ASK_HISTORY_TEXT_LIMIT = 1200

export type AskErrorKind = 'limit' | 'offtopic_blocked' | 'busy' | 'unavailable' | 'aborted' | 'bad_response'

export class AskError extends Error {
  readonly kind: AskErrorKind
  readonly status: number | null
  readonly retryAfterSec: number | null
  /** Вопросов не по теме за день (только у `offtopic_blocked`). */
  readonly strikes: number | null

  constructor(
    kind: AskErrorKind,
    message: string,
    options: { status?: number | null; retryAfterSec?: number | null; strikes?: number | null } = {},
  ) {
    super(message)
    this.name = 'AskError'
    this.kind = kind
    this.status = options.status ?? null
    this.retryAfterSec = options.retryAfterSec ?? null
    this.strikes = options.strikes ?? null
  }
}

export const isAskError = (error: unknown): error is AskError =>
  error instanceof AskError || (typeof error === 'object' && error !== null && (error as { name?: string }).name === 'AskError')

export type AskDoneStatus = 'done' | 'off_topic' | 'no_sources' | 'unavailable' | 'error'

export type AskDoneEvent = {
  status: AskDoneStatus
  /** `offtopic_warning` — 1-й/2-й вопрос не по теме (со `strikes`); `model_refusal` — отказ модели, без счётчика. */
  reason: 'offtopic_warning' | 'model_refusal' | null
  strikes: number | null
  strikesToBlock: number | null
  removedLinks: number
  usage: AiUsage | null
  remaining: number | null
}

export type AskSourcesEvent = {
  sources: AiSource[]
  /** Лексика бэкенда не ответила: подбор только векторный. */
  degraded: boolean
  /** Остаток дневного лимита после списания этого вопроса. */
  remaining: number | null
}

export type AskRequest = {
  question: string
  locale: string
  history: AiHistoryItem[]
  /** Страница, с которой открыт ассистент (#2897): сервер ставит её карточку первой. */
  source?: AiSourceRef | null
  signal?: AbortSignal
  onSources?: (event: AskSourcesEvent) => void
  /** Накопленный текст после серверного стража (не дельта). */
  onText?: (text: string) => void
}

export type AskResult = {
  sources: AiSource[]
  text: string
  done: AskDoneEvent
}

export interface AskClient {
  ask(request: AskRequest): Promise<AskResult>
}

const toInt = (value: unknown): number | null => {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null
}

const toRetryAfter = (header: string | null, body: Record<string, unknown> | null): number => {
  const fromBody = toInt(body?.retry_after_sec)
  if (fromBody !== null && fromBody > 0) return fromBody
  const fromHeader = toInt(header)
  return fromHeader !== null && fromHeader > 0 ? fromHeader : DEFAULT_RETRY_AFTER_SEC
}

const toUsage = (value: unknown): AiUsage | null => {
  if (!value || typeof value !== 'object') return null
  const usage = value as Partial<AiUsage>
  return {
    prompt_tokens: typeof usage.prompt_tokens === 'number' ? usage.prompt_tokens : null,
    completion_tokens: typeof usage.completion_tokens === 'number' ? usage.completion_tokens : null,
    ttft_ms: typeof usage.ttft_ms === 'number' ? usage.ttft_ms : 0,
    tokens_per_s: typeof usage.tokens_per_s === 'number' ? usage.tokens_per_s : null,
  }
}

const toSource = (value: unknown): AiSource | null => {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  const type = raw.type === 'quest' ? 'quest' : raw.type === 'travel' ? 'travel' : null
  const url = typeof raw.url === 'string' ? raw.url.trim() : ''
  if (!type || !url) return null
  let path = typeof raw.path === 'string' ? raw.path : ''
  if (!path) {
    try {
      path = new URL(url).pathname
    } catch {
      return null
    }
  }
  return {
    type,
    source_id: String(raw.source_id ?? ''),
    title: typeof raw.title === 'string' ? raw.title : '',
    url,
    path,
    snippet: typeof raw.snippet === 'string' ? raw.snippet : '',
    score: typeof raw.score === 'number' ? raw.score : 0,
  }
}

export type ParsedAskEvent =
  | { name: 'sources'; data: AskSourcesEvent }
  | { name: 'text'; data: { text: string } }
  | { name: 'done'; data: AskDoneEvent }

/** Одно событие SSE `/ai/ask` → типизированное событие; чужие имена и битый JSON — `null`. */
export const parseAskSseEvent = (event: string): ParsedAskEvent | null => {
  let name = ''
  const dataLines: string[] = []
  for (const line of event.split('\n')) {
    if (line.startsWith('event:')) name = line.slice(6).trim()
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim())
  }
  if (!name || !dataLines.length) return null
  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(dataLines.join('\n'))
  } catch {
    return null
  }
  if (!payload || typeof payload !== 'object') return null
  if (name === 'sources') {
    const list = Array.isArray(payload.sources) ? payload.sources : []
    return {
      name,
      data: {
        sources: list.map(toSource).filter((source): source is AiSource => source !== null),
        degraded: payload.degraded === true,
        remaining: toInt(payload.remaining),
      },
    }
  }
  if (name === 'text') return { name, data: { text: typeof payload.text === 'string' ? payload.text : '' } }
  if (name === 'done') {
    const status = payload.status
    const known: AskDoneStatus[] = ['done', 'off_topic', 'no_sources', 'unavailable', 'error']
    const reason = payload.reason === 'offtopic_warning' || payload.reason === 'model_refusal' ? payload.reason : null
    return {
      name,
      data: {
        status: known.includes(status as AskDoneStatus) ? (status as AskDoneStatus) : 'error',
        reason,
        strikes: toInt(payload.strikes),
        strikesToBlock: toInt(payload.strikes_to_block),
        removedLinks: toInt(payload.removed_links) ?? 0,
        usage: toUsage(payload.usage),
        remaining: toInt(payload.remaining),
      },
    }
  }
  return null
}

const isAbortError = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { name?: string }).name === 'AbortError'

/** Отказ до потока: код и `error` тела → вид ошибки для экрана. */
export const askErrorFromResponse = (status: number, body: Record<string, unknown> | null, retryAfterHeader: string | null): AskError => {
  const code = typeof body?.error === 'string' ? body.error : ''
  const detail = typeof body?.detail === 'string' ? body.detail : `ask responded ${status}`
  const retryAfterSec = toRetryAfter(retryAfterHeader, body)
  if (status === 429) {
    if (code === 'limit') return new AskError('limit', detail, { status, retryAfterSec })
    if (code === 'offtopic_blocked') return new AskError('offtopic_blocked', detail, { status, retryAfterSec, strikes: toInt(body?.strikes) })
    return new AskError('busy', detail, { status, retryAfterSec })
  }
  if (status === 503 && code === 'busy') return new AskError('busy', detail, { status, retryAfterSec })
  return new AskError('unavailable', detail, { status, retryAfterSec })
}

export type HttpAskClientOptions = {
  fetchImpl?: typeof fetch
  timeoutMs?: number
}

export class HttpAskClient implements AskClient {
  private readonly baseUrl: string
  private readonly fetchImpl: typeof fetch
  private readonly timeoutMs: number

  /** `baseUrl` — origin службы без слэша; пустая строка — same-origin (web за Metro/nginx). */
  constructor(baseUrl: string, options: HttpAskClientOptions = {}) {
    this.baseUrl = String(baseUrl ?? '').trim().replace(/\/+$/, '')
    this.fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init))
    this.timeoutMs = options.timeoutMs ?? GENERATION_TIMEOUT_MS
  }

  async ask({ question, locale, history, source, signal, onSources, onText }: AskRequest): Promise<AskResult> {
    const controller = new AbortController()
    // Таймаут — не отмена посетителем: иначе экран молча показывал бы «ответ
    // остановлен» там, где служба не ответила за две минуты.
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

    let sources: AiSource[] = []
    let text = ''
    let done: AskDoneEvent | null = null

    const consumeEvent = (event: string) => {
      if (done) return
      const parsed = parseAskSseEvent(event)
      if (!parsed) return
      if (parsed.name === 'sources') {
        sources = parsed.data.sources
        onSources?.(parsed.data)
      } else if (parsed.name === 'text') {
        text = parsed.data.text
        onText?.(text)
      } else {
        done = parsed.data
      }
    }

    const failure = (error: unknown, fallback: string): AskError => {
      if (isAskError(error)) return error
      if (signal?.aborted) return new AskError('aborted', 'ask aborted')
      if (timedOut) return new AskError('unavailable', `ask timed out after ${this.timeoutMs} ms`)
      if (isAbortError(error)) return new AskError('aborted', 'ask aborted')
      return new AskError('unavailable', fallback)
    }

    try {
      let response: Response
      try {
        response = await this.fetchImpl(`${this.baseUrl}/ai/ask`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
          body: JSON.stringify({
            q: question,
            locale,
            history: history.map(({ role, text }) => ({ role, text: text.slice(0, ASK_HISTORY_TEXT_LIMIT) })),
            // Поле уходит только с источником: тело без него — прежний контракт `/ai/ask`.
            ...(source ? { source: { type: source.type, id: source.id } } : {}),
          }),
          signal: controller.signal,
        })
      } catch (error) {
        throw failure(error, 'ask service unreachable')
      }

      if (!response.ok) {
        let body: Record<string, unknown> | null = null
        try {
          const raw = await response.text()
          body = raw ? (JSON.parse(raw) as Record<string, unknown>) : null
        } catch {
          body = null
        }
        throw askErrorFromResponse(response.status, body, response.headers?.get?.('Retry-After') ?? null)
      }

      await consumeSseResponse(response, { consume: consumeEvent, isFinished: () => done !== null })

      // Поток закрылся без `done` — служба или прокси оборвали ответ: честный «недоступен».
      const finished: AskDoneEvent = done ?? {
        status: 'unavailable',
        reason: null,
        strikes: null,
        strikesToBlock: null,
        removedLinks: 0,
        usage: null,
        remaining: null,
      }
      return { sources, text, done: finished }
    } catch (error) {
      throw failure(error, 'ask stream failed')
    } finally {
      clearTimeout(timeout)
      signal?.removeEventListener('abort', forwardAbort)
    }
  }
}

export const createAskClient = (baseUrl: string, options?: HttpAskClientOptions): AskClient => new HttpAskClient(baseUrl, options)
