// Язык контента квестов (#2197, openspec `add-quest-content-localization`, D5).
// Квест запрашивается на языке интерфейса; что пришло на самом деле, говорит
// `content_locale` ответа. Ответ без поля (старый бэкенд, офлайн-копия до
// переводов) — русский источник.
import { getActiveLocale } from '@/i18n'

export const QUEST_SOURCE_LOCALE = 'ru'

/** Единственный резолвер локали, на которой читаются квесты. */
export const getQuestContentLocale = (): string => getActiveLocale()

/** Путь чтения квестов с `lang`: каждое чтение каталога и бандла идёт через него. */
export function withQuestLang(path: string, locale: string): string {
  return `${path}${path.includes('?') ? '&' : '?'}lang=${encodeURIComponent(locale)}`
}

/** `content_locale` ответа; отсутствие и мусор — `ru`. */
export function readQuestContentLocale(raw: unknown): string {
  return typeof raw === 'string' && raw.trim() ? raw.trim().toLowerCase() : QUEST_SOURCE_LOCALE
}

/** `served_locales` ответа (#3349); без поля — ни одной отдаваемой страницы (fail-closed). */
export function readQuestServedLocales(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : []
}

/** `available_locales` ответа; без поля квест доступен только на языке контента. */
export function readQuestAvailableLocales(raw: unknown, contentLocale: string): string[] {
  const locales = Array.isArray(raw)
    ? raw.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : []
  return locales.length ? locales : [contentLocale]
}
