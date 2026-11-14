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
 *
 * Маршруты мира (#3357): у ответа появились внешние карточки — статьи Википедии и Wikivoyage. Внешний
 * адрес в тексте модели остаётся только при полном совпадении с адресом внешней карточки ЭТОГО ответа и
 * получает её название; любой другой внешний адрес вырезается, как раньше, и считается отдельно
 * (`removedWorld`). Адреса карточек сайта проверяются прежними правилами.
 */

import type { AiWorldTrail } from './trailFacts.ts'
import type { AiSource } from './types'

// Адрес в угловых скобках («[x](</quests/4>)») — тот же адрес: скобки в него не входят.
const MARKDOWN_LINK_RE = /\[([^\]]*)\]\(\s*<?([^\s)>]+)>?(?:\s+"[^"]*")?\s*\)/g
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

/**
 * Адрес ссылки — полный адрес карточки: с протоколом и тем же ключом. Хвост запроса и якорь, которые модель
 * могла дописать к настоящему адресу, остаются как есть — ключ их не учитывает.
 */
const isCardAddress = (url: string, card: AiSource): boolean => /^https?:\/\//i.test(url) && normalizeLinkKey(url) === normalizeLinkKey(card.url)

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
  /** Сколько из вырезанных адресов — внешние, не из внешних карточек ответа (#3357); входит в `removed`. */
  removedWorld: number
}

/** Внешняя карточка для стража: адрес статьи и название маршрута. */
export type WorldLinkSource = Pick<AiWorldTrail, 'url' | 'title'>

export type LinkGuardOptions = {
  markRemoved?: boolean
  /** Внешние карточки этого ответа (#3357); не заданы — любой внешний адрес вырезается. */
  worldSources?: readonly WorldLinkSource[]
}

/** Абсолютный адрес не на сайте. */
const isExternalUrl = (url: string): boolean => /^https?:\/\//i.test(url) && !/^https?:\/\/(?:www\.)?metravel\.by(?:[/:?#]|$)/i.test(url)

/**
 * Ключ внешнего адреса: полный адрес без протокола, `www`, запроса, якоря и знака в конце. Адрес статьи в
 * карточке записан с процентным кодированием («…/wiki/%D0%A2…»), модель пишет его буквами — сверяется
 * раскодированная форма.
 */
const worldLinkKey = (url: string): string => {
  // Сначала раскодирование, потом ключ: регистр приводится к раскодированной букве («%D0%A2» — заглавная), а
  // знак в конце срезается одинаково у «…_(path)» карточки и «…_%28path%29» в тексте.
  try {
    return normalizeLinkKey(decodeURI(url))
  } catch {
    return normalizeLinkKey(url)
  }
}

/** Заглушки сохранённых внешних ссылок: правила для голых адресов ниже их не трогают. */
const WORLD_LINK_OPEN = '\uE002'
const WORLD_LINK_CLOSE = '\uE003'
const WORLD_LINK_TOKEN_CHARS_RE = /[\uE002\uE003]/g

/**
 * Оставляет в тексте только адреса найденных карточек. Markdown-ссылка с чужим
 * адресом превращается в свою подпись; голый адрес исчезает. Исключение —
 * подпись ровно с названием карточки: модель переписывает транслит адреса
 * («doehat» вместо «doekhat», замер #2710), а название копирует точно, поэтому
 * такая ссылка получает адрес своей карточки и не считается вырезанной.
 */
