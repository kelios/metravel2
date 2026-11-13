/** Pure wire policy shared by AI forms, synchronous normalizers and the service. No feature imports. */

/**
 * Помощник автора в визарде статьи (#2885): `POST /ai/author-draft`.
 * `trip` (#2911) — черновик описания поездки планировщика по точкам, датам и транспорту.
 */
export const AI_AUTHOR_DRAFT_KINDS = ['title', 'lead', 'meta', 'trip'] as const
export type AiAuthorDraftKind = (typeof AI_AUTHOR_DRAFT_KINDS)[number]
/** Запросов в сутки на IP на эндпоинт — отдельный счётчик от вопросов ассистента. */
export const AI_AUTHOR_DRAFT_DAILY_LIMIT = 5
/** Короче — серверу нечего пересказывать: `400 bad_request`. */
export const AI_AUTHOR_DRAFT_MIN_TEXT_CHARS = 200
/**
 * План поездки (#2911) — не статья: две точки, даты и транспорт умещаются в полсотни
 * знаков, поэтому у `kind: 'trip'` свой порог; тот же порог включает кнопку на клиенте.
 */
export const AI_AUTHOR_DRAFT_TRIP_MIN_TEXT_CHARS = 40
export const AI_AUTHOR_DRAFT_MIN_TEXT_CHARS_BY_KIND: Readonly<Record<AiAuthorDraftKind, number>> = {
  title: AI_AUTHOR_DRAFT_MIN_TEXT_CHARS,
  lead: AI_AUTHOR_DRAFT_MIN_TEXT_CHARS,
  meta: AI_AUTHOR_DRAFT_MIN_TEXT_CHARS,
  trip: AI_AUTHOR_DRAFT_TRIP_MIN_TEXT_CHARS,
}
/** Панель визарда включает кнопки только от этой длины текста описания. */
export const AI_AUTHOR_DRAFT_PANEL_MIN_TEXT_CHARS = 1000
/** Хвост длиннее обрезается клиентом и сервером одинаково: контекст модели и тело запроса конечны. */
export const AI_AUTHOR_DRAFT_MAX_TEXT_CHARS = 8000
/** Сколько вариантов просим и какой длины: мета — бюджет сниппета 160 знаков (`utils/seoText.js`). */
export const AI_AUTHOR_DRAFT_SHAPES: Record<AiAuthorDraftKind, { variants: number; maxChars: number; minChars: number; maxTokens: number }> = {
  title: { variants: 3, maxChars: 90, minChars: 8, maxTokens: 200 },
  lead: { variants: 3, maxChars: 420, minChars: 20, maxTokens: 700 },
  meta: { variants: 3, maxChars: 160, minChars: 20, maxTokens: 400 },
  // #2911: описание поездки для участников — 2–3 варианта до 600 знаков по точкам и датам.
  trip: { variants: 3, maxChars: 600, minChars: 40, maxTokens: 900 },
}

/** Подсказка словарных значений визарда по тексту описания (#2886): `POST /ai/suggest-tags`. */
export const AI_TAG_SUGGEST_FIELDS = ['countries', 'categories', 'transports', 'companions', 'over_nights_stay'] as const
export type AiTagSuggestField = (typeof AI_TAG_SUGGEST_FIELDS)[number]
/** Короче — 400: по паре фраз соседи по индексу случайны. Тот же порог включает хук на клиенте. */
export const AI_TAG_SUGGEST_MIN_TEXT_CHARS = 300
/** Хвост длиннее в эмбеддинг не идёт: модель всё равно режет по токенам, а CPU — один. */
export const AI_TAG_SUGGEST_MAX_TEXT_CHARS = 4000
/** Сколько ближайших статей голосует за значения. */
export const AI_TAG_SUGGEST_NEIGHBOURS = 10

/**
 * Строка «Опишите, что ищете» на карте (#2887): `POST /ai/intent` → JSON-фильтр по
 * схеме `scripts/ai-train/osm_filter_schema.json`. Запросов в сутки на IP — свой
 * счётчик (`AI_MAP_INTENT_DAILY_LIMIT` в окружении службы).
 */
export const AI_MAP_INTENT_DAILY_LIMIT = 30
/** Границы запроса: короче — не о чем спрашивать, длиннее — не описание места, а статья. */
export const AI_MAP_INTENT_MIN_QUERY_CHARS = 3
export const AI_MAP_INTENT_MAX_QUERY_CHARS = 300
