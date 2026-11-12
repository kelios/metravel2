/**
 * HTTP-слой metravel-assist (#2456, #2713) на встроенном `node:http`: восемь эндпоинтов, без фреймворка.
 *
 *   POST /ai/search  {q, locale?, type?, limit?}  → {items, took_ms, index_built_at, degraded, cached}
 *   POST /ai/ask     {q, locale?, history?, source?} → SSE `sources → text* → done` (ask.ts)
 *   POST /ai/author-draft {text, kind, locale?} → {variants, remaining} (authorDraft.ts, #2885)
 *   POST /ai/suggest-tags {text, locale?} → {countries, categories, …, confidence, degraded} (suggestTags.ts, #2886)
 *   POST /ai/near-route {points: [{lat,lng}], limit?, locale?} → {items, took_ms} (nearRoute.ts, #2911)
 *   POST /ai/intent {q, locale?} → {categories, radius_km, center, constraints} (intent.ts, #2887)
 *   GET  /ai/similar?type=&id=&limit=&locale=&result_type= → {items, took_ms, index_built_at}
 *   GET  /ai/health → {ok, model, dim, count, index_built_at, index_age_days, sources, rss_mb, …}
 *
 * Зависимости приходят снаружи (`createApp`), поэтому тесты поднимают сервер на фикстурном
 * индексе с фальшивым эмбеддером и без сети.
 */
import http from 'node:http'

import { type ChunkType, countSources, indexAgeDays } from '../ai-index/format.ts'
import { AI_MAP_INTENT_DAILY_LIMIT, AI_OFFTOPIC_STRIKES_TO_BLOCK, AI_PAGE_FRAGMENT_CHARS, AI_PAGE_FRAGMENTS, AI_SOURCES_LIMIT } from '../../api/aiAssist/policy.ts'
import { mentionsAnyPlace } from '../../api/aiAssist/promptPlace.ts'
import { factsKey, type QuestFacts, questFactsLine, questFactsOf, travelFactsLine } from '../../api/aiAssist/sourceFacts.ts'
import { parseConditions } from '../../api/aiAssist/questionConditions.ts'
import { arrangeSources } from '../../api/aiAssist/sourceSelection.ts'
import type { AiSource } from '../../api/aiAssist/types.ts'
import { type AiSourceRef, leavesPage } from '../../api/aiAssist/sourceRef.ts'
import { type AskDeps, createAskHandler, type RetrievalResult } from './ask.ts'
import { AUTHOR_DRAFT_MAX_BODY_BYTES, type AuthorDraftDeps, createAuthorDraftHandler } from './authorDraft.ts'
import type { ResponseCache } from './cache.ts'
import type { LoadedIndex } from './index.ts'
import { createIntentHandler, INTENT_LIMITS_PREFIX } from './intent.ts'
import type { LexicalHit, LexicalSearch } from './lexical.ts'
import { AskLimits, createDayClock, MemoryCounterStore } from './limits.ts'
import { nearRouteItems, parseNearRouteLimit, parseNearRoutePoints } from './nearRoute.ts'
import { bestPageRows, focusFragment, joinPageFragments, pageRows } from './page.ts'
import { HttpError, MAX_LIMIT, MAX_QUERY_CHARS, parseLimit, parseLocale, parseQuery, parseType } from './params.ts'
import { BusyError, SingleFlight } from './queue.ts'
import { ASK_FRAGMENT_CHARS, helpHits, type Locale, type ResultItem, ROW_TYPE, VECTOR_SOURCES, itemForRow, normalizeQuery, rrfMerge, similarHits, snippet, vectorSources } from './search.ts'
import { createSuggestTagsHandler, SUGGEST_TAGS_MAX_BODY_BYTES, type TagCatalog } from './suggestTags.ts'

export { MAX_LIMIT, MAX_QUERY_CHARS }

