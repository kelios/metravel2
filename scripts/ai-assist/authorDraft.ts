/**
 * POST /ai/author-draft (#2885): помощник автора в визарде статьи. Текст статьи →
 * `metravel-llm` → варианты заголовка, лида или SEO-описания только по этому тексту:
 * без выдуманных фактов, без ссылок (страж `api/aiAssist/linkGuard.ts` с пустым
 * списком карточек режет любой адрес), в пределах длины `AI_AUTHOR_DRAFT_SHAPES`.
 *
 *   {text, kind: title|lead|meta|trip, locale?} → 200 {variants: string[], remaining}
 *   400 bad_request — текст короче порога вида (`AI_AUTHOR_DRAFT_MIN_TEXT_CHARS_BY_KIND`:
 *     статья — 200 знаков, план поездки `trip` (#2911) — 40) или неизвестный kind
 *   429 limit — AI_AUTHOR_DRAFT_DAILY_LIMIT запросов в сутки на IP на эндпоинт
 *     (`Retry-After` до полуночи Europe/Minsk), счётчик — тот же `AskLimits` с
 *     префиксом `ai-author-draft:v1` · 429 busy — очередь к модели
 *   503 generator_unavailable — `AI_LLM_URL` не задан, модель не ответила или не дала
 *     ни одного пригодного варианта. Неудачный запрос лимит не тратит.
 */
import { enforceSourceLinks } from '../../api/aiAssist/linkGuard.ts'
import {
  AI_AUTHOR_DRAFT_KINDS,
  AI_AUTHOR_DRAFT_MAX_TEXT_CHARS,
  AI_AUTHOR_DRAFT_MIN_TEXT_CHARS,
  AI_AUTHOR_DRAFT_MIN_TEXT_CHARS_BY_KIND,
  AI_AUTHOR_DRAFT_SHAPES,
  type AiAuthorDraftKind,
} from '../../api/aiAssist/policy.ts'
import type { AiChatMessage } from '../../api/aiAssist/types.ts'
import { GENERATOR_RETRY_AFTER_SEC } from './ask.ts'
import { HttpError, parseLocale } from './params.ts'
import { createQuotaGenerationHandler, type QuotaGenerationDeps, type QuotaGenerationHandler } from './quotaGeneration.ts'
import type { Locale } from './search.ts'

/** Тело запроса шире, чем у `/ai/ask`: текст статьи до AI_AUTHOR_DRAFT_MAX_TEXT_CHARS кириллицей. */
export const AUTHOR_DRAFT_MAX_BODY_BYTES = 64 * 1024
export const AUTHOR_DRAFT_LIMITS_PREFIX = 'ai-author-draft:v1'

/** Счётчик `limits` — с префиксом `AUTHOR_DRAFT_LIMITS_PREFIX`. */
export type AuthorDraftDeps = QuotaGenerationDeps

export interface AuthorDraftResponse {
  variants: string[]
  remaining: number
}

/** `null` — посетитель закрыл соединение до ответа: отвечать некому, запрос возвращён в квоту. */
export type AuthorDraftHandler = QuotaGenerationHandler<AuthorDraftResponse>

const LANGUAGE_NAMES: Record<Locale, string> = {
  ru: 'русский',
  be: 'беларуская',
  uk: 'українська',
  pl: 'polski',
  en: 'English',
}

const TASKS: Record<AiAuthorDraftKind, string> = {
  title:
    'предложи 3 варианта заголовка статьи: до 70 знаков, конкретно и по-человечески, без кликбейта и восклицаний, ' +
    'с местом поездки, если оно названо в тексте',
  lead:
    'предложи 3 варианта лида — первого абзаца статьи из 2–3 предложений: о чём поездка и для кого она, ' +
    'в голосе автора, без общих фраз и без пересказа всего маршрута',
  meta:
    'предложи 3 варианта SEO-описания страницы: одно-два предложения до 160 знаков, с местом и сутью поездки, ' +
    'без призывов «читайте» и без слова «статья»',
  // #2911: план поездки планировщика — точки по порядку, даты, транспорт; описание для участников.
  trip:
    'предложи 2–3 варианта описания поездки для её участников: 2–4 предложения до 600 знаков, ' +
    'куда едем и в каком порядке, когда и на чём, — только по точкам, датам и транспорту из плана',
}

/** Что именно получает модель: статья автора или план поездки (#2911). */
const SOURCE_NAMES: Record<AiAuthorDraftKind, { system: string; user: string }> = {
  title: { system: 'текст статьи автора', user: 'Текст статьи' },
  lead: { system: 'текст статьи автора', user: 'Текст статьи' },
  meta: { system: 'текст статьи автора', user: 'Текст статьи' },
  trip: { system: 'план поездки: точки маршрута по порядку, даты и транспорт', user: 'План поездки' },
}

export function parseAuthorDraftKind(value: unknown): AiAuthorDraftKind {
  if (typeof value === 'string' && (AI_AUTHOR_DRAFT_KINDS as readonly string[]).includes(value)) return value as AiAuthorDraftKind
  throw new HttpError(400, 'bad_request', `kind: ожидалось одно из ${AI_AUTHOR_DRAFT_KINDS.join(', ')}`)
}

/** Текст статьи или плана: пробелы схлопнуты, не короче минимума вида, хвост длиннее максимума отброшен. */
export function parseAuthorDraftText(value: unknown, minChars: number = AI_AUTHOR_DRAFT_MIN_TEXT_CHARS): string {
  if (typeof value !== 'string') throw new HttpError(400, 'bad_request', 'text: обязательная строка')
  const text = value.replace(/\s+/g, ' ').trim()
  if (text.length < minChars) {
    throw new HttpError(400, 'bad_request', `text: не короче ${minChars} символов`)
  }
  return text.length > AI_AUTHOR_DRAFT_MAX_TEXT_CHARS ? text.slice(0, AI_AUTHOR_DRAFT_MAX_TEXT_CHARS) : text
}

