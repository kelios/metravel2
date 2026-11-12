/**
 * Справка о сайте — третий тип источника индекса (#3293).
 *
 * Ассистент знал только статьи и квесты: на «Сколько стоит пройти квест?» отдавал восемь случайных
 * карточек и бессмысленную фразу. Ответы на вопросы о самом MeTravel — цена, регистрация, прохождение
 * квеста, приложения, публикация статьи, карта, языки, обратная связь — лежат в корпусе
 * `scripts/ai-index/sources/help/`:
 *   - `help.ru.json` — записи: `num` (номер источника в индексе, не меняется), `id`, `approved`, `topic`,
 *     `questions[]`, `answer`, `url` (страница сайта), `source_doc` (документ или ресурс, откуда взят
 *     факт), `needs_owner` и `owner_question` (что должен подтвердить владелец);
 *   - `help.{be,uk,pl,en}.json` — переводы `{id, questions[], answer}`; записи без перевода отдаются на RU.
 *
 * Тексты ответов видит посетитель, поэтому их утверждает владелец: в индекс идут только записи с
 * `approved: true`. Запись с `needs_owner: true` утверждённой быть не может — сначала ответ владельца на
 * `owner_question` (после него `needs_owner` снимается). Черновики включает переменная окружения
 * `AI_INDEX_HELP_DRAFTS=1` — только для стенда.
 *
 * Фрагменты записи на одном языке: по одному на формулировку вопроса (заголовок — сама формулировка, текст
 * для вектора — она же и ответ) и один фрагмент ответа (тег `answer`: заголовок — первая формулировка,
 * текст — ответ). Поле `answer` у всех — ответ дословно, его служба отдаёт посетителю. Все формулировки
 * в одном фрагменте размывали вектор: «Есть ли у вас приложение для телефона?» оказывался дальше от записи
 * о приложении (0,46), чем от записи о прогрессе квеста. Фрагмент ответа нужен порядку записей: служба
 * складывает близость вопроса к формулировкам и к ответу (`helpHits`, `scripts/ai-assist/search.ts`).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { chunkId, type ChunkRecord } from './format.ts'

export const HELP_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'sources', 'help')
export const HELP_LOCALES = ['ru', 'be', 'uk', 'pl', 'en'] as const
export const HELP_SITE_ORIGIN = 'https://metravel.by'
/** Переменная окружения стенда: брать в индекс и неутверждённые записи. */
export const HELP_DRAFTS_ENV = 'AI_INDEX_HELP_DRAFTS'
/** Тег фрагмента ответа записи (в отличие от фрагментов-формулировок). */
export const HELP_ANSWER_TAG = 'answer'

export interface HelpEntry {
  /** Номер источника в индексе (`help:<num>`); после публикации не меняется и не переиспользуется. */
  num: number
  id: string
  /** Текст утверждён владельцем — запись идёт в индекс. */
  approved: boolean
  topic: string
  questions: string[]
  answer: string
  /** Страница сайта, путь от корня: `/quests`. */
  url: string
  /** Откуда взят факт: файл репозитория и, после `#`, раздел или ключ. */
  source_doc: string
  /** Факт требует подтверждения владельца; до него запись не утверждается. */
  needs_owner: boolean
  owner_question: string | null
}

export interface HelpTranslation {
  id: string
  questions: string[]
  answer: string
}

export interface HelpCorpus {
  entries: HelpEntry[]
  /** Переводы по локали и `id`; локали без файла нет в карте. */
  translations: Partial<Record<string, Map<string, HelpTranslation>>>
}

const readJson = <T>(file: string): T => JSON.parse(fs.readFileSync(file, 'utf8')) as T

export function readHelpCorpus(dir: string = HELP_DIR): HelpCorpus {
  const entries = readJson<HelpEntry[]>(path.join(dir, 'help.ru.json'))
  const translations: HelpCorpus['translations'] = {}
  for (const locale of HELP_LOCALES) {
    if (locale === 'ru') continue
    const file = path.join(dir, `help.${locale}.json`)
    if (!fs.existsSync(file)) continue
    translations[locale] = new Map(readJson<HelpTranslation[]>(file).map((item) => [item.id, item]))
  }
  return { entries, translations }
}

const isText = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0
const isQuestions = (value: unknown): value is string[] => Array.isArray(value) && value.length > 0 && value.every(isText)

/**
 * Ошибки корпуса: формат записи, уникальность `num` и `id`, страница и документ-источник, запрет
 * утверждать запись с неподтверждённым фактом, переводы (полные либо отсутствуют целиком — тогда RU).
 * Существование роута и документа проверяет тест: сборщику индекса дерево приложения недоступно.
 */
