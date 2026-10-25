/**
 * POST /ai/ask (#2713; серверная часть ассистента #2460): вопрос посетителя →
 * фильтр тем → лимиты на IP → подбор по индексу → промпт → metravel-llm → страж
 * ссылок, ответ одним SSE-потоком `sources → text* → done`. Правила фильтра,
 * промпт, страж и клиент модели — те же модули, что у экрана `/assistant`
 * (`api/aiAssist/*`): сервер и клиент не расходятся, а блок «третий вопрос не по
 * теме — до полуночи» держится на сервере, что бы ни делал клиент.
 *
 * Отказы ДО потока — JSON `{error, detail, …}`:
 *   400 bad_request · 429 offtopic_blocked и 429 limit (`Retry-After` — до полуночи
 *   Europe/Minsk, `retry_after_sec`) · 429 busy (очередь к модели) ·
 *   503 generator_unavailable (модель не ответила до первого токена) · 503 busy
 *   (очередь к эмбеддингу подбора).
 * Отказы В потоке — событие `done` со `status`:
 *   off_topic (`reason: offtopic_warning`, `strikes`, `strikes_to_block` — 1-й и 2-й
 *   вопрос не по теме; `reason: model_refusal` — отказ самой модели, в счётчик не
 *   идёт) · no_sources · unavailable (модель оборвалась посреди ответа) · error.
 * Событие `text` несёт накопленный текст после стража (`{text}`), не дельту:
 * страж может убрать уже показанный чужой адрес.
 */
import type http from 'node:http'

import { type Generator, isAiGeneratorError } from '../../api/aiAssist/generator.ts'
import { countKeptSourceLinks, enforceSourceLinks, guardStreamingText } from '../../api/aiAssist/linkGuard.ts'
import { buildAssistantMessages, MAX_HISTORY_ITEMS } from '../../api/aiAssist/prompt.ts'
import { classifyQuestion, isModelOffTopicReply } from '../../api/aiAssist/topicGate.ts'
import type { AiHistoryItem, AiSource } from '../../api/aiAssist/types.ts'
import type { DemandLog } from './demandLog.ts'
import type { AskLimits } from './limits.ts'
import { HttpError, parseLocale, parseQuery } from './params.ts'
import { BusyError, type SingleFlight } from './queue.ts'
import type { Locale } from './search.ts'

/** Период склейки фрагментов стрима в одно событие `text` — как на экране. */
export const STREAM_FLUSH_MS = 40
/** `Retry-After` для занятой или недоступной модели, с. */
export const GENERATOR_RETRY_AFTER_SEC = 30
const MAX_HISTORY_TEXT_LENGTH = 1200

export interface RetrievalResult {
  sources: AiSource[]
  /** Лексика бэкенда не ответила: подбор только векторный. */
  degraded: boolean
}

export interface AskDeps {
  /** Подбор карточек по индексу; бросает `HttpError` (503 busy) при занятой модели эмбеддинга. */
  retrieve: (q: string, locale: Locale) => Promise<RetrievalResult>
  /** `null` — `AI_LLM_URL` не задан: вопросы по теме получают 503 generator_unavailable. */
  generator: Generator | null
  /** Один ответ модели одновременно; ожидание дольше `queueTimeoutMs` → 429 busy. */
  llmQueue: SingleFlight
  queueTimeoutMs: number
  limits: AskLimits
  demandLog: DemandLog
  /** Брать IP из `X-Real-IP`/`X-Forwarded-For` (сервис за nginx), см. `clientIp`. */
  trustProxy: boolean
  log: (line: string) => void
  now?: () => Date
}

export type AskHandler = (request: http.IncomingMessage, response: http.ServerResponse, body: unknown) => Promise<void>

/**
 * IP посетителя: `X-Real-IP`, затем последний адрес `X-Forwarded-For`, иначе сокет.
 * nginx ставит `X-Real-IP $remote_addr` и дописывает адрес в конец `X-Forwarded-For`
 * (`$proxy_add_x_forwarded_for`); начало `X-Forwarded-For` присылает сам посетитель,
 * и по нему лимит и блок обходились бы сменой заголовка.
 */
