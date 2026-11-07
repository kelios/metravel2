/**
 * Общий каркас коротких запросов к `metravel-llm` со своей суточной квотой на IP
 * (`/ai/author-draft` #2885, `/ai/intent` #2887): разбор тела → списание квоты →
 * очередь к модели (общая с `/ai/ask`) → разбор ответа. Любой отказ после списания
 * возвращает запрос в квоту; коды ответов одинаковы у всех таких эндпоинтов:
 *
 *   429 limit — квота исчерпана (`Retry-After` до полуночи) · 429 busy — очередь к модели
 *   503 generator_unavailable — `AI_LLM_URL` не задан или модель не ответила
 *   `null` — посетитель закрыл соединение: отвечать некому.
 *
 * Валидация тела (`parse`) и разбор ответа модели (`result`) — свои у каждого эндпоинта;
 * `result` бросает `HttpError`, если ответ модели непригоден.
 */
import type http from 'node:http'

import { type Generator, isAiGeneratorError } from '../../api/aiAssist/generator.ts'
import type { AiChatMessage } from '../../api/aiAssist/types.ts'
import { clientIp, GENERATOR_RETRY_AFTER_SEC } from './ask.ts'
import type { AskLimits } from './limits.ts'
import { HttpError } from './params.ts'
import { BusyError, type SingleFlight } from './queue.ts'

export interface QuotaGenerationDeps {
  /** `null` — `AI_LLM_URL` не задан: 503 generator_unavailable. */
  generator: Generator | null
  /** Очередь к модели — общая с `/ai/ask`: один ответ одновременно. */
  llmQueue: SingleFlight
  queueTimeoutMs: number
  /** Счётчик на IP со своим префиксом; из `AskLimits` используется только квота. */
  limits: AskLimits
  trustProxy: boolean
  log: (line: string) => void
  now?: () => Date
}

export interface QuotaGenerationSpec<Input, Result> {
  /** `POST /ai/…` — для журнала. */
  route: string
  /** Что исчерпано: «запросов помощника» → «дневной лимит 5 запросов помощника исчерпан». */
  limitNoun: string
  /** Разбор тела до списания квоты; кривое тело — `HttpError` 400. */
  parse: (input: Record<string, unknown>) => Input
  messages: (input: Input) => AiChatMessage[]
  maxTokens: (input: Input) => number
  /** Ответ модели → результат; `HttpError` — ответ непригоден, запрос возвращается в квоту. */
  result: (text: string, input: Input, remaining: number) => Result
}

export type QuotaGenerationHandler<Result> = (request: http.IncomingMessage, response: http.ServerResponse, body: unknown) => Promise<Result | null>

export function createQuotaGenerationHandler<Input, Result>(
  deps: QuotaGenerationDeps,
  spec: QuotaGenerationSpec<Input, Result>,
): QuotaGenerationHandler<Result> {
  const { limits, log } = deps
  const nowFn = deps.now ?? (() => new Date())

  return async (request, response, body) => {
    const now = nowFn()
    const input = spec.parse((body && typeof body === 'object' ? body : {}) as Record<string, unknown>)
    const ip = clientIp(request, deps.trustProxy)

    const quota = await limits.consumeQuestion(ip, now)
    const refund = () => limits.refundQuestion(ip, now)
    if (quota.exceeded) {
      await refund()
      throw new HttpError(429, 'limit', {
        detail: `дневной лимит ${limits.dailyLimit} ${spec.limitNoun} исчерпан`,
        retryAfterSec: limits.retryAfterSeconds(now),
        extra: { retry_after_sec: limits.retryAfterSeconds(now), limit: limits.dailyLimit },
      })
    }

    const generator = deps.generator
    if (!generator) {
      await refund()
      throw new HttpError(503, 'generator_unavailable', { detail: 'AI_LLM_URL не задан', retryAfterSec: GENERATOR_RETRY_AFTER_SEC })
    }

    const controller = new AbortController()
    response.once('close', () => {
      if (!response.writableFinished) controller.abort()
    })
    if (response.destroyed) controller.abort()

    try {
      const answer = await deps.llmQueue.run(deps.queueTimeoutMs, () =>
        generator.generate({ messages: spec.messages(input), signal: controller.signal, maxTokens: spec.maxTokens(input) }),
      )
      return spec.result(answer.text, input, quota.remaining)
    } catch (error) {
      // Любой отказ после списания — запрос возвращается в квоту.
      await refund()
      if (error instanceof HttpError) throw error
      if (error instanceof BusyError) {
        throw new HttpError(429, 'busy', { detail: error.message, retryAfterSec: GENERATOR_RETRY_AFTER_SEC })
      }
      if (isAiGeneratorError(error)) {
        if (error.kind === 'aborted') {
          response.destroy()
          return null
        }
        if (error.kind === 'busy') {
          throw new HttpError(429, 'busy', { detail: error.message, retryAfterSec: error.retryAfterSec ?? GENERATOR_RETRY_AFTER_SEC })
        }
        throw new HttpError(503, 'generator_unavailable', { detail: error.message, retryAfterSec: GENERATOR_RETRY_AFTER_SEC })
      }
      log(`${spec.route}: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`)
      throw error
    }
  }
}
