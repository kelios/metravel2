/**
 * Нарезка контента в фрагменты индекса: HTML → текст → предложения → окна ~800 символов
 * с перекрытием ~100 символов по границам предложений; метаданные источника в каждой записи.
 */
import { QUEST_LOCALES, buildQuestLocalePath } from '../../utils/questLocaleRouting.js'
import { chunkId, type ChunkRecord } from './format.ts'

export const SITE_ORIGIN = 'https://metravel.by'

export interface ChunkOptions {
  size?: number
  overlap?: number
}

export const DEFAULT_CHUNK_SIZE = 800
export const DEFAULT_CHUNK_OVERLAP = 100

export interface RawTravelCoord {
  lat?: number | string | null
  lng?: number | string | null
}

/** Урезанный ответ GET /api/travels/<id>/ (поля, которые хранит export). */
export interface RawTravel {
  id: number
  slug: string
  title?: string | null
  name?: string | null
  meta_description?: string | null
  description?: string | null
  plus?: string | null
  minus?: string | null
  recommendation?: string | null
  countryName?: string | null
  cityName?: string | null
  coordsMeTravel?: RawTravelCoord[] | null
  categories?: Array<number | string> | null
  month?: Array<number | string> | null
  year?: number | string | null
  publish?: boolean | null
  moderation?: boolean | null
  updated_at?: string | null
  travel_image_thumb_url?: string | null
}

export interface RawQuestStep {
  title?: string | null
  location?: string | null
  story?: string | null
  task?: string | null
  hint?: string | null
}

/** Урезанный ответ GET /api/quests/<id>/?lang=<locale> плюс поля карточки из списка. */
export interface RawQuest {
  id: number
  quest_id?: string | null
  title?: string | null
  content_locale?: string | null
  city?: { id?: number | null; name?: string | null } | null
  city_name?: string | null
  country_name?: string | null
  lat?: number | string | null
  lng?: number | string | null
  tags?: Record<string, boolean> | string[] | null
  cover_url?: string | null
  intro?: { title?: string | null; story?: string | null; task?: string | null } | null
  steps?: RawQuestStep[] | null
  finale_text?: string | null
}

const NAMED_ENTITIES: Record<string, string> = {
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  laquo: '«',
  raquo: '»',
  mdash: '—',
  ndash: '–',
  hellip: '…',
  copy: '©',
  deg: '°',
  rsquo: '’',
  lsquo: '‘',
  ldquo: '“',
  rdquo: '”',
  bdquo: '„',
  times: '×',
  middot: '·',
}

export function decodeEntities(input: string): string {
  return input.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, body: string) => {
    const lower = body.toLowerCase()
    if (lower.startsWith('#')) {
      const code = lower.startsWith('#x') ? Number.parseInt(lower.slice(2), 16) : Number.parseInt(lower.slice(1), 10)
      // Битая ссылка вида &#99999999; не должна ронять нарезку всего корпуса (RangeError).
      return code <= 0x10ffff ? String.fromCodePoint(code) : match
    }
    return NAMED_ENTITIES[lower] ?? match
  })
}

const DROP_BLOCKS = /<(script|style|iframe|svg|noscript|video|audio)\b[\s\S]*?<\/\1>/gi
const BLOCK_TAGS =
  /<\/?(p|div|li|ul|ol|h[1-6]|section|article|blockquote|details|summary|figure|figcaption|tr|table|thead|tbody|pre|hr|header|footer|aside|nav)\b[^>]*>/gi