/** Сколько записей справки (#3293) отдаёт подбор: ближайшие — ответ, остальные — «Ещё по теме». */
export const HELP_SOURCES_LIMIT = 3
/**
 * Когда вопрос отвечает справка (#3293) — пороги близости записи к вопросу (косинус, `embeddinggemma-300m`).
 * Замер 12.11.2026 на копии рабочего индекса с корпусом 40 записей × 5 языков (`.codex-temp/train2/help-scores.mts`):
 *   - в вопросе есть признак сервиса (`asksAboutService`): 16 вопросов о сайте на пяти языках дают лучшую
 *     запись от 0,50 до 0,81, вопросы с тем же словом о другом — «Какое приложение взять для навигации в
 *     горах?» 0,47, «Есть ли интернет в горных приютах Татр?» 0,32, «регистрация на рейс» 0,32. Порог —
 *     `HELP_MIN_SCORE`; запись при этом не должна быть заметно дальше лучшего материала (`HELP_BEHIND`):
 *     «Сколько стоит квест в Кракове?» — 0,54 против 0,62 — остаётся вопросом о сайте;
 *   - признака нет: справка отвечает, только если запись близка (`HELP_MIN_SCORE_UNPROMPTED`) и ближе лучшего
 *     материала на `HELP_LEAD`: «Как добавить на сайт свою статью?» 0,77 против 0,37, «Чи можна проходити
 *     квест удвох з одного телефона?» 0,61 против 0,38, «Есть ли квесты для детей?» 0,70 против 0,53. Вопросы
 *     о поездке сюда не проходят: «Есть ли квесты для детей в Минске?» 0,66 против 0,68, «Что посмотреть в
 *     Кракове?» 0,28 против 0,65, «Самый короткий квест в Минске» 0,56 против 0,61.
 * Пороги считаются по самой близкой формулировке среди всех записей; сам порядок записей — `helpHits`.
 */
export const HELP_MIN_SCORE = 0.48
export const HELP_BEHIND = 0.1
export const HELP_MIN_SCORE_UNPROMPTED = 0.6
export const HELP_LEAD = 0.1
/** Вторая запись «почти так же близка»: её балл порядка (`HelpHit.score`) уступает первой не больше чем на столько. */
export const HELP_TIE = 0.05
/**
 * Ответ записи открывается отдельным «Да» или «Нет» (RU/BE/UK/PL/EN): он отвечает только на свой вопрос.
 * Частица перед словом («Не обязательно: …», «Nie musisz …») сюда не относится.
 */
const YES_NO_RE = /^\s*(?:да|нет|так|не|ні|tak|nie|yes|no)\s*[.,!:;—–-]/iu
export const opensWithYesNo = (answer: string): boolean => YES_NO_RE.test(answer)

/** Зависимости `/ai/ask`; подбор и очередь к эмбеддингу — общие с `/ai/search`. */
export type AskAppDeps = Omit<AskDeps, 'retrieve' | 'lookupSource' | 'llmQueue' | 'log'>
/** Зависимости `/ai/author-draft` (#2885): свой счётчик на IP; модель, очередь и прокси — общие с `/ai/ask`. */
export type AuthorDraftAppDeps = Pick<AuthorDraftDeps, 'limits'>

export interface AppDeps {
  index: LoadedIndex
  modelKey: string
  embedQuery: (q: string) => Promise<ArrayLike<number>>
  lexical: LexicalSearch
  cache: ResponseCache
  queueTimeoutMs: number
  ask: AskAppDeps
  /** `false` — не сокращать подсказку до карточек, выделенных условиями вопроса (#3289); по умолчанию сокращается. */
  promptFocus?: boolean
  /** Длина текстового фрагмента карточки `/ai/ask` по типу источника (#3287); нет — `ASK_FRAGMENT_CHARS`. */
  askFragmentChars?: Partial<Record<ChunkType, number>>
  authorDraft: AuthorDraftAppDeps
  /**
   * `/ai/intent` (#2887): свой счётчик на IP. Необязателен для стендов и тестов других
   * эндпоинтов — тогда квота живёт в памяти процесса с лимитом политики; `main.ts` передаёт
   * счётчик на общем хранилище (redis).
   */
  mapIntent?: { limits: AskLimits }
  /** `/ai/suggest-tags` (#2886): каталог словарных значений с часовым кэшем. */
  suggestTags: { catalog: TagCatalog }
  log?: (line: string) => void
}