export function buildAuthorDraftMessages(kind: AiAuthorDraftKind, locale: Locale, text: string): AiChatMessage[] {
  const system =
    'Ты редактор сайта metravel.by — живых рассказов о путешествиях по Беларуси и соседним странам. ' +
    `Тебе дан ${SOURCE_NAMES[kind].system}. Задача: ${TASKS[kind]}. ` +
    'Правила: опирайся только на этот текст и не добавляй фактов, названий, цифр и мест, которых в нём нет; ' +
    'без ссылок и адресов сайтов; без хэштегов, эмодзи и кавычек вокруг варианта; без вступлений и пояснений — ' +
    'только варианты, каждый с новой строки, с номером «1.», «2.», «3.». ' +
    `Язык ответа: ${LANGUAGE_NAMES[locale]}.`
  return [
    { role: 'system', content: system },
    { role: 'user', content: `${SOURCE_NAMES[kind].user}:\n\n${text}` },
  ]
}

const LIST_MARKER_RE = /^\s*(?:\d{1,2}\s*[.)：:]|[-•*–—])\s*/
const WRAPPING_QUOTES_RE = /^[«"“„'`]+|[»"”“'`]+$/g
const MARKDOWN_EMPHASIS_RE = /\*\*|__/g
const LABEL_PREFIX_RE = /^(?:вариант|заголовок|лид|лид-абзац|описание(?: поездки)?|seo-описание|title|lead|meta|meta description|trip)\s*\d*\s*[:：—-]\s*/i
const SENTENCE_END_RE = /[.!?…](?=\s|$)/g

/** Срезает вариант по бюджету: до конца последнего предложения, иначе по слову с многоточием. */
export function clampVariant(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text
  const head = text.slice(0, maxChars)
  let sentenceEnd = -1
  for (const match of head.matchAll(SENTENCE_END_RE)) sentenceEnd = match.index + 1
  // Короткий обрубок предложения хуже честного многоточия: оставляем хотя бы половину бюджета.
  if (sentenceEnd >= maxChars / 2) return head.slice(0, sentenceEnd).trim()
  const wordEnd = head.lastIndexOf(' ')
  const cut = (wordEnd > maxChars / 2 ? head.slice(0, wordEnd) : head.slice(0, maxChars - 1)).replace(/[\s,;:—–-]+$/, '')
  return `${cut}…`
}

const cleanLine = (line: string): string =>
  line
    .replace(LIST_MARKER_RE, '')
    .replace(MARKDOWN_EMPHASIS_RE, '')
    .replace(LABEL_PREFIX_RE, '')
    .trim()
    .replace(WRAPPING_QUOTES_RE, '')
    .trim()

/**
 * Ответ модели → варианты: страж убирает адреса, строки с номером начинают вариант,
 * продолжения без номера приклеиваются к нему; без нумерации — абзацы. Пустые,
 * слишком короткие и повторы отбрасываются; остаётся не больше `variants` штук.
 */
export function parseAuthorDraftVariants(raw: string, kind: AiAuthorDraftKind): string[] {
  const shape = AI_AUTHOR_DRAFT_SHAPES[kind]
  const { text } = enforceSourceLinks(raw, [])
  const lines = text.split('\n')
  const numbered = lines.some((line) => /^\s*\d{1,2}\s*[.)：:]/.test(line))
  const chunks: string[] = []
  if (numbered) {
    for (const line of lines) {
      if (!line.trim()) continue
      if (/^\s*\d{1,2}\s*[.)：:]/.test(line) || !chunks.length) chunks.push(cleanLine(line))
      else chunks[chunks.length - 1] = `${chunks[chunks.length - 1]} ${cleanLine(line)}`.trim()
    }
  } else {
    for (const paragraph of text.split(/\n\s*\n/)) {
      const joined = paragraph.split('\n').map(cleanLine).filter(Boolean).join(' ')
      if (joined) chunks.push(joined)
    }
  }
  const seen = new Set<string>()
  const variants: string[] = []
  for (const chunk of chunks) {
    const variant = clampVariant(chunk.replace(/\s+/g, ' ').trim(), shape.maxChars)
    const key = variant.toLowerCase()
    if (variant.length < shape.minChars || seen.has(key)) continue
    seen.add(key)
    variants.push(variant)
    if (variants.length >= shape.variants) break
  }
  return variants
}

export function createAuthorDraftHandler(deps: AuthorDraftDeps): AuthorDraftHandler {
  return createQuotaGenerationHandler(deps, {
    route: 'POST /ai/author-draft',
    limitNoun: 'запросов помощника',
    parse: (input) => {
      const kind = parseAuthorDraftKind(input.kind)
      const text = parseAuthorDraftText(input.text, AI_AUTHOR_DRAFT_MIN_TEXT_CHARS_BY_KIND[kind])
      return { kind, text, locale: parseLocale(input.locale) }
    },
    messages: ({ kind, locale, text }) => buildAuthorDraftMessages(kind, locale, text),
    maxTokens: ({ kind }) => AI_AUTHOR_DRAFT_SHAPES[kind].maxTokens,
    result: (answer, { kind }, remaining): AuthorDraftResponse => {
      const variants = parseAuthorDraftVariants(answer, kind)
      if (!variants.length) {
        throw new HttpError(503, 'generator_unavailable', { detail: 'модель не дала ни одного варианта', retryAfterSec: GENERATOR_RETRY_AFTER_SEC })
      }
      return { variants, remaining }
    },
  })
}
