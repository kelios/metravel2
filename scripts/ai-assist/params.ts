/**
 * Разбор входа HTTP-слоя metravel-assist и ошибка с HTTP-статусом: общие для
 * `/ai/search`, `/ai/similar` и `/ai/ask`.
 */
import type { ChunkType } from '../ai-index/format.ts'
import { LOCALES, type Locale } from './search.ts'

export const MAX_QUERY_CHARS = 500
export const MAX_LIMIT = 20

export interface HttpErrorOptions {
  detail?: string
  /** Секунды для заголовка `Retry-After`. */
  retryAfterSec?: number
  /** Дополнительные поля тела ответа рядом с `error` и `detail`. */
  extra?: Record<string, unknown>
}

export class HttpError extends Error {
  readonly status: number
  readonly code: string
  readonly retryAfterSec: number | null
  readonly extra: Record<string, unknown>

  constructor(status: number, code: string, detailOrOptions?: string | HttpErrorOptions) {
    const options = typeof detailOrOptions === 'string' ? { detail: detailOrOptions } : (detailOrOptions ?? {})
    super(options.detail ?? code)
    this.status = status
    this.code = code
    this.retryAfterSec = options.retryAfterSec ?? null
    this.extra = options.extra ?? {}
  }
}

const TYPES: ReadonlySet<string> = new Set<ChunkType>(['travel', 'quest'])

export function parseLocale(value: unknown): Locale {
  if (value === undefined || value === null || value === '') return 'ru'
  if (typeof value === 'string' && (LOCALES as readonly string[]).includes(value)) return value as Locale
  throw new HttpError(400, 'bad_request', `locale: ожидалось одно из ${LOCALES.join(', ')}`)
}

export function parseType(value: unknown, field = 'type'): ChunkType | undefined {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value === 'string' && TYPES.has(value)) return value as ChunkType
  throw new HttpError(400, 'bad_request', `${field}: ожидалось travel или quest`)
}

export function parseLimit(value: unknown, fallback: number): number {
  if (value === undefined || value === null || value === '') return fallback
  const limit = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new HttpError(400, 'bad_request', `limit: целое от 1 до ${MAX_LIMIT}`)
  }
  return limit
}

export function parseQuery(value: unknown, field = 'q'): string {
  if (typeof value !== 'string') throw new HttpError(400, 'bad_request', `${field}: обязательная строка`)
  const q = value.replace(/\s+/g, ' ').trim()
  if (!q) throw new HttpError(400, 'bad_request', `${field}: пустой запрос`)
  if (q.length > MAX_QUERY_CHARS) throw new HttpError(400, 'bad_request', `${field}: не длиннее ${MAX_QUERY_CHARS} символов`)
  return q
}
