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
 * больше `limit`. Квест лежит в индексе на нескольких локалях с разными URL, поэтому
 * дубль ищется по `type:source_id`, а не по адресу.
 */
export const pinSourceFirst = (pinned: AiSource | null | undefined, sources: readonly AiSource[], limit: number): AiSource[] => {
  if (!pinned) return sources.slice(0, limit)
  const key = sourceKeyOf(pinned)
  return [pinned, ...sources.filter((source) => sourceKeyOf(source) !== key)].slice(0, limit)
}
