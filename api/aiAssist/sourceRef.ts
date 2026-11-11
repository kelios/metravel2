/**
 * Контекстный вход в ассистента (#2897): страница статьи или квеста открывает
 * `/assistant?source=travel:816` (`quest:<id>`), и карточка этой страницы стоит
 * ПЕРВОЙ в списке карточек промпта на всех ходах диалога — подбор добавляет остальные.
 *
 * Модуль общий для экрана (`useAssistantChat`), клиента `ask` и сервера `/ai/ask`
 * (`scripts/ai-assist/ask.ts`), поэтому без `@/`-импортов: сервер собирается
 * `node --experimental-strip-types` без алиасов Metro. Формат параметра `type:id`
 * задаёт `utils/aiAssistantConfig.ts` (`buildAssistantSourceHref`) — страницы
 * строят ссылку оттуда, не подключая `api/aiAssist` в сборку без флага (#2738);
 * тест `sourceRef.test.ts` держит обе стороны в согласии.
 */

import type { AiSource, AiSourceType } from './types'
import { AI_PAGE_NEARBY_LIMIT, AI_SOURCES_LIMIT, AI_SOURCES_LIMIT_PINNED } from './policy.ts'
import { mentionsAnyPlace } from './promptPlace.ts'
import { namedPlaces } from './topicGate.ts'

/** Ссылка на материал сайта: `id` — числовой PK статьи или квеста (как в индексе и `/ai/similar`). */
export type AiSourceRef = {
  type: AiSourceType
  id: number
}

const SOURCE_PARAM_RE = /^(travel|quest):(\d{1,12})$/

const toRef = (type: unknown, id: unknown): AiSourceRef | null => {
  if (type !== 'travel' && type !== 'quest') return null
  const parsed = typeof id === 'number' ? id : Number.parseInt(String(id ?? ''), 10)
  if (!Number.isInteger(parsed) || parsed <= 0) return null
  return { type, id: parsed }
}

/**
 * Параметр роута (`travel:816`) или объект `{type, id}` тела `/ai/ask` → ссылка;
 * всё остальное — `null`. Массив параметров (повтор `?source=`) берёт первый.
 */
export const parseSourceRef = (value: unknown): AiSourceRef | null => {
  const single = Array.isArray(value) ? value[0] : value
  if (typeof single === 'string') {
    const match = SOURCE_PARAM_RE.exec(single.trim())
    return match ? toRef(match[1], match[2]) : null
  }
  if (single && typeof single === 'object') {
    const raw = single as { type?: unknown; id?: unknown }
    return toRef(raw.type, raw.id)
  }
  return null
}

/** `travel:816` — ключ источника в индексе и значение параметра роута. */
export const formatSourceRef = (ref: AiSourceRef): string => `${ref.type}:${ref.id}`

const sourceKeyOf = (source: Pick<AiSource, 'type' | 'source_id'>): string => `${source.type}:${source.source_id}`

/**
 * Карточка источника первой, подбор — следом без дубля той же карточки, всего не
 * больше `limit` (с закреплённой страницей — `AI_SOURCES_LIMIT_PINNED`, иначе `AI_SOURCES_LIMIT`). Квест лежит в индексе на нескольких локалях с разными URL, поэтому
 * дубль ищется по `type:source_id`, а не по адресу.
 */
export const pinSourceFirst = (
  pinned: AiSource | null | undefined,
  sources: readonly AiSource[],
  limit: number = pinned ? AI_SOURCES_LIMIT_PINNED : AI_SOURCES_LIMIT,
): AiSource[] => {
  if (!pinned) return sources.slice(0, limit)
  const key = sourceKeyOf(pinned)
  // Подбор нашёл ту же страницу — его фрагмент подобран под вопрос, он и идёт первым.
  const found = sources.find((source) => sourceKeyOf(source) === key)
  return [found ?? pinned, ...sources.filter((source) => sourceKeyOf(source) !== key)].slice(0, limit)
}

/**
 * Вопрос уводит со страницы (#3290): в нём названо место, которого нет ни в названии, ни в тексте
 * страницы — «а что в Гданьске?» со страницы статьи о Гродно. Такой вопрос идёт общим подбором, страница
 * остаётся первой карточкой. Место, которое на странице есть («парковка у ярмарки в Гданьске» в статье о
 * ярмарках Польши), режим страницы не снимает. Название места на другом письме («w Gdańsku» при русском
 * тексте) на странице не узнаётся — такой вопрос тоже уходит в общий подбор.
 */
export const leavesPage = (query: string, pageText: string): boolean => {
  const places = namedPlaces(query)
  return places.length > 0 && !mentionsAnyPlace(places, pageText)
}

/**
 * Источники хода, когда вопрос уводит со страницы (#3290, `leavesPage`): общий подбор как у обычного
 * вопроса, а карточка страницы — последней, группой `nearby`: посетитель видит её под ответом, в
 * подсказку модели она не идёт. Пока страница стояла в подсказке первой, модель называла её ответом на
 * вопрос о другом месте — «Вот главное в Гданьске: Гродно за 1 день…» (замер 11.11.2026: страница
 * первой — 3 верных ответа из 9, последней — 7, вне подсказки — 9). Страница, которую нашёл и подбор,
 * остаётся его карточкой на своём месте.
 */
export const leftPageSources = (page: AiSource, found: readonly AiSource[], limit: number = AI_SOURCES_LIMIT): AiSource[] => {
  const key = sourceKeyOf(page)
  const general = found.slice(0, Math.max(0, limit))
  return general.some((source) => sourceKeyOf(source) === key) ? general : [...general, { ...page, group: 'nearby' }]
}

/**
 * Источники хода в режиме страницы (#3290): карточка страницы — группа `page`, найденное общим
 * подбором — группа `nearby` (без самой страницы, не больше `limit`). В подсказку модели идёт только
 * страница (`selectPromptSources`), соседние материалы посетитель видит под ответом как «Ещё по теме».
 */
export const pageSources = (page: AiSource, found: readonly AiSource[], limit: number = AI_PAGE_NEARBY_LIMIT): AiSource[] => {
  const key = sourceKeyOf(page)
  const nearby = found.filter((source) => sourceKeyOf(source) !== key).slice(0, Math.max(0, limit))
  return [{ ...page, group: 'page' }, ...nearby.map((source): AiSource => ({ ...source, group: 'nearby' }))]
}