export function clientIp(request: http.IncomingMessage, trustProxy: boolean): string {
  if (trustProxy) {
    const real = request.headers['x-real-ip']
    const realIp = (Array.isArray(real) ? real[0] : real)?.trim()
    if (realIp) return realIp
    const forwarded = request.headers['x-forwarded-for']
    const last = (Array.isArray(forwarded) ? forwarded.at(-1) : forwarded)?.split(',').at(-1)?.trim()
    if (last) return last
  }
  return request.socket?.remoteAddress || 'unknown'
}

function parseHistory(value: unknown): AiHistoryItem[] {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) throw new HttpError(400, 'bad_request', 'history: ожидался массив {role, text}')
  if (value.length > MAX_HISTORY_ITEMS) throw new HttpError(400, 'bad_request', `history: не длиннее ${MAX_HISTORY_ITEMS} сообщений`)
  return value.map((item) => {
    const role = (item as { role?: unknown })?.role
    const text = (item as { text?: unknown })?.text
    if ((role !== 'user' && role !== 'assistant') || typeof text !== 'string') {
      throw new HttpError(400, 'bad_request', 'history: элемент — {role: user|assistant, text: string}')
    }
    if (text.length > MAX_HISTORY_TEXT_LENGTH) throw new HttpError(400, 'bad_request', `history: текст не длиннее ${MAX_HISTORY_TEXT_LENGTH} символов`)
    return { role, text }
  })
}

interface Stream {
  event: (name: string, data: unknown) => void
  done: (data: Record<string, unknown>) => void
}

