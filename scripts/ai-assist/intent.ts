/**
 * POST /ai/intent (#2887): строка «Опишите, что ищете» на карте → фильтр карты.
 * Вопрос посетителя → `metravel-llm` с промптом набора `osm_intents`
 * (`INTENT_PROMPT` из `scripts/ai-train/sets/osm_intents.py`, система — как у
 * ассистента) → из ответа вырезается первый JSON-объект → валидатор схемы
 * (`osmFilterSchema.ts`) → `{categories, radius_km, center, constraints}`.
 *
 *   {q, locale?} → 200 {categories, radius_km, center, constraints}
 *   400 bad_request — `q` короче AI_MAP_INTENT_MIN_QUERY_CHARS или длиннее
 *     AI_MAP_INTENT_MAX_QUERY_CHARS, кривая `locale`
 *   422 invalid_intent — модель ответила без JSON или объектом не по схеме
 *     (`detail` — ошибки валидатора); запрос в квоту возвращается
 *   429 limit — AI_MAP_INTENT_DAILY_LIMIT запросов в сутки на IP, счётчик — тот же
 *     `AskLimits` с префиксом `ai-intent:v1` · 429 busy — очередь к модели
 *   503 generator_unavailable — `AI_LLM_URL` не задан или модель не ответила
 */
import { AI_MAP_INTENT_MAX_QUERY_CHARS, AI_MAP_INTENT_MIN_QUERY_CHARS } from '../../api/aiAssist/policy.ts'
import { ASSISTANT_SYSTEM_PROMPT } from '../../api/aiAssist/prompt.ts'
import type { AiChatMessage } from '../../api/aiAssist/types.ts'
import { extractJsonObject, type OsmFilterIntent, toOsmFilterIntent, validateOsmFilter } from './osmFilterSchema.ts'
import { HttpError, parseLocale } from './params.ts'
import { createQuotaGenerationHandler, type QuotaGenerationDeps, type QuotaGenerationHandler } from './quotaGeneration.ts'

export const INTENT_LIMITS_PREFIX = 'ai-intent:v1'
/** Ответ — один короткий JSON; с запасом на ограду ```json``` и имя центра. */
export const INTENT_MAX_TOKENS = 160

/** Счётчик `limits` — с префиксом `INTENT_LIMITS_PREFIX`. */
export type IntentDeps = QuotaGenerationDeps

/** `null` — посетитель закрыл соединение до ответа: отвечать некому, запрос возвращён в квоту. */
export type IntentHandler = QuotaGenerationHandler<OsmFilterIntent>

/** Копия `INTENT_PROMPT` из `scripts/ai-train/sets/osm_intents.py` — менять синхронно с набором. */
export const buildIntentPrompt = (q: string): string =>
  'Составь фильтр карты metravel.by в JSON по схеме {categories, radius_km, center, constraints} ' +
  '(categories из attractions, culture, viewpoints, entertainment, religion, history; radius_km из 10, 25, 50, 100, 200; ' +
  `center — {"name": ...} или null; constraints — dogs, camper, kids, free) для запроса:\n«${q}»`

export function buildIntentMessages(q: string): AiChatMessage[] {
  return [
    { role: 'system', content: ASSISTANT_SYSTEM_PROMPT },
    { role: 'user', content: buildIntentPrompt(q) },
  ]
}

/** Запрос посетителя: пробелы схлопнуты, длина в пределах политики. */
export function parseIntentQuery(value: unknown): string {
  if (typeof value !== 'string') throw new HttpError(400, 'bad_request', 'q: обязательная строка')
  const q = value.replace(/\s+/g, ' ').trim()
  if (q.length < AI_MAP_INTENT_MIN_QUERY_CHARS) throw new HttpError(400, 'bad_request', `q: не короче ${AI_MAP_INTENT_MIN_QUERY_CHARS} символов`)
  if (q.length > AI_MAP_INTENT_MAX_QUERY_CHARS) throw new HttpError(400, 'bad_request', `q: не длиннее ${AI_MAP_INTENT_MAX_QUERY_CHARS} символов`)
  return q
}

/** Ответ модели → фильтр по схеме; `null` — JSON не найден или не по схеме (`errors` — почему). */
export function parseIntentAnswer(text: string): { intent: OsmFilterIntent | null; errors: string[] } {
  const parsed = extractJsonObject(text)
  if (parsed === null) return { intent: null, errors: ['no JSON object in answer'] }
  const errors = validateOsmFilter(parsed)
  if (errors.length) return { intent: null, errors }
  return { intent: toOsmFilterIntent(parsed as Record<string, unknown>), errors: [] }
}

export function createIntentHandler(deps: IntentDeps): IntentHandler {
  return createQuotaGenerationHandler(deps, {
    route: 'POST /ai/intent',
    limitNoun: 'запросов фильтра карты',
    parse: (input) => {
      const q = parseIntentQuery(input.q)
      parseLocale(input.locale)
      return q
    },
    messages: buildIntentMessages,
    maxTokens: () => INTENT_MAX_TOKENS,
    result: (answer) => {
      const { intent, errors } = parseIntentAnswer(answer)
      if (!intent) throw new HttpError(422, 'invalid_intent', { detail: errors.join('; ') })
      return intent
    },
  })
}
