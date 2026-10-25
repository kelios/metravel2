/**
 * Страж ссылок ответа (#2460).
 *
 * Модель выдумывает адреса (оценка v0: 57 несуществующих URL в 40 ответах),
 * поэтому в показанный текст проходят только адреса найденных карточек. Любой
 * другой URL — внешний, выдуманный путь на metravel.by, относительный
 * `/travels/…` — вырезается, а счётчик вырезанного отдаётся экрану для подписи.
 * Служебные `<think>` блоки Qwen снимаются до показа.
 */

import type { AiSource } from './types'

const MARKDOWN_LINK_RE = /\[([^\]]*)\]\(\s*(<?)([^\s)]+)\2(?:\s+"[^"]*")?\s*\)/g
const ABSOLUTE_URL_RE = /\bhttps?:\/\/[^\s<>()[\]"'«»]+/gi
// Голое «metravel.by» без пути — название сайта, а не ссылка: оно стоит во фразе отказа «не по теме»
// (#2711) и в обычной речи модели; режется только `metravel.by/<путь>`.
const BARE_SITE_URL_RE = /(?<![\w/.])(?:www\.)?metravel\.by\/[^\s<>()[\]"'«»]+/gi
const SITE_PATH_RE = /(?<![\w/:])\/(?:travels|quests|places|articles|map|search)(?:\/[^\s<>()[\]"'«»]*)?/gi
const TRAILING_PUNCTUATION_RE = /[.,;:!?…»"')\]]+$/

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

/** Разрешённые ключи: URL карточек и те же пути без хоста. */
export const buildAllowedLinkKeys = (sources: readonly AiSource[]): Set<string> => {
  const allowed = new Set<string>()
  for (const source of sources) {
    const full = normalizeLinkKey(source.url)
    if (!full) continue
    allowed.add(full)
    const host = siteHostKey(source.url)
    const path = full.slice(host.length)
    if (path) allowed.add(path)
    if (source.path) allowed.add(normalizeLinkKey(source.path))
  }
  return allowed
}

/** Срезает `<think>…</think>` (в том числе незакрытый блок в начале стрима). */
export const stripThinking = (text: string): string =>
  String(text ?? '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/^\s*<think>[\s\S]*$/i, '')
    .replace(/^\s*<\/think>/i, '')

/**
 * Следы вырезания и служебный мусор модели (замер #2710): пустые скобки, тире перед
 * вырезанной ссылкой в конце строки («Стартуйте с истории —»), заглушки обучения
 * вида `__draft_placeholder__`.
 */
const tidyText = (text: string): string =>
  text
    .replace(/__[a-z0-9]+(?:_[a-z0-9]+)+__/gi, '')
    .replace(/\(\s*\)/g, '')
    .replace(/[ \t]*[—–][ \t]*(?=\n|$)/g, '')
    .replace(/[ \t]+[—–][ \t]*([,.;:!?])/g, '$1')
    .replace(/[ \t]+([,.;:!?])/g, '$1')
    .replace(/(^|\n)\s*[-–—•]\s*(?=\n|$)/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

const normalizeTitleKey = (value: string): string =>
  String(value ?? '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[«»"'„“”]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

export type LinkGuardResult = {
  text: string
  /** Сколько адресов вырезано как не из карточек. */
  removed: number
}

/**
 * Оставляет в тексте только адреса найденных карточек. Markdown-ссылка с чужим
 * адресом превращается в свою подпись; голый адрес исчезает. Исключение —
 * подпись ровно с названием карточки: модель переписывает транслит адреса
 * («doehat» вместо «doekhat», замер #2710), а название копирует точно, поэтому
 * такая ссылка получает адрес своей карточки и не считается вырезанной.
 */
export function enforceSourceLinks(rawText: string, sources: readonly AiSource[]): LinkGuardResult {
  const allowed = buildAllowedLinkKeys(sources)
  let removed = 0
  const isAllowed = (candidate: string): boolean => {
    const key = normalizeLinkKey(candidate)
    return key.length > 0 && allowed.has(key)
  }

  const urlByTitle = new Map(sources.map((source) => [normalizeTitleKey(source.title), source.url]))

  let text = stripThinking(rawText)
  text = text.replace(MARKDOWN_LINK_RE, (match, label: string, _bracket: string, url: string) => {
    if (isAllowed(url)) return match
    const cardUrl = urlByTitle.get(normalizeTitleKey(label))
    if (cardUrl) return `[${label}](${cardUrl})`
    removed += 1
    return label
  })
  const dropUnlessAllowed = (match: string): string => {
    if (isAllowed(match)) return match
    removed += 1
    return ''
  }
  text = text.replace(ABSOLUTE_URL_RE, dropUnlessAllowed)
  text = text.replace(BARE_SITE_URL_RE, dropUnlessAllowed)
  text = text.replace(SITE_PATH_RE, dropUnlessAllowed)

  return { text: tidyText(text), removed }
}

/** Сколько адресов карточек осталось в ответе после стража: отказ модели «не по теме» ссылок не даёт. */
export const countKeptSourceLinks = (text: string, sources: readonly AiSource[]): number => {
  const allowed = buildAllowedLinkKeys(sources)
  const words = String(text ?? '').split(/[\s()[\]<>«»"']+/)
  return words.filter((word) => word && allowed.has(normalizeLinkKey(word))).length
}

/**
 * Текст для показа во время стрима: страж ссылок по готовой части, незаконченный
 * «хвост», похожий на адрес, придерживается до следующего фрагмента — иначе
 * допустимая ссылка мигает, пока модель её дописывает. Общий для экрана
 * `/assistant` и сервера `/ai/ask` (#2713).
 */
export const guardStreamingText = (full: string, sources: readonly AiSource[]): LinkGuardResult => {
  const cut = Math.max(full.lastIndexOf(' '), full.lastIndexOf('\n'))
  const head = cut >= 0 ? full.slice(0, cut + 1) : ''
  const tail = cut >= 0 ? full.slice(cut + 1) : full
  const tailLooksLikeLink = /^(?:https?:|\/|www\.|metravel|\[|\()/i.test(tail)
  return enforceSourceLinks(tailLooksLikeLink ? head : full, sources)
}