/** HTML статьи → простой текст: блоки разделены переводом строки, пробелы схлопнуты. */
export function htmlToText(html: string | null | undefined): string {
  if (!html) return ''
  let text = html
    .replace(DROP_BLOCKS, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(BLOCK_TAGS, '\n')
    .replace(/<[^>]+>/g, ' ')
  text = decodeEntities(text)
  return text
    .split('\n')
    .map((line) => line.replace(/[ \t\r\f\v\u00a0\u200b]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
}

const SENTENCE_BOUNDARY = /(?<=[.!?…])\s+(?=[«"„([]?[\p{Lu}\d])/u

/** Делит абзац на предложения по знакам конца и заглавной букве/цифре следующего. */
export function splitSentences(paragraph: string): string[] {
  return paragraph
    .split(SENTENCE_BOUNDARY)
    .map((part) => part.trim())
    .filter(Boolean)
}

function hardSplit(sentence: string, size: number): string[] {
  if (sentence.length <= size) return [sentence]
  const pieces: string[] = []
  let rest = sentence
  while (rest.length > size) {
    let cut = rest.lastIndexOf(' ', size)
    if (cut < size / 2) cut = size
    pieces.push(rest.slice(0, cut).trim())
    rest = rest.slice(cut).trim()
  }
  if (rest) pieces.push(rest)
  return pieces
}

/**
 * Окна по предложениям: фрагмент не превышает `size` символов (если предложение короче `size`),
 * каждый следующий начинается с хвоста предыдущего длиной ≥ `overlap` символов (но не больше
 * половины окна), так что мысль на границе попадает в оба соседних фрагмента.
 */
export function chunkText(text: string, options: ChunkOptions = {}): string[] {
  const size = options.size ?? DEFAULT_CHUNK_SIZE
  const overlap = options.overlap ?? DEFAULT_CHUNK_OVERLAP
  const units: string[] = []
  for (const paragraph of text.split('\n')) {
    for (const sentence of splitSentences(paragraph)) units.push(...hardSplit(sentence, size))
  }
  const chunks: string[] = []
  let current: string[] = []
  let currentLength = 0
  for (const unit of units) {
    if (current.length && currentLength + 1 + unit.length > size) {
      chunks.push(current.join(' '))
      const carry: string[] = []
      let carryLength = 0
      for (let i = current.length - 1; i >= 0; i -= 1) {
        const candidate = current[i].length + (carry.length ? 1 : 0)
        // Хвост не должен выталкивать следующее окно за `size` вместе с новым предложением.
        if (carryLength >= overlap || carryLength + candidate > size / 2 || carryLength + candidate + 1 + unit.length > size) {
          break
        }
        carry.unshift(current[i])
        carryLength += candidate
      }
      current = carry
      currentLength = carryLength
    }
    currentLength += unit.length + (current.length ? 1 : 0)
    current.push(unit)
  }
  if (current.length) chunks.push(current.join(' '))
  return chunks
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const num = typeof value === 'number' ? value : Number.parseFloat(String(value))
  return Number.isFinite(num) ? num : null
}

function toMonths(value: RawTravel['month']): number[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => toNumber(item))
    .filter((item): item is number => item !== null && item >= 1 && item <= 12)
    .map((item) => Math.trunc(item))
}

/** Список/деталь статьи считается публичной только при publish && moderation. */
export function isPublishedTravel(item: { publish?: unknown; moderation?: unknown }): boolean {
  return item.publish === true && item.moderation === true
}

function uniqueByText(records: ChunkRecord[]): ChunkRecord[] {
  const seen = new Set<string>()
  return records.filter((record) => {
    if (seen.has(record.id)) return false
    seen.add(record.id)
    return true
  })
}

export interface TravelChunkContext {
  /** Имена категорий по id из словаря фильтров; без словаря tags = ['category:<id>']. */
  categoryNames?: Record<string, string>
}

export function travelText(raw: RawTravel): string {
  const sections: string[] = [htmlToText(raw.description)]
  const extras: Array<[string, string | null | undefined]> = [
    ['Плюсы', raw.plus],
    ['Минусы', raw.minus],
    ['Рекомендации', raw.recommendation],
  ]
  for (const [label, html] of extras) {
    const text = htmlToText(html)
    if (text) sections.push(`${label}:\n${text}`)
  }
  return sections.filter(Boolean).join('\n')
}

export function buildTravelChunks(
  raw: RawTravel,
  context: TravelChunkContext = {},
  options: ChunkOptions = {},
): ChunkRecord[] {
  const title = (raw.title || raw.name || '').trim()
  const coords = Array.isArray(raw.coordsMeTravel) ? raw.coordsMeTravel[0] : undefined
  const tags = (raw.categories ?? []).map((category) => {
    const key = String(category)
    return context.categoryNames?.[key] ?? `category:${key}`
  })
  const records = chunkText(travelText(raw), options).map((text) => ({
    id: chunkId('travel', raw.id, 'ru', text),
    type: 'travel' as const,
    source_id: raw.id,
    url: `${SITE_ORIGIN}/travels/${raw.slug}`,
    title,
    city: raw.cityName?.trim() || null,
    country: raw.countryName?.trim() || null,
    lat: toNumber(coords?.lat),
    lng: toNumber(coords?.lng),
    month: toMonths(raw.month),
    tags,
    locale: 'ru',
    text,
    cover: coverUrl(raw.travel_image_thumb_url),
  }))
  return uniqueByText(records)
}

/** Абсолютный http(s)-адрес обложки или null: карточки подбора не рисуют битые ссылки. */
export function coverUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return /^https?:\/\//.test(trimmed) ? trimmed : null
}

export function questText(raw: RawQuest): string {
  const parts: string[] = []
  if (raw.intro?.story) parts.push(htmlToText(raw.intro.story))
  for (const step of raw.steps ?? []) {
    const stepParts = [step.title, step.story, step.task].map((value) => htmlToText(value)).filter(Boolean)
    if (stepParts.length) parts.push(stepParts.join(' '))
  }
  if (raw.finale_text) parts.push(htmlToText(raw.finale_text))
  return parts.filter(Boolean).join('\n')
}

export function questTags(raw: RawQuest): string[] {
  if (Array.isArray(raw.tags)) return raw.tags.map(String)
  if (raw.tags && typeof raw.tags === 'object') {
    return Object.entries(raw.tags)
      .filter(([, enabled]) => enabled === true)
      .map(([tag]) => tag)
  }
  return []
}

/** Страница квеста в локали; неизвестная локаль → RU-путь, без city.id/slug → каталог /quests. */
export function questUrl(raw: RawQuest, locale: string): string {
  const cityId = raw.city?.id ?? null
  const routeLocale = (QUEST_LOCALES as readonly string[]).includes(locale) ? locale : 'ru'
  const localized =
    cityId !== null ? buildQuestLocalePath(cityId, raw.quest_id ?? '', routeLocale as (typeof QUEST_LOCALES)[number]) : null
  return `${SITE_ORIGIN}${localized ?? '/quests'}`
}

export function buildQuestChunks(raw: RawQuest, options: ChunkOptions = {}): ChunkRecord[] {
  const locale = raw.content_locale || 'ru'
  const title = (raw.title || '').trim()
  const records = chunkText(questText(raw), options).map((text) => ({
    id: chunkId('quest', raw.id, locale, text),
    type: 'quest' as const,
    source_id: raw.id,
    url: questUrl(raw, locale),
    title,
    city: raw.city?.name?.trim() || raw.city_name?.trim() || null,
    country: raw.country_name?.trim() || null,
    lat: toNumber(raw.lat),
    lng: toNumber(raw.lng),
    month: [],
    tags: questTags(raw),
    locale,
    text,
    cover: coverUrl(raw.cover_url),
  }))
  return uniqueByText(records)
}
