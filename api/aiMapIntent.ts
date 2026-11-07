/**
 * Клиент `POST /ai/intent` службы metravel-assist (#2887): описание того, что ищет
 * посетитель, → JSON-фильтр карты `{categories, radius_km, center, constraints}`.
 * Одна попытка без ретраев, бюджет `AI_MAP_INTENT_TIMEOUT_MS`: модель отвечает
 * коротким JSON, но на одном vCPU первый токен приходит не сразу.
 * Отказы службы — `AiMapIntentError` с видом, по которому панель выбирает подсказку.
 */
import { AI_MAP_INTENT_MAX_QUERY_CHARS, AI_MAP_INTENT_MIN_QUERY_CHARS } from '@/api/aiAssist/policy'
import { buildAiPicksUrl } from '@/utils/aiPicksConfig'
import { fetchWithTimeout } from '@/utils/fetchWithTimeout'
import { type MapIntent, normalizeMapIntent } from '@/utils/mapIntent'

export const AI_MAP_INTENT_TIMEOUT_MS = 8000
export { AI_MAP_INTENT_MAX_QUERY_CHARS, AI_MAP_INTENT_MIN_QUERY_CHARS }

/**
 * `invalid` — 422 (модель не дала фильтр по схеме) · `limit` — 429 `limit` ·
 * `unavailable` — 503, 429 `busy`, таймаут, сеть, кривое тело · `bad_request` — 400.
 */
export type AiMapIntentErrorKind = 'invalid' | 'limit' | 'unavailable' | 'bad_request'

export class AiMapIntentError extends Error {
  readonly kind: AiMapIntentErrorKind
  readonly status: number | null

  constructor(kind: AiMapIntentErrorKind, status: number | null, message?: string) {
    super(message ?? `ai-intent ${kind}`)
    this.name = 'AiMapIntentError'
    this.kind = kind
    this.status = status
  }
}

export const isAiMapIntentError = (error: unknown): error is AiMapIntentError => error instanceof AiMapIntentError

/** Запрос как его примет служба: пробелы схлопнуты, хвост за максимумом отброшен. */
export const normalizeMapIntentQuery = (value: string): string =>
  value.replace(/\s+/g, ' ').trim().slice(0, AI_MAP_INTENT_MAX_QUERY_CHARS)

async function errorKindOf(response: Response): Promise<AiMapIntentErrorKind> {
  if (response.status === 422) return 'invalid'
  if (response.status === 400) return 'bad_request'
  if (response.status === 429) {
    try {
      const body = (await response.json()) as { error?: unknown }
      return body?.error === 'limit' ? 'limit' : 'unavailable'
    } catch {
      return 'unavailable'
    }
  }
  return 'unavailable'
}

export async function fetchMapIntent(q: string, locale: string, signal?: AbortSignal): Promise<MapIntent> {
  const query = normalizeMapIntentQuery(q)
  if (query.length < AI_MAP_INTENT_MIN_QUERY_CHARS) throw new AiMapIntentError('bad_request', null)
  let response: Response
  try {
    response = await fetchWithTimeout(
      buildAiPicksUrl('/intent'),
      { method: 'POST', signal, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ q: query, locale }) },
      AI_MAP_INTENT_TIMEOUT_MS,
    )
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error
    throw new AiMapIntentError('unavailable', null, error instanceof Error ? error.message : String(error))
  }
  if (!response.ok) throw new AiMapIntentError(await errorKindOf(response), response.status)
  let body: unknown
  try {
    body = await response.json()
  } catch {
    throw new AiMapIntentError('unavailable', response.status, 'ai-intent: тело ответа — не JSON')
  }
  const intent = normalizeMapIntent(body)
  if (!intent) throw new AiMapIntentError('invalid', response.status, 'ai-intent: ответ без категорий карты')
  return intent
}