export interface SearchResponse {
  items: ResultItem[]
  took_ms: number
  index_built_at: string
  degraded: boolean
  cached: boolean
}

export const DEFAULT_LIMIT = 10
export const MAX_BODY_BYTES = 16 * 1024
/** Сколько статей просим у лексики: с запасом относительно limit, но без лишней нагрузки на Django. */
export const LEXICAL_LIMIT = 20

function readJsonBody(request: http.IncomingMessage, maxBytes: number = MAX_BODY_BYTES): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    let tooLarge = false
    request.on('data', (chunk: Buffer) => {
      if (tooLarge) return
      size += chunk.length
      if (size > maxBytes) {
        // Сокет не рвём: клиент должен получить 413, остаток тела Node отбросит сам
        // (ответ уходит с connection: close).
        tooLarge = true
        chunks.length = 0
        reject(new HttpError(413, 'payload_too_large', `тело больше ${maxBytes} байт`))
        return
      }
      chunks.push(chunk)
    })
    request.on('end', () => {
      if (tooLarge) return
      const raw = Buffer.concat(chunks).toString('utf8').trim()
      if (!raw) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(raw))
      } catch {
        reject(new HttpError(400, 'bad_request', 'тело запроса — не JSON'))
      }
    })
    request.on('error', reject)
  })
}

const elapsedMs = (started: bigint) => Math.round(Number(process.hrtime.bigint() - started) / 1e4) / 100

