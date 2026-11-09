/**
 * Числа политики ассистента (#2460, #2711, #2713), общие для клиента и сервера.
 *
 * Клиент (`limits.ts`, AsyncStorage) показывает «осталось вопросов» и «не по теме
 * N из 3», сервер `/ai/ask` (`scripts/ai-assist/limits.ts`, redis) решает по тем
 * же числам — экран и сервер не расходятся. Модуль без импортов: его читает и
 * Node-сервис metravel-assist.
 */

/** Вопросов в сутки на устройство (клиент) и на IP (сервер). */
export const AI_ASK_DAILY_LIMIT = 20
/** Третий вопрос не по теме за календарный день закрывает ассистент до полуночи (решение владельца 25.10.2026). */
export const AI_OFFTOPIC_STRIKES_TO_BLOCK = 3
/** Карточек подбора в промпте. */
export const AI_SOURCES_LIMIT = 8
/** Карточек в промпте при закреплённой странице-источнике (#2897): проба 07.11.2026 на v4 — среди 8 карточек
 * «Сколько дней занимает поездка?» для статьи 816 модель отвечала по соседней статье; с тремя — по странице. */
export const AI_SOURCES_LIMIT_PINNED = 3
/**
 * Рекомендаций в ответе ассистента (#3216). Промпт просит не больше трёх, но при 4–6 карточках
 * одного города модель перечисляет все (замер 09.11.2026 на v4 и v6), поэтому генератор
 * останавливает стрим на следующей — остальные карточки посетитель видит в списке источников.
 */
export const AI_MAX_RECOMMENDATIONS = 3
/** День лимитов и блока на сервере — календарный по этой зоне (аудитория сайта), `AI_ASSIST_DAY_TZ` переопределяет. */
export const AI_ASK_DAY_TIME_ZONE = 'Europe/Minsk'

const SECONDS_PER_DAY = 86_400

/**
 * Секунд до конца календарного дня в зоне сервера — срок, на который экран держит
 * «лимит исчерпан», когда сервер сообщил `remaining: 0` без `Retry-After` (#2884).
 * Без поддержки зоны в `Intl` (старый Hermes) — полночь по часам устройства.
 */
export const secondsToDayEnd = (now: Date = new Date(), timeZone: string = AI_ASK_DAY_TIME_ZONE): number => {
  let hour = now.getHours()
  let minute = now.getMinutes()
  let second = now.getSeconds()
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(now)
    const read = (type: string) => Number(parts.find((part) => part.type === type)?.value)
    const [h, m, s] = [read('hour'), read('minute'), read('second')]
    if ([h, m, s].every(Number.isFinite)) [hour, minute, second] = [h % 24, m, s]
  } catch {
    // Зона недоступна — остаёмся на локальном времени.
  }
  return Math.max(1, SECONDS_PER_DAY - (hour * 3600 + minute * 60 + second))
}

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