export function enforceSourceLinks(rawText: string, sources: readonly AiSource[], options: LinkGuardOptions = {}): LinkGuardResult {
  const sourceByKey = buildSourceByLinkKey(sources)
  let removed = 0
  let relabeled = 0
  let removedWorld = 0
  // Внешняя карточка узнаётся только по полному адресу: путь без хоста («/wiki/…») её не называет.
  const worldByKey = new Map((options.worldSources ?? []).filter((card) => isExternalUrl(card.url)).map((card) => [worldLinkKey(card.url), card]))
  const worldOf = (url: string): WorldLinkSource | null => (isExternalUrl(url) ? (worldByKey.get(worldLinkKey(url)) ?? null) : null)
  const keptWorld: string[] = []
  const keepWorld = (card: WorldLinkSource): string => {
    // Скобки в адресе статьи («…/wiki/E1_(European_long_distance_path)») закрыли бы markdown-ссылку раньше
    // времени: экран (`AssistantAnswerText`) и страж содержания показали бы обрезанный адрес. Кодированная
    // скобка — тот же адрес статьи.
    const url = card.url.replace(/\(/g, '%28').replace(/\)/g, '%29')
    keptWorld.push(`[${toLinkLabel(card.title) || url}](${url})`)
    return `${WORLD_LINK_OPEN}${keptWorld.length - 1}${WORLD_LINK_CLOSE}`
  }
  const countRemoved = (url: string): void => {
    removed += 1
    if (isExternalUrl(url)) removedWorld += 1
  }
  const isAllowed = (candidate: string): boolean => {
    const key = normalizeLinkKey(candidate)
    return key.length > 0 && sourceByKey.has(key)
  }

  const urlByTitle = new Map(sources.map((source) => [normalizeTitleKey(source.title), source.url]))

  // Знаки заглушек в тексте модели снимаются: заглушку ставит только страж.
  let text = stripThinking(rawText).replace(WORLD_LINK_TOKEN_CHARS_RE, '')
  text = text.replace(MARKDOWN_LINK_RE, (match, label: string, url: string) => {
    const card = sourceByKey.get(normalizeLinkKey(url))
    if (card) {
      // Адрес настоящий — подпись обязана быть названием его карточки (#3291), а сам адрес — адресом карточки
      // (#3369): модель пишет его путём («/quests/4/minsk-cmok») или без протокола («metravel.by/quests/…»),
      // экран (`AssistantAnswerText`) узнаёт ссылкой только `[…](https://…)` и показал бы такую разметкой.
      const title = toLinkLabel(card.title)
      const address = isCardAddress(url, card) ? url : card.url
      // Ссылка пишется заново и при верных подписи и адресе: угловые скобки («(<https://…>)») и подсказка
      // в кавычках экран тоже не узнаёт.
      if (!title || isSameTitle(label, card.title)) return `[${label}](${address})`
      relabeled += 1
      return `[${title}](${address})`
    }
    const cardUrl = urlByTitle.get(normalizeTitleKey(label))
    if (cardUrl) return `[${label}](${cardUrl})`
    // Внешняя карточка этого ответа (#3357): ссылка остаётся с названием маршрута и адресом карточки.
    const world = worldOf(url)
    if (world) {
      if (!isSameTitle(label, world.title)) relabeled += 1
      return keepWorld(world)
    }
    countRemoved(url)
    return options.markRemoved ? `${label}${REMOVED_LINK_MARK}` : label
  })
  // Голый адрес сайта, которого нет в карточках, — выдуманный материал («Выезд в Польшу… — metravel.by/travels/…»):
  // он тоже оставляет метку. Внешний адрес (не metravel.by) исчезает без неё, как раньше.
  const dropUnlessAllowed = (onSite: (match: string) => boolean) => (match: string): string => {
    if (isAllowed(match)) return match
    // Голый адрес внешней карточки становится ссылкой с её названием; знак за адресом остаётся в тексте.
    const url = match.replace(TRAILING_PUNCTUATION_RE, '')
    const world = worldOf(url)
    if (world) return `${keepWorld(world)}${match.slice(url.length)}`
    countRemoved(match)
    return options.markRemoved && onSite(match) ? REMOVED_LINK_MARK : ''
  }
  text = text.replace(ABSOLUTE_URL_RE, dropUnlessAllowed((match) => /^https?:\/\/(?:www\.)?metravel\.by(?:\/|$)/i.test(match)))
  text = text.replace(BARE_SITE_URL_RE, dropUnlessAllowed(() => true))
  text = text.replace(SITE_PATH_RE, dropUnlessAllowed(() => true))

  const tidy = tidyText(text).replace(new RegExp(`${WORLD_LINK_OPEN}(\\d+)${WORLD_LINK_CLOSE}`, 'g'), (_token, index: string) => keptWorld[Number(index)] ?? '')
  return { text: tidy, removed, relabeled, removedWorld }
}