export function createApp(deps: AppDeps): http.Server {
  const { index } = deps
  const { manifest } = index.artifact
  const log = deps.log ?? ((line: string) => console.error(line))
  const queue = new SingleFlight()
  const llmQueue = new SingleFlight()
  const startedAt = Date.now()
  const cachePrefix = `ai-assist:v1:${deps.modelKey}:${manifest.source_sha256.slice(0, 16)}`

  const send = (response: http.ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) => {
    const payload = JSON.stringify(body)
    response.writeHead(status, {
      'content-type': 'application/json; charset=utf-8',
      'content-length': Buffer.byteLength(payload),
      'cache-control': 'no-store',
      ...headers,
    })
    response.end(payload)
  }

  // Артефакт, собранный до #3288, числа источников в манифесте не несёт.
  const sources = manifest.sources ?? countSources(index.artifact.chunks)
  const health = () => {
    const memory = process.memoryUsage()
    return {
      llm: deps.ask.generator ? 'configured' : 'unconfigured',
      // Контур оценки (#3286): приёмка сверяет, что служба смотрит на свою модель; без флага полей нет.
      ...(deps.ask.evalTrace ? { eval_trace: true, llm_url: deps.ask.evalTrace.llmUrl } : {}),
      ask_queue: { busy: llmQueue.isBusy, waiting: llmQueue.waiting },
      ok: true,
      model: deps.modelKey,
      dim: manifest.dim,
      count: manifest.count,
      index_built_at: manifest.built_at,
      // #3288: устаревший индекс молча не находит новые материалы — возраст и состав видны пробе.
      index_age_days: indexAgeDays(manifest.built_at),
      sources,
      // #3287: версия формата артефакта и число записей фактов — проба видит службу на индексе без фактов.
      index_format_version: manifest.format_version ?? 1,
      facts: index.factsBySource.size,
      rss_mb: Math.round(memory.rss / 1048576),
      heap_mb: Math.round(memory.heapUsed / 1048576),
      uptime_s: Math.round((Date.now() - startedAt) / 1000),
      queue: { busy: queue.isBusy, waiting: queue.waiting },
      cache: deps.cache.stats(),
    }
  }

  interface HybridQuery {
    q: string
    locale: Locale
    type?: ChunkType
    limit: number
  }

  /** Гибрид «вектор + лексика» без кэша: общий для `/ai/search` и подбора карточек `/ai/ask`. */
  async function hybrid({ q, locale, type, limit }: HybridQuery): Promise<{ items: ResultItem[]; degraded: boolean; vector: ArrayLike<number> }> {
    // Лексика — только для статей (бэкенд ищет travels) и стартует уже внутри слота очереди,
    // параллельно с эмбеддингом: запрос, который не дождётся слота (503 busy), не должен
    // запускать поиск в Django на том же vCPU. Отказ лексики → null (degraded) сразу, чтобы
    // промис не стал unhandled rejection при ошибке модели или поиска.
    let lexicalPromise: Promise<LexicalHit[] | null> = Promise.resolve([])
    let vector: ArrayLike<number>
    try {
      vector = await queue.run(deps.queueTimeoutMs, () => {
        if (type === undefined || type === 'travel') lexicalPromise = deps.lexical(q, LEXICAL_LIMIT).catch(() => null)
        return deps.embedQuery(q)
      })
    } catch (error) {
      if (error instanceof BusyError) throw new HttpError(503, 'busy', error.message)
      throw error
    }
    const vectorHits = vectorSources(index, { vector, locale, type, limit: VECTOR_SOURCES })
    const lexicalHits = await lexicalPromise
    return { items: rrfMerge(vectorHits, lexicalHits ?? [], index, limit), degraded: lexicalHits === null, vector }
  }

  async function search(body: unknown): Promise<SearchResponse> {
    const started = process.hrtime.bigint()
    const input = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
    const q = parseQuery(input.q)
    const locale = parseLocale(input.locale)
    const type = parseType(input.type)
    const limit = parseLimit(input.limit, DEFAULT_LIMIT)
    const cacheKey = `${cachePrefix}:${locale}:${type ?? '*'}:${limit}:${normalizeQuery(q)}`

    const cached = await deps.cache.get(cacheKey)
    if (cached) {
      const parsed = JSON.parse(cached) as SearchResponse
      return { ...parsed, took_ms: elapsedMs(started), cached: true }
    }

    const { items, degraded } = await hybrid({ q, locale, type, limit })
    const result: SearchResponse = { items, took_ms: elapsedMs(started), index_built_at: manifest.built_at, degraded, cached: false }
    // Деградированный ответ не кэшируем: сбой бэкенда не должен жить в кэше час.
    if (!degraded) await deps.cache.set(cacheKey, JSON.stringify(result))
    return result
  }

  /** Теги квеста и названия его города на всех локалях индекса; для статьи и источника вне индекса — `null`. */
  const questCatalog = (item: ResultItem): { tags: string[]; cities: (string | null)[] } | null => {
    const rows = item.type === 'quest' ? index.rowsBySource.get(`quest:${item.source_id}`) : undefined
    if (!rows?.length) return null
    const chunks = rows.map((row) => index.artifact.chunks[row])
    return { tags: chunks[0].tags, cities: [item.city, ...new Set(chunks.map((chunk) => chunk.city))] }
  }

  /**
   * Факты квеста (#3287): запись `facts.jsonl`; у артефакта без фактов — аудитория по тегам
   * фрагмента, как до #3287 (карточка тогда несёт только вид квеста, возраст и «Со взрослым»).
   */
  const questFacts = (item: ResultItem): QuestFacts | null => {
    if (item.type !== 'quest') return null
    const facts = index.factsBySource.get(`quest:${item.source_id}`)
    if (facts?.type === 'quest') return facts
    const catalog = questCatalog(item)
    return catalog ? questFactsOf(item.source_id, { tags: catalog.tags }) : null
  }

  const fragmentChars = { ...ASK_FRAGMENT_CHARS, ...deps.askFragmentChars }

  /**
   * Карточки для промпта ассистента: та же форма `AiSource`, что у клиентского подбора. Первой в
   * карточке идёт строка фактов (#3287) — тем же построителем, что на экране (`questToSource`,
   * `travelToSource`) и в слепке обучения: у квеста — вид квеста с городом и страной, возраст,
   * «Со взрослым» (#3276), число точек, длительность, сложность, «Можно с собакой»; у статьи —
   * страна, число дней, месяцы (город статьи в индексе — подпись первой точки маршрута, #3347). Затем — фрагмент текста под вопрос, не длиннее
   * `ASK_FRAGMENT_CHARS` своего типа.
   */
  const toSource = (item: ResultItem, pageFragments?: string): AiSource => {
    const quest = questCatalog(item)
    const place = { city: item.city, country: item.country }
    const indexed = item.type === 'travel' ? index.factsBySource.get(`travel:${item.source_id}`) : undefined
    const travelFacts = indexed?.type === 'travel' ? indexed : null
    const ownQuestFacts = item.type === 'quest' ? questFacts(item) : null
    const facts = item.type === 'quest' ? questFactsLine(ownQuestFacts, place) : travelFactsLine(travelFacts, { country: item.country })
    // Карточка страницы (#3290) несёт свои фрагменты — несколько окон текста под вопрос.
    // У справки (#3293) своей карточки материала нет: её собирает `helpSources`.
    const chars = item.type === 'help' ? 0 : fragmentChars[item.type]
    const fragment = pageFragments ?? (chars > 0 ? snippet(item.snippet, chars) : '')
    return {
      type: item.type,
      source_id: String(item.source_id),
      title: item.title,
      url: item.url,
      path: new URL(item.url).pathname,
      snippet: [facts, fragment].filter(Boolean).join('. '),
      score: item.score ?? 0,
      // Место карточки для отбора подсказки (#3315): у квеста — город на всех локалях индекса, у статьи — страна.
      place: { cities: quest ? quest.cities : [], countries: [item.country] },
      // Запись фактов — для проверки условий вопроса (#3289); посетителю не уходит.
      facts: ownQuestFacts ?? travelFacts,
    }
  }

  /** Источник индекса по ключу `type:id`: фрагмент запрошенной локали, если он есть, иначе первый; нет в индексе — `null`. */
  const sourceItem = (key: string, locale: Locale): ResultItem | null => {
    const rows = index.rowsBySource.get(key)
    if (!rows?.length) return null
    const row = rows.find((candidate) => index.artifact.chunks[candidate].locale === locale) ?? rows[0]
    return itemForRow(index, row, null)
  }

  const questKeys = [...index.factsBySource.values()].filter((facts) => facts.type === 'quest').map(factsKey)

  /**
   * Все квесты индекса карточками — кандидаты превосходной степени (#3287): «самый короткий квест в
   * Минске» решается по фактам каталога до модели, а самый короткий квест города мог и не попасть в
   * восемь найденных. Они же — квесты города, который подбор не нашёл (#3277: «да Нясвіжа»). Место и
   * условия среди них выбирает общая цепочка (`arrangeSources`). Индекс за жизнь процесса не меняется,
   * поэтому карточки локали собираются один раз.
   */
  const poolByLocale = new Map<Locale, AiSource[]>()
  const questPool = (locale: Locale) => (): AiSource[] => {
    let pool = poolByLocale.get(locale)
    if (!pool) {
      pool = questKeys.flatMap((key) => {
        const item = sourceItem(key, locale)
        return item ? [toSource(item)] : []
      })
      poolByLocale.set(locale, pool)
    }
    return pool
  }

  /**
   * Источник упоминает названное в вопросе место (#3289) — в карточке, в названиях на всех локалях
   * индекса или где-либо в тексте. Фрагмент карточки — 120 знаков, и статья о тропе в Закопане слова
   * «Татры» в нём не несёт; по нему одному подсказка получала бы ложное «материала о месте нет».
   * Порядок — от дешёвого: карточка и названия, затем сниппеты строк из памяти и только потом полный
   * текст с диска (чтение синхронное, строка за строкой до первого упоминания).
   */
  const mentionsInIndex = (locale: Locale) => (source: AiSource, places: readonly string[]): boolean => {
    const key = `${source.type}:${source.source_id}`
    const { chunks } = index.artifact
    const everywhere = index.rowsBySource.get(key) ?? []
    const names = everywhere.flatMap((row) => [chunks[row].title, chunks[row].city, chunks[row].country])
    if (mentionsAnyPlace(places, [source.title, source.snippet, ...new Set(names)].filter(Boolean).join(' '))) return true
    const rows = pageRows(index, key, locale)
    if (rows.some((row) => mentionsAnyPlace(places, index.snippets[row]))) return true
    const { readText } = index
    return readText ? rows.some((row) => mentionsAnyPlace(places, readText(row) ?? '')) : false
  }

  /**
   * Карточка страницы для режима страницы (#3290): строка фактов и лучшие под вопрос фрагменты текста
   * этой страницы — тем же вектором запроса, что у общего подбора. `null` — источника нет в индексе
   * либо вопрос называет место, которого на странице нет («а что в Гданьске?»): тогда ход идёт общим
   * подбором, как до #3290.
   */
  function pageCard(ref: AiSourceRef, q: string, locale: Locale, vector: ArrayLike<number>): AiSource | null {
    const key = `${ref.type}:${ref.id}`
    const rows = pageRows(index, key, locale)
    if (!rows.length) return null
    const { chunks } = index.artifact
    // Полный текст строки читается с диска один раз за вопрос: и для сверки места, и для фрагмента.
    const texts = new Map<number, string>()
    const textOf = (row: number): string => {
      if (!texts.has(row)) texts.set(row, index.readText?.(row) ?? index.snippets[row])
      return texts.get(row)!
    }
    // Место вопроса сверяется с названием и городом страницы на всех локалях индекса и со сниппетами
    // строк (память); полный текст читается, только если место названо, а там его нет: сниппет строки —
    // первые 200 знаков, а фрагмент — до 800, место часто стоит дальше.
    const everywhere = index.rowsBySource.get(key) ?? rows
    const names = new Set(everywhere.flatMap((row) => [chunks[row].title, chunks[row].city, chunks[row].country]))
    const head = [...names, ...rows.map((row) => index.snippets[row])].filter(Boolean).join(' ')
    if (leavesPage(q, head) && leavesPage(q, rows.map(textOf).join(' '))) return null
    const best = bestPageRows(index, rows, vector, AI_PAGE_FRAGMENTS)
    const fragments = best.map((row) => focusFragment(textOf(row), q, AI_PAGE_FRAGMENT_CHARS))
    return toSource(itemForRow(index, best[0], null), joinPageFragments(fragments))
  }

  const hasHelp = index.typeOfRow.includes(ROW_TYPE.help)
  /**
   * Справка о сайте (#3293): записи корпуса, ближайшие к вопросу, — карточками вида `help`. Заголовок —
   * формулировка вопроса из записи, фрагмент — утверждённый ответ дословно, адрес — страница сайта.
   * Отвечает первая запись (группа `match`); вторая присоединяется к ней редко — см. ниже; остальные — «Ещё
   * по теме». Пусто — вопрос не о сайте либо подходящей записи нет: ход идёт обычным подбором.
   * `material` — близость лучшего найденного материала (статьи или квеста) к тому же вопросу.
   */
  function helpSources(vector: ArrayLike<number>, locale: Locale, asked: boolean, material: number): AiSource[] {
    // Индекс без справки (собран до #3293 либо без утверждённых записей) — вопрос идёт обычным подбором.
    if (!hasHelp) return []
    const ranked = helpHits(index, vector, locale)
    // Отвечает ли справка, решает самая близкая формулировка среди всех записей — как до доранжирования, пороги
    // мерились по ней; какая запись первая — решает балл порядка. Первая по баллу бывает не самой близкой по
    // одной формулировке: «Чи можна проходити квест удвох з одного телефона?» — у верной записи чуть меньше
    // 0,6 при 0,61 у соседней; по первой записи вопрос не дотягивал до порога и уходил модели.
    const best = ranked.reduce((max, hit) => Math.max(max, hit.cosine), 0)
    const hits = ranked.slice(0, HELP_SOURCES_LIMIT)
    const answers = asked ? best >= HELP_MIN_SCORE && best >= material - HELP_BEHIND : best >= HELP_MIN_SCORE_UNPROMPTED && best >= material + HELP_LEAD
    if (!answers) return []
    const [first, second] = hits
    return hits.map((hit, position): AiSource => {
      const item = itemForRow(index, hit.row, hit.cosine)
      // Вторая запись встаёт в ответ, только когда она почти так же близка, из той же темы и её ответ не
      // начинается с «Да» или «Нет»: такой ответ отвечает на свой вопрос, вторым абзацем к чужому он обманывает.
      const joins = position === 1 && second.score >= first.score - HELP_TIE && first.topic !== '' && second.topic === first.topic && !opensWithYesNo(item.answer ?? '')
      return {
        type: 'help',
        source_id: String(item.source_id),
        title: item.title,
        url: item.url,
        path: new URL(item.url).pathname,
        snippet: item.answer ?? item.snippet,
        score: hit.cosine,
        group: position === 0 || joins ? 'match' : 'nearby',
      }
    })
  }

  async function retrieve(q: string, locale: Locale, page: AiSourceRef | null = null): Promise<RetrievalResult> {
    const { items, degraded, vector } = await hybrid({ q, locale, limit: AI_SOURCES_LIMIT })
    // Вопрос о самом сайте (#3293): отвечает справка, статьи и квесты к ней не добавляются. Со страницы
    // статьи или квеста вопрос читается как вопрос об этой странице — справка туда не вмешивается.
    if (!page) {
      const material = Math.max(0, ...items.map((item) => item.score ?? 0))
      const help = helpSources(vector, locale, parseConditions(q).service === true, material)
      if (help.length) return { sources: help, degraded: false, page: null, help: true }
    }
    const card = page ? pageCard(page, q, locale, vector) : null
    // Одна цепочка порядка (#3289): место вопроса → условия по фактам → превосходная степень. В режиме
    // страницы (#3290) найденное — только «ещё по теме»: порядок без групп и без строки о месте. Вопрос,
    // который уводит со страницы, — обычный вопрос: полный отбор с группами.
    const arranged = arrangeSources(
      q,
      items.map((item) => toSource(item)),
      { pool: questPool(locale), mentions: mentionsInIndex(locale), groups: !card, focus: deps.promptFocus },
    )
    return {
      sources: arranged.sources.slice(0, AI_SOURCES_LIMIT),
      degraded,
      page: card,
      noPlace: !card && arranged.noPlace,
    }
  }

  /**
   * Карточка страницы-источника (#2897) по ключу индекса `type:id`: фрагмент запрошенной
   * локали, если квест на ней есть, иначе первый; балл — `null`, как у лексики (карточка
   * не из подбора). Нет в индексе — `null`.
   */
  function lookupSource(ref: AiSourceRef, locale: Locale): AiSource | null {
    const item = sourceItem(`${ref.type}:${ref.id}`, locale)
    return item ? toSource(item) : null
  }

  const ask = createAskHandler({ ...deps.ask, retrieve, lookupSource, llmQueue, log })
  const authorDraft = createAuthorDraftHandler({
    generator: deps.ask.generator,
    llmQueue,
    queueTimeoutMs: deps.ask.queueTimeoutMs,
    limits: deps.authorDraft.limits,
    trustProxy: deps.ask.trustProxy,
    now: deps.ask.now,
    log,
  })
  // #2887: фильтр карты по описанию — та же модель и очередь, что у `/ai/ask`, свой счётчик на IP.
  const mapIntent = createIntentHandler({
    generator: deps.ask.generator,
    llmQueue,
    queueTimeoutMs: deps.ask.queueTimeoutMs,
    limits:
      deps.mapIntent?.limits ??
      new AskLimits({
        store: new MemoryCounterStore(),
        clock: createDayClock(),
        dailyLimit: AI_MAP_INTENT_DAILY_LIMIT,
        strikesToBlock: AI_OFFTOPIC_STRIKES_TO_BLOCK,
        prefix: INTENT_LIMITS_PREFIX,
      }),
    trustProxy: deps.ask.trustProxy,
    now: deps.ask.now,
    log,
  })
  // #2886: та же очередь к эмбеддингу, что у `/ai/search`; соседи — только статьи, они в индексе на ru.
  const suggestTags = createSuggestTagsHandler({
    catalog: deps.suggestTags.catalog,
    embed: (text) => queue.run(deps.queueTimeoutMs, () => deps.embedQuery(text)),
    neighbours: (vector, limit) => vectorSources(index, { vector, locale: 'ru', type: 'travel', limit }).map((hit) => hit.chunk.source_id),
    log,
  })

  /** #2911: материалы в коридоре маршрута — геометрия по индексу, без модели (как `similar`). */
  function nearRoute(body: unknown) {
    const started = process.hrtime.bigint()
    const input = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
    const points = parseNearRoutePoints(input.points)
    const limit = parseNearRouteLimit(input.limit)
    const locale = parseLocale(input.locale)
    return { items: nearRouteItems(index, { points, locale, limit }), took_ms: elapsedMs(started) }
  }

  function similar(params: URLSearchParams) {
    const started = process.hrtime.bigint()
    const type = parseType(params.get('type'))
    if (!type) throw new HttpError(400, 'bad_request', 'type: обязательно travel или quest')
    const id = Number(params.get('id'))
    if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'bad_request', 'id: положительное целое')
    const limit = parseLimit(params.get('limit'), 6)
    const locale = parseLocale(params.get('locale'))
    const resultType = parseType(params.get('result_type'), 'result_type')
    const key = `${type}:${id}`
    const hits = similarHits(index, { key, locale, resultType, limit })
    if (!hits) throw new HttpError(404, 'not_found', `${key} нет в индексе`)
    return {
      items: hits.map((hit) => itemForRow(index, hit.index, hit.score)),
      took_ms: elapsedMs(started),
      index_built_at: manifest.built_at,
    }
  }

  return http.createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost')
    try {
      if (url.pathname === '/ai/health') {
        if (request.method !== 'GET') throw new HttpError(405, 'method_not_allowed')
        send(response, 200, health())
        return
      }
      if (url.pathname === '/ai/search') {
        if (request.method !== 'POST') throw new HttpError(405, 'method_not_allowed', 'POST /ai/search')
        send(response, 200, await search(await readJsonBody(request)))
        return
      }
      if (url.pathname === '/ai/ask') {
        if (request.method !== 'POST') throw new HttpError(405, 'method_not_allowed', 'POST /ai/ask')
        await ask(request, response, await readJsonBody(request))
        return
      }
      if (url.pathname === '/ai/author-draft') {
        if (request.method !== 'POST') throw new HttpError(405, 'method_not_allowed', 'POST /ai/author-draft')
        const result = await authorDraft(request, response, await readJsonBody(request, AUTHOR_DRAFT_MAX_BODY_BYTES))
        if (result) send(response, 200, result)
        return
      }
      if (url.pathname === '/ai/suggest-tags') {
        if (request.method !== 'POST') throw new HttpError(405, 'method_not_allowed', 'POST /ai/suggest-tags')
        send(response, 200, await suggestTags(await readJsonBody(request, SUGGEST_TAGS_MAX_BODY_BYTES)))
        return
      }
      if (url.pathname === '/ai/near-route') {
        if (request.method !== 'POST') throw new HttpError(405, 'method_not_allowed', 'POST /ai/near-route')
        send(response, 200, nearRoute(await readJsonBody(request)))
        return
      }
      if (url.pathname === '/ai/intent') {
        if (request.method !== 'POST') throw new HttpError(405, 'method_not_allowed', 'POST /ai/intent')
        const result = await mapIntent(request, response, await readJsonBody(request))
        if (result) send(response, 200, result)
        return
      }
      if (url.pathname === '/ai/similar') {
        if (request.method !== 'GET') throw new HttpError(405, 'method_not_allowed')
        // Ответ зависит только от индекса: его можно отдавать из HTTP-кэша до следующей сборки.
        send(response, 200, similar(url.searchParams), { 'cache-control': 'public, max-age=3600' })
        return
      }
      throw new HttpError(404, 'not_found')
    } catch (error) {
      if (error instanceof HttpError) {
        if (response.headersSent) {
          // Поток /ai/ask уже открыт: закрыть честнее, чем дописать JSON в SSE.
          response.destroy()
          return
        }
        const headers: Record<string, string> = error.status === 413 ? { connection: 'close' } : {}
        if (error.retryAfterSec !== null) headers['retry-after'] = String(error.retryAfterSec)
        send(response, error.status, { error: error.code, detail: error.message, ...error.extra }, headers)
        return
      }
      log(`${request.method} ${url.pathname}: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`)
      if (response.headersSent) response.destroy()
      else send(response, 500, { error: 'internal' })
    }
  })
}
