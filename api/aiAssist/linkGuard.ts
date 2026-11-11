/**
 * Страж ссылок ответа (#2460).
 *
 * Модель выдумывает адреса (оценка v0: 57 несуществующих URL в 40 ответах),
 * поэтому в показанный текст проходят только адреса найденных карточек. Любой
 * другой URL — внешний, выдуманный путь на metravel.by, относительный
 * `/travels/…` — вырезается, а счётчик вырезанного отдаётся экрану для подписи.
 * Служебные `<think>` блоки Qwen снимаются до показа.
 *
 * Подпись ссылки (#3291): адрес из карточки модель могла подписать чужим или выдуманным
 * названием («Минск в кадре: город, который играл Москву» у статьи о Смолевуде, проба
 * 11.11.2026, p14). Подпись разрешённого адреса заменяется названием его карточки, если они
 * расходятся. Пояснение пункта, числа и пустой ответ проверяет `answerGuard.ts`.
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

/** Разрешённые ключи: URL карточек и те же пути без хоста. */
export const buildAllowedLinkKeys = (sources: readonly AiSource[]): Set<string> => new Set(buildSourceByLinkKey(sources).keys())

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
export const tidyText = (text: string): string =>
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

/** Подпись совпадает с названием: выделение (`**…**`) и знак в конце подписи названия не меняют. */
export const isSameTitle = (label: string, title: string): boolean => {
  const key = (value: string) => normalizeTitleKey(String(value ?? '').replace(/[*_`]/g, '')).replace(/[.!?…:;,\s]+$/, '')
  return key(label) === key(title)
}

/** Название как подпись markdown-ссылки: квадратная скобка закрыла бы подпись раньше времени. */
const toLinkLabel = (title: string): string => String(title ?? '').replace(/\[/g, '(').replace(/\]/g, ')').replace(/\s+/g, ' ').trim()

/**
 * Метка на месте вырезанной markdown-ссылки (символ области частного использования, в ответах модели его
 * нет): по ней страж содержания убирает предложение или пункт списка, где назван материал не из
 * подсказки. Ставится только по просьбе вызывающего и до показа снимается.
 */
export const REMOVED_LINK_MARK = '\uE001'

export type LinkGuardResult = {
  text: string
  /** Сколько адресов вырезано как не из карточек. */
  removed: number
  /** Сколько подписей ссылок заменено названием карточки (#3291). */
  relabeled: number
}

/**
 * Оставляет в тексте только адреса найденных карточек. Markdown-ссылка с чужим
 * адресом превращается в свою подпись; голый адрес исчезает. Исключение —
 * подпись ровно с названием карточки: модель переписывает транслит адреса
 * («doehat» вместо «doekhat», замер #2710), а название копирует точно, поэтому
 * такая ссылка получает адрес своей карточки и не считается вырезанной.
 */
export function enforceSourceLinks(rawText: string, sources: readonly AiSource[], options: { markRemoved?: boolean } = {}): LinkGuardResult {
  const sourceByKey = buildSourceByLinkKey(sources)
  let removed = 0
  let relabeled = 0
  const isAllowed = (candidate: string): boolean => {
    const key = normalizeLinkKey(candidate)
    return key.length > 0 && sourceByKey.has(key)
  }

  const urlByTitle = new Map(sources.map((source) => [normalizeTitleKey(source.title), source.url]))

  let text = stripThinking(rawText)
  text = text.replace(MARKDOWN_LINK_RE, (match, label: string, _bracket: string, url: string) => {
    const card = sourceByKey.get(normalizeLinkKey(url))
    if (card) {
      // Адрес настоящий — подпись обязана быть названием его карточки (#3291).
      const title = toLinkLabel(card.title)
      if (!title || isSameTitle(label, card.title)) return match
      relabeled += 1
      return `[${title}](${url})`
    }
    const cardUrl = urlByTitle.get(normalizeTitleKey(label))
    if (cardUrl) return `[${label}](${cardUrl})`
    removed += 1
    return options.markRemoved ? `${label}${REMOVED_LINK_MARK}` : label
  })
  // Голый адрес сайта, которого нет в карточках, — выдуманный материал («Выезд в Польшу… — metravel.by/travels/…»):
  // он тоже оставляет метку. Внешний адрес (не metravel.by) исчезает без неё, как раньше.
  const dropUnlessAllowed = (onSite: (match: string) => boolean) => (match: string): string => {
    if (isAllowed(match)) return match
    removed += 1
    return options.markRemoved && onSite(match) ? REMOVED_LINK_MARK : ''
  }
  text = text.replace(ABSOLUTE_URL_RE, dropUnlessAllowed((match) => /^https?:\/\/(?:www\.)?metravel\.by(?:\/|$)/i.test(match)))
  text = text.replace(BARE_SITE_URL_RE, dropUnlessAllowed(() => true))
  text = text.replace(SITE_PATH_RE, dropUnlessAllowed(() => true))

  return { text: tidyText(text), removed, relabeled }
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