const BARE_LINK_RE = new RegExp(`${ABSOLUTE_URL_RE.source}|${BARE_SITE_URL_RE.source}|${SITE_PATH_RE.source}`, 'gi')
/** Подводка к адресу: двоеточие или тире перед ним («городской квест: https://…», «Начать — https://…»). */
const LINK_LEAD_SEPARATOR_RE = /(?:\s*[:—–]|\s+-)\s*$/
/** Подводка без своего содержания: короткая подпись без ссылки, вся фраза — «подпись: адрес». */
const MAX_LINK_LEAD_CHARS = 80

export type BareLinkResult = {
  text: string
  /** Голых адресов карточек заменено ссылкой с названием карточки. */
  named: number
  /** Голых адресов убрано: карточка уже названа ссылкой в этом ответе. */
  dropped: number
}

/**
 * Голый адрес карточки — не текст ответа (#3345). Экран показывает его самим адресом, и модель ставила
 * адрес на место пояснения: «[Квест](адрес) — городской квест: https://…», «Горад: https://…», «Почати:
 * https://…». Карточка в ответе называется одним способом — ссылкой с названием из каталога:
 *   - карточка ещё не названа — адрес становится ссылкой с её названием;
 *   - карточка уже названа ссылкой — адрес убирается вместе с разделителем перед ним; если вся фраза
 *     была подводкой к адресу («Начать: адрес»), уходит и она.
 * Вызывается после `enforceSourceLinks`: чужих адресов в тексте уже нет.
 */
export function nameBareSourceLinks(text: string, sources: readonly AiSource[]): BareLinkResult {
  const sourceByKey = buildSourceByLinkKey(sources)
  const spans: Array<[number, number]> = []
  const linked = new Set<AiSource>()
  for (const match of text.matchAll(MARKDOWN_LINK_RE)) {
    const start = match.index ?? 0
    spans.push([start, start + match[0].length])
    const card = sourceByKey.get(normalizeLinkKey(match[2]))
    if (card) linked.add(card)
  }
  let out = ''
  let last = 0
  let named = 0
  let dropped = 0
  for (const match of text.matchAll(BARE_LINK_RE)) {
    const start = match.index ?? 0
    if (start < last || spans.some(([from, to]) => start >= from && start < to)) continue
    const url = match[0].replace(TRAILING_PUNCTUATION_RE, '')
    const card = sourceByKey.get(normalizeLinkKey(url))
    if (!card) continue
    const tail = match[0].slice(url.length)
    out += text.slice(last, start)
    last = start + match[0].length
    if (!linked.has(card)) {
      linked.add(card)
      named += 1
      // Адрес ссылки — полный адрес карточки: экран (`AssistantAnswerText`) узнаёт ссылкой только `[…](https://…)`,
      // а голый адрес бывает без протокола («metravel.by/quests/4») или путём («/quests/4») — такая ссылка
      // показалась бы посетителю разметкой.
      out += `[${toLinkLabel(card.title) || url}](${card.url})${tail}`
      continue
    }
    dropped += 1
    // Фраза перед адресом: от начала строки или конца прошлого предложения.
    const lineStart = out.lastIndexOf('\n') + 1
    const line = out.slice(lineStart)
    const sentenceStart = Math.max(0, ...Array.from(line.matchAll(/[.!?…]\s+/g), (end) => (end.index ?? 0) + end[0].length))
    const lead = line.slice(sentenceStart)
    if (LINK_LEAD_SEPARATOR_RE.test(lead) && !lead.includes('](') && lead.length <= MAX_LINK_LEAD_CHARS) {
      out = out.slice(0, lineStart + sentenceStart).replace(/[ \t]+$/, '')
    } else {
      out = `${out.replace(LINK_LEAD_SEPARATOR_RE, '')}${tail}`
    }
  }
  return named + dropped ? { text: tidyText(out + text.slice(last)), named, dropped } : { text, named, dropped }
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
export const guardStreamingText = (full: string, sources: readonly AiSource[], worldSources?: readonly WorldLinkSource[]): LinkGuardResult => {
  const cut = Math.max(full.lastIndexOf(' '), full.lastIndexOf('\n'))
  const head = cut >= 0 ? full.slice(0, cut + 1) : ''
  const tail = cut >= 0 ? full.slice(cut + 1) : full
  const tailLooksLikeLink = /^(?:https?:|\/|www\.|metravel|\[|\()/i.test(tail)
  return enforceSourceLinks(tailLooksLikeLink ? head : full, sources, { worldSources })
}