export function validateHelpCorpus(corpus: HelpCorpus): string[] {
  const problems: string[] = []
  const nums = new Set<number>()
  const ids = new Set<string>()
  for (const entry of corpus.entries) {
    const where = `help.ru.json ${entry?.id ?? '?'}`
    if (!Number.isInteger(entry.num) || entry.num <= 0) problems.push(`${where}: num — положительное целое`)
    else if (nums.has(entry.num)) problems.push(`${where}: повтор num ${entry.num}`)
    else nums.add(entry.num)
    if (!/^help-[a-z0-9-]+$/.test(String(entry.id))) problems.push(`${where}: id вида help-…`)
    else if (ids.has(entry.id)) problems.push(`${where}: повтор id`)
    else ids.add(entry.id)
    if (typeof entry.approved !== 'boolean') problems.push(`${where}: approved — true или false`)
    if (!isText(entry.topic)) problems.push(`${where}: нет темы`)
    if (!isQuestions(entry.questions)) problems.push(`${where}: нет формулировок вопроса`)
    if (!isText(entry.answer)) problems.push(`${where}: нет ответа`)
    if (!/^\/[a-z0-9/-]*$/.test(String(entry.url))) problems.push(`${where}: url — путь страницы сайта от корня`)
    if (!isText(entry.source_doc)) problems.push(`${where}: нет документа-источника`)
    if (typeof entry.needs_owner !== 'boolean') problems.push(`${where}: needs_owner — true или false`)
    if (entry.needs_owner && !isText(entry.owner_question)) problems.push(`${where}: needs_owner без вопроса владельцу`)
    if (entry.approved && entry.needs_owner) problems.push(`${where}: утверждена запись с неподтверждённым фактом (needs_owner)`)
  }
  for (const [locale, items] of Object.entries(corpus.translations)) {
    if (!items) continue
    for (const [id, item] of items) {
      if (!ids.has(id)) problems.push(`help.${locale}.json ${id}: записи нет в help.ru.json`)
      if (!isQuestions(item.questions) || !isText(item.answer)) problems.push(`help.${locale}.json ${id}: перевод без вопросов или ответа`)
    }
  }
  return problems
}

/** Запись на языке `locale`; перевода нет — русская (`fallback: true`). */
export function localizedHelp(corpus: HelpCorpus, entry: HelpEntry, locale: string): { questions: string[]; answer: string; fallback: boolean } {
  const translated = locale === 'ru' ? null : corpus.translations[locale]?.get(entry.id)
  return translated ? { questions: translated.questions, answer: translated.answer, fallback: false } : { questions: entry.questions, answer: entry.answer, fallback: locale !== 'ru' }
}

export interface HelpChunkOptions {
  /** Брать и неутверждённые записи — только стенд (`AI_INDEX_HELP_DRAFTS=1`). */
  drafts?: boolean
}

export const helpDraftsEnabled = (env: NodeJS.ProcessEnv = process.env): boolean => env[HELP_DRAFTS_ENV] === '1'

/**
 * Фрагменты индекса из корпуса: формулировки вопроса и ответ на каждом языке, где есть перевод (RU — всегда).
 * Запись без перевода на язык вопроса служба найдёт русским фрагментом — так же, как квест без локали.
 */
export function buildHelpChunks(corpus: HelpCorpus, options: HelpChunkOptions = {}): ChunkRecord[] {
  const problems = validateHelpCorpus(corpus)
  if (problems.length) throw new Error(`справочный корпус: ${problems.join('; ')}`)
  const chunks: ChunkRecord[] = []
  for (const entry of corpus.entries) {
    if (!entry.approved && !options.drafts) continue
    for (const locale of HELP_LOCALES) {
      const text = localizedHelp(corpus, entry, locale)
      if (text.fallback) continue
      const base = { type: 'help' as const, source_id: entry.num, url: `${HELP_SITE_ORIGIN}${entry.url}`, city: null, country: null, lat: null, lng: null, month: [], locale, cover: null, answer: text.answer }
      for (const question of text.questions) {
        const body = `${question}\n${text.answer}`
        chunks.push({ ...base, id: chunkId('help', entry.num, locale, body), title: question, tags: [entry.id, entry.topic], text: body })
      }
      // Фрагмент ответа: его близость к вопросу участвует в порядке записей.
      chunks.push({ ...base, id: chunkId('help', entry.num, locale, `${HELP_ANSWER_TAG}\n${text.answer}`), title: text.questions[0], tags: [entry.id, entry.topic, HELP_ANSWER_TAG], text: text.answer })
    }
  }
  return chunks
}
