/**
 * Клиент `POST /ai/suggest-tags` службы metravel-assist (#2886): по тексту описания статьи
 * служба голосованием ближайших статей индекса предлагает id стран, категорий, транспорта,
 * компаньонов и ночёвок из словаря `/getFiltersTravel/`. Одна попытка, таймаут
 * `AI_TAG_SUGGESTIONS_TIMEOUT_MS`: при отказе блок «Предложено» в визарде просто не показывается.
 * id приходят числами, в форму визарда уходят строками (`TravelFormData.*: string[]`).
 * Модуль живёт только в отложенном чанке блока: без `EXPO_PUBLIC_AI_PICKS` его нет в сборке (#2738).
 */
import { AI_TAG_SUGGEST_FIELDS, AI_TAG_SUGGEST_MAX_TEXT_CHARS, type AiTagSuggestField } from '@/api/aiAssist/policy'
import { ApiError } from '@/api/clientErrors'
import { buildAiPicksUrl } from '@/utils/aiPicksConfig'
import { fetchWithTimeout } from '@/utils/fetchWithTimeout'

export const AI_TAG_SUGGESTIONS_TIMEOUT_MS = 4000

export type AiTagSuggestionValues = Record<AiTagSuggestField, string[]>

export interface AiTagSuggestions extends AiTagSuggestionValues {
  /** Средняя доля голосов у предложенных значений (0..1). */
  confidence: number
  /** Служба не дотянулась до каталога: списки пусты не по смыслу текста. */
  degraded: boolean
}

export const isEmptyTagSuggestions = (suggestions: AiTagSuggestionValues): boolean =>
  AI_TAG_SUGGEST_FIELDS.every((field) => suggestions[field].length === 0)

/** Текст для запроса: пробелы схлопнуты, хвост длиннее бюджета службы отброшен по слову. */
export const normalizeTagSuggestionText = (text: string, maxChars: number = AI_TAG_SUGGEST_MAX_TEXT_CHARS): string => {
  const normalized = String(text ?? '').replace(/\s+/g, ' ').trim()
  if (normalized.length <= maxChars) return normalized
  const head = normalized.slice(0, maxChars)
  const wordEnd = head.lastIndexOf(' ')
  return wordEnd > maxChars / 2 ? head.slice(0, wordEnd) : head
}

const toStringIds = (value: unknown): string[] => {
  if (!Array.isArray(value)) return []
  const out: string[] = []
  for (const raw of value) {
    const id = Number(raw)
    if (Number.isInteger(id) && id > 0 && !out.includes(String(id))) out.push(String(id))
  }
  return out
}

export function normalizeTagSuggestions(payload: unknown): AiTagSuggestions {
  const body = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {}
  const values = {} as AiTagSuggestionValues
  for (const field of AI_TAG_SUGGEST_FIELDS) values[field] = toStringIds(body[field])
  const confidence = typeof body.confidence === 'number' && Number.isFinite(body.confidence) ? Math.min(Math.max(body.confidence, 0), 1) : 0
  return { ...values, confidence, degraded: body.degraded === true }
}

export interface FetchAiTagSuggestionsParams {
  text: string
  locale: string
  /** Сигнал React Query: уход со страницы отменяет запрос. */
  signal?: AbortSignal
}

export async function fetchAiTagSuggestions({ text, locale, signal }: FetchAiTagSuggestionsParams): Promise<AiTagSuggestions> {
  const response = await fetchWithTimeout(
    buildAiPicksUrl('/suggest-tags'),
    {
      method: 'POST',
      signal,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: normalizeTagSuggestionText(text), locale }),
    },
    AI_TAG_SUGGESTIONS_TIMEOUT_MS,
  )
  if (!response.ok) throw new ApiError(response.status, `ai-tag-suggestions ${response.status}`)
  return normalizeTagSuggestions(await response.json())
}