function openStream(response: http.ServerResponse): Stream {
  response.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-store',
    // nginx: SSE отдаётся по мере генерации, а не буфером в конце (#2457 ставит proxy_buffering off).
    'x-accel-buffering': 'no',
  })
  response.flushHeaders()
  const event = (name: string, data: unknown) => {
    if (response.writableEnded || response.destroyed) return
    response.write(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`)
  }
  return {
    event,
    done(data) {
      event('done', data)
      response.end()
    },
  }
}

export function createAskHandler(deps: AskDeps): AskHandler {
  const { limits, demandLog, log } = deps
  const nowFn = deps.now ?? (() => new Date())

  const blockedError = (strikes: number, now: Date) =>
    new HttpError(429, 'offtopic_blocked', {
      detail: `вопросы не по теме: ${strikes} из ${limits.strikesToBlock} за день, ассистент закрыт до полуночи`,
      retryAfterSec: limits.retryAfterSeconds(now),
      extra: { retry_after_sec: limits.retryAfterSeconds(now), strikes, strikes_to_block: limits.strikesToBlock },
    })

  return async (request, response, body) => {
    const now = nowFn()
    const input = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
    const question = parseQuery(input.q)
    const locale = parseLocale(input.locale)
    const history = parseHistory(input.history)
    const ip = clientIp(request, deps.trustProxy)

    // Блок держится на сервере: очистка хранилища клиента и прямой запрос его не снимают.
    const offTopic = await limits.offTopicState(ip, now)
    if (offTopic.blocked) throw blockedError(offTopic.strikes, now)

    // Чужая тема не тратит ни подбор, ни модель, ни дневной лимит; 3-я за день — журнал и блок.
    if (classifyQuestion(question).offTopic) {
      const next = await limits.registerOffTopicStrike(ip, now)
      if (next.blocked) {
        await demandLog.append({ q: question, locale, reason: 'offtopic_blocked' })
        throw blockedError(next.strikes, now)
      }
      const quota = await limits.quotaState(ip, now)
      const stream = openStream(response)
      stream.event('sources', { sources: [], degraded: false, remaining: quota.remaining })
      stream.done({ status: 'off_topic', reason: 'offtopic_warning', strikes: next.strikes, strikes_to_block: limits.strikesToBlock })
      return
    }

    const quota = await limits.consumeQuestion(ip, now)
    const refund = () => limits.refundQuestion(ip, now)
    if (quota.exceeded) {
      // Отклонённый вопрос не занимает место: иначе возврат параллельного вопроса после
      // такого отказа оставил бы счётчик на лимите, и посетитель потерял бы вопрос.
      await refund()
      throw new HttpError(429, 'limit', {
        detail: `дневной лимит ${limits.dailyLimit} вопросов исчерпан`,
        retryAfterSec: limits.retryAfterSeconds(now),
        extra: { retry_after_sec: limits.retryAfterSeconds(now), limit: limits.dailyLimit },
      })
    }

    let retrieved: RetrievalResult
    try {
      retrieved = await deps.retrieve(question, locale)
    } catch (error) {
      await refund()
      throw error
    }
    const { sources, degraded } = retrieved
    if (!sources.length) {
      await demandLog.append({ q: question, locale, reason: 'no_sources' })
      const stream = openStream(response)
      stream.event('sources', { sources: [], degraded, remaining: quota.remaining })
      stream.done({ status: 'no_sources' })
      return
    }

    const generator = deps.generator
    if (!generator) {
      await refund()
      await demandLog.append({ q: question, locale, reason: 'generator_unavailable' })
      throw new HttpError(503, 'generator_unavailable', { detail: 'AI_LLM_URL не задан', retryAfterSec: GENERATOR_RETRY_AFTER_SEC })
    }

    const messages = buildAssistantMessages({ question, locale, sources, history })
    const controller = new AbortController()
    // Посетитель закрыл вкладку или нажал «Остановить»: генерация прекращается.
    response.once('close', () => {
      if (!response.writableFinished) controller.abort()
    })
    // Соединение закрылось ещё во время подбора: `close` уже прошёл, модель не запускаем впустую.
    if (response.destroyed) controller.abort()

    let stream: Stream | null = null
    let pendingText = ''
    let flushTimer: ReturnType<typeof setTimeout> | null = null
    const clearFlush = () => {
      if (flushTimer) clearTimeout(flushTimer)
      flushTimer = null
    }
    // Источники уходят с первым токеном: до него отказ модели ещё может стать честным 503.
    const ensureStream = (): Stream => {
      if (!stream) {
        stream = openStream(response)
        stream.event('sources', { sources, degraded, remaining: quota.remaining })
      }
      return stream
    }
    const flush = () => {
      flushTimer = null
      ensureStream().event('text', { text: guardStreamingText(pendingText, sources).text })
    }

    try {
      const result = await deps.llmQueue.run(deps.queueTimeoutMs, () =>
        generator.generate({
          messages,
          signal: controller.signal,
          onDelta: (_delta, full) => {
            ensureStream()
            pendingText = full
            if (!flushTimer) flushTimer = setTimeout(flush, STREAM_FLUSH_MS)
          },
        }),
      )
      clearFlush()
      const guarded = enforceSourceLinks(result.text, sources)
      const open = ensureStream()
      if (isModelOffTopicReply(guarded.text, countKeptSourceLinks(guarded.text, sources))) {
        // Второй рубеж: модель узнала чужую тему по правилу промпта. В счётчик не идёт — модель
        // ошибается и на вопросах о поездке (замер #2710), блок за её ошибку получил бы посетитель.
        open.done({ status: 'off_topic', reason: 'model_refusal' })
        return
      }
      open.event('text', { text: guarded.text })
      open.done({ status: 'done', removed_links: guarded.removed, usage: result.usage, remaining: quota.remaining })
    } catch (error) {
      clearFlush()
      // `stream` открывается внутри колбэка: TS сузил бы его до null, читаем явно.
      const opened = stream as Stream | null
      if (error instanceof BusyError) {
        await refund()
        throw new HttpError(429, 'busy', { detail: error.message, retryAfterSec: GENERATOR_RETRY_AFTER_SEC })
      }
      if (isAiGeneratorError(error)) {
        if (error.kind === 'aborted') {
          // Соединение закрыл посетитель: отвечать некому. Вопрос возвращается только до первого
          // токена — иначе лимит обходится чтением `text` и обрывом до `done`.
          if (!opened) {
            await refund()
            response.destroy()
          }
          return
        }
        await refund()
        if (!opened) {
          if (error.kind === 'busy') {
            throw new HttpError(429, 'busy', { detail: error.message, retryAfterSec: error.retryAfterSec ?? GENERATOR_RETRY_AFTER_SEC })
          }
          await demandLog.append({ q: question, locale, reason: 'generator_unavailable' })
          throw new HttpError(503, 'generator_unavailable', { detail: error.message, retryAfterSec: GENERATOR_RETRY_AFTER_SEC })
        }
        await demandLog.append({ q: question, locale, reason: 'generator_unavailable' })
        opened.done({ status: 'unavailable' })
        return
      }
      await refund()
      if (!opened) throw error
      log(`POST /ai/ask: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`)
      opened.done({ status: 'error' })
    }
  }
}
