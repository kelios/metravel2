/**
 * Ключ ссылки и карточка по ключу (#2460) — общие для экрана (какая ссылка ответа ведёт на карточку,
 * `AssistantAnswerText`, `answerSources`) и стража ссылок службы (`scripts/ai-assist/linkGuard.ts`). Модуль без
 * `@/`-импортов. Отдельный файл, чтобы экран не тянул в сборку сам страж (#3297).
 */

import type { AiSource } from './types'

export const TRAILING_PUNCTUATION_RE = /[.,;:!?…»"')\]]+$/

export const normalizeLinkKey = (value: string): string =>
  String(value ?? '')
    .trim()
    .replace(TRAILING_PUNCTUATION_RE, '')
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/[?#].*$/, '')
    .replace(/\/+$/, '')

const siteHostKey = (url: string): string => normalizeLinkKey(url).split('/')[0]

/** Ключи, которыми ответ может назвать карточку: её URL, тот же путь без хоста и путь приложения. */
const linkKeysOf = (source: AiSource): string[] => {
  const full = normalizeLinkKey(source.url)
  if (!full) return []
  const path = full.slice(siteHostKey(source.url).length)
  return [full, ...(path ? [path] : []), ...(source.path ? [normalizeLinkKey(source.path)] : [])]
}

/** Карточка по ключу ссылки; при совпадении ключей остаётся карточка, стоящая в подборе раньше. */
export const buildSourceByLinkKey = <T extends AiSource>(sources: readonly T[]): Map<string, T> => {
  const byKey = new Map<string, T>()
  for (const source of sources) for (const key of linkKeysOf(source)) if (!byKey.has(key)) byKey.set(key, source)
  return byKey
}
