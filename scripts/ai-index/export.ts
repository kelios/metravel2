/**
 * Экспорт корпуса из публичного API в raw/: статьи (publish && moderation) и квесты во всех
 * доступных локалях. Пауза между запросами и собственный User-Agent, чтобы не грузить один
 * vCPU прода. Инкремент: статья перечитывается только при изменении updated_at в списке;
 * у квестов API не отдаёт updated_at, поэтому детали перечитываются всегда, а запись на диск
 * идёт только при изменении содержимого (sha256 ответа).
 */
import fs from 'node:fs'
import path from 'node:path'
import { QUEST_LOCALES } from '../../utils/questLocaleRouting.js'
import { buildQuestChunks, buildTravelChunks, type ChunkOptions, isPublishedTravel, type RawQuest, type RawTravel } from './chunk.ts'
import { type ChunkRecord, sha256Hex } from './format.ts'

export const DEFAULT_API_BASE = 'https://metravel.by/api'
export const USER_AGENT = 'metravel-ai-index/1.0 (+https://metravel.by)'
export const DEFAULT_PAUSE_MS = 500
export const TRAVEL_PAGE_SIZE = 50

const TRAVEL_FIELDS: Array<keyof RawTravel> = [
  'id',
  'slug',
  'title',
  'name',
  'meta_description',
  'description',
  'plus',
  'minus',
  'recommendation',
  'countryName',
  'cityName',
  'coordsMeTravel',
  'categories',
  'month',
  'year',
  'publish',
  'moderation',
  'updated_at',
]

export interface ExportState {
  /** id статьи → updated_at из списка на момент последнего успешного экспорта детали. */
  travels: Record<string, string>
  /** `${id}:${locale}` квеста → sha256 сохранённого payload. */
  quests: Record<string, string>
  exported_at?: string
}

export interface TravelListItem {
  id: number
  updated_at?: string | null
  publish?: unknown
  moderation?: unknown
}

export interface TravelExportPlan {
  fetch: number[]
  keep: number[]
  remove: number[]
}

export const emptyState = (): ExportState => ({ travels: {}, quests: {} })

/** Чистая функция инкремента статей: что перечитать, что оставить, что удалить. */
export function planTravelExport(
  items: TravelListItem[],
  state: ExportState,
  options: { full?: boolean; hasRaw?: (id: number) => boolean } = {},
): TravelExportPlan {
  const published = items.filter(isPublishedTravel)
  const present = new Set(published.map((item) => item.id))
  const fetch: number[] = []
  const keep: number[] = []
  for (const item of published) {
    const known = state.travels[String(item.id)]
    const rawExists = options.hasRaw ? options.hasRaw(item.id) : true
    const unchanged = !options.full && known !== undefined && known === (item.updated_at ?? '') && rawExists
    if (unchanged) keep.push(item.id)
    else fetch.push(item.id)
  }
  const remove = Object.keys(state.travels)
    .map(Number)
    .filter((id) => !present.has(id))
  return { fetch, keep, remove }
}

export interface Fetcher {
  (url: string): Promise<unknown>
}

export interface ExportOptions {
  apiBase?: string
  rawDir: string
  pauseMs?: number
  full?: boolean
  /** Ограничение числа статей и квестов (smoke-прогон). */
  limit?: number
  locales?: readonly string[]
  fetcher?: Fetcher
  log?: (line: string) => void
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export function createFetcher(options: { pauseMs: number; retries?: number; userAgent?: string }): Fetcher {
  const retries = options.retries ?? 4
  return async (url: string) => {
    let lastError: unknown
    for (let attempt = 0; attempt < retries; attempt += 1) {
      try {
        const response = await fetch(url, {
          headers: { 'User-Agent': options.userAgent ?? USER_AGENT, Accept: 'application/json' },
        })
        if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
        const data = await response.json()
        await sleep(options.pauseMs)
        return data
      } catch (error) {
        lastError = error
        await sleep(options.pauseMs * 2 ** attempt + 1000)
      }
    }
    throw new Error(`GET ${url} failed after ${retries} attempts: ${String(lastError)}`)
  }
}

function pick<T extends object>(source: T, fields: Array<keyof T>): Partial<T> {
  const out: Partial<T> = {}
  for (const field of fields) if (field in source) out[field] = source[field]
  return out
}

async function* paginate(
  fetcher: Fetcher,
  apiBase: string,
  resource: string,
  params: Record<string, string | number>,
): AsyncGenerator<Record<string, unknown>> {
  let page = 1
  for (;;) {
    const query = new URLSearchParams({ ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])), page: String(page) })
    const data = (await fetcher(`${apiBase}${resource}?${query.toString()}`)) as Record<string, unknown>
    const results = (data.results ?? data.data ?? []) as Record<string, unknown>[]
    for (const item of results) yield item
    if (!data.next || results.length === 0) break
    page += 1
  }
}

export function readState(rawDir: string): ExportState {
  const file = path.join(rawDir, 'state.json')
  if (!fs.existsSync(file)) return emptyState()
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<ExportState>
  return { travels: parsed.travels ?? {}, quests: parsed.quests ?? {}, exported_at: parsed.exported_at }
}

/**
 * Индекс собирается из файлов raw/, а удаление идёт по state: файл без записи в state (прерванный
 * прогон до чекпойнта) берётся под учёт с пустой отметкой — перечитается, если источник жив,
 * и удалится, если пропал.
 */
function trackRawFiles(rawDir: string, state: ExportState): void {
  for (const name of fs.readdirSync(path.join(rawDir, 'travels'))) {
    if (name.endsWith('.json')) state.travels[String(Number.parseInt(name, 10))] ??= ''
  }
  for (const name of fs.readdirSync(path.join(rawDir, 'quests'))) {
    const [id, locale] = name.split('.')
    if (name.endsWith('.json')) state.quests[`${Number.parseInt(id, 10)}:${locale}`] ??= ''
  }
}

export function writeState(rawDir: string, state: ExportState): void {
  fs.mkdirSync(rawDir, { recursive: true })
  fs.writeFileSync(path.join(rawDir, 'state.json'), `${JSON.stringify(state, null, 2)}\n`)
}

export const travelRawFile = (rawDir: string, id: number) => path.join(rawDir, 'travels', `${id}.json`)
export const questRawFile = (rawDir: string, id: number, locale: string) =>
  path.join(rawDir, 'quests', `${id}.${locale}.json`)

export function readRawTravels(rawDir: string): RawTravel[] {
  const dir = path.join(rawDir, 'travels')
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .sort((a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10))
    .map((name) => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')) as RawTravel)
}

export function readRawQuests(rawDir: string): RawQuest[] {
  const dir = path.join(rawDir, 'quests')
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .sort((a, b) => {
      const [idA, localeA] = a.split('.')
      const [idB, localeB] = b.split('.')
      return Number.parseInt(idA, 10) - Number.parseInt(idB, 10) || localeA.localeCompare(localeB)
    })
    .map((name) => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')) as RawQuest)
}

export interface ExportSummary {
  travels: { listed: number; fetched: number; kept: number; removed: number }
  quests: { listed: number; fetched: number; changed: number; removed: number }
}

export async function runExport(options: ExportOptions): Promise<ExportSummary> {
  const apiBase = options.apiBase ?? DEFAULT_API_BASE
  const pauseMs = options.pauseMs ?? DEFAULT_PAUSE_MS
  const fetcher = options.fetcher ?? createFetcher({ pauseMs })
  const log = options.log ?? ((line: string) => console.error(line))
  const locales = options.locales ?? QUEST_LOCALES
  const { rawDir } = options
  fs.mkdirSync(path.join(rawDir, 'travels'), { recursive: true })
  fs.mkdirSync(path.join(rawDir, 'quests'), { recursive: true })
  // --full перечитывает всё, но state нужен и ему: по нему удаляются снятые с публикации источники.
  const state = readState(rawDir)
  trackRawFiles(rawDir, state)
  const summary: ExportSummary = {
    travels: { listed: 0, fetched: 0, kept: 0, removed: 0 },
    quests: { listed: 0, fetched: 0, changed: 0, removed: 0 },
  }

  const travelItems: TravelListItem[] = []
  for await (const item of paginate(fetcher, apiBase, '/travels/', { page_size: TRAVEL_PAGE_SIZE })) {
    travelItems.push(item as unknown as TravelListItem)
    if (options.limit && travelItems.length >= options.limit) break
  }
  summary.travels.listed = travelItems.length
  const plan = planTravelExport(travelItems, state, {
    full: options.full,
    hasRaw: (id) => fs.existsSync(travelRawFile(rawDir, id)),
  })
  const listedById = new Map(travelItems.map((item) => [item.id, item]))
  // --limit видит только начало списка: остальное не «пропало», удалять его нельзя (как у квестов).
  const remove = options.limit ? [] : plan.remove
  log(`travels: в списке ${travelItems.length}, перечитать ${plan.fetch.length}, без изменений ${plan.keep.length}, удалить ${remove.length}`)
  for (const id of remove) {
    fs.rmSync(travelRawFile(rawDir, id), { force: true })
    delete state.travels[String(id)]
    summary.travels.removed += 1
  }
  summary.travels.kept = plan.keep.length
  for (const [index, id] of plan.fetch.entries()) {
    const detail = (await fetcher(`${apiBase}/travels/${id}/`)) as RawTravel
    if (!isPublishedTravel(detail)) {
      fs.rmSync(travelRawFile(rawDir, id), { force: true })
      delete state.travels[String(id)]
      summary.travels.removed += 1
      continue
    }
    fs.writeFileSync(travelRawFile(rawDir, id), JSON.stringify(pick(detail, TRAVEL_FIELDS)))
    state.travels[String(id)] = listedById.get(id)?.updated_at ?? ''
    summary.travels.fetched += 1
    if ((index + 1) % 25 === 0 || index + 1 === plan.fetch.length) {
      log(`travels: ${index + 1}/${plan.fetch.length}`)
      writeState(rawDir, state)
    }
  }

  const questItems: Record<string, unknown>[] = []
  for await (const item of paginate(fetcher, apiBase, '/quests/', {})) {
    questItems.push(item)
    if (options.limit && questItems.length >= options.limit) break
  }
  summary.quests.listed = questItems.length
  const expectedKeys = new Set<string>()
  const total = questItems.reduce((sum, item) => {
    const available = (item.available_locales as string[] | undefined) ?? ['ru']
    return sum + locales.filter((locale) => available.includes(locale)).length
  }, 0)
  log(`quests: в списке ${questItems.length}, деталей к чтению ${total}`)
  let done = 0
  for (const meta of questItems) {
    const id = meta.id as number
    const available = (meta.available_locales as string[] | undefined) ?? ['ru']
    for (const locale of locales) {
      if (!available.includes(locale)) continue
      const key = `${id}:${locale}`
      expectedKeys.add(key)
      const detail = (await fetcher(`${apiBase}/quests/${id}/?lang=${locale}`)) as Record<string, unknown>
      const intro = (detail.intro ?? {}) as Record<string, unknown>
      const steps = ((detail.steps ?? []) as Record<string, unknown>[]).map((step) =>
        pick(step, ['step_id', 'title', 'location', 'story', 'task', 'hint', 'lat', 'lng', 'order'] as never[]),
      )
      const raw: RawQuest = {
        id,
        quest_id: (detail.quest_id ?? meta.quest_id ?? null) as string | null,
        title: (detail.title ?? null) as string | null,
        content_locale: (detail.content_locale ?? locale) as string,
        city: (detail.city ?? meta.city ?? null) as RawQuest['city'],
        city_name: (meta.city_name ?? null) as string | null,
        country_name: (meta.country_name ?? null) as string | null,
        lat: (meta.lat ?? null) as number | null,
        lng: (meta.lng ?? null) as number | null,
        tags: (meta.tags ?? null) as RawQuest['tags'],
        intro: pick(intro, ['title', 'story', 'task'] as never[]) as RawQuest['intro'],
        steps: steps as RawQuest['steps'],
        finale_text: (((detail.finale ?? {}) as Record<string, unknown>).text ?? null) as string | null,
      }
      const body = JSON.stringify(raw)
      const sha = sha256Hex(body)
      summary.quests.fetched += 1
      if (options.full || state.quests[key] !== sha || !fs.existsSync(questRawFile(rawDir, id, locale))) {
        fs.writeFileSync(questRawFile(rawDir, id, locale), body)
        state.quests[key] = sha
        summary.quests.changed += 1
      }
      done += 1
      if (done % 50 === 0 || done === total) {
        log(`quests: ${done}/${total}`)
        writeState(rawDir, state)
      }
    }
  }
  if (!options.limit) {
    for (const key of Object.keys(state.quests)) {
      if (expectedKeys.has(key)) continue
      const [id, locale] = key.split(':')
      // Узкий `--locales` ограничивает чтение, а не состав индекса: чужие локали не трогаем.
      if (!locales.includes(locale)) continue
      fs.rmSync(questRawFile(rawDir, Number(id), locale), { force: true })
      delete state.quests[key]
      summary.quests.removed += 1
    }
  }
  state.exported_at = new Date().toISOString()
  writeState(rawDir, state)
  return summary
}

export interface CorpusChunks {
  chunks: ChunkRecord[]
  travels: number
  quests: number
}

/** raw/ → записи индекса; `locales` ограничивает квесты (например, ['ru'] для замеров). */
export function chunkRawCorpus(rawDir: string, options: ChunkOptions = {}, locales?: readonly string[]): CorpusChunks {
  const travels = readRawTravels(rawDir)
  const quests = readRawQuests(rawDir).filter((quest) => !locales || locales.includes(quest.content_locale || 'ru'))
  const chunks: ChunkRecord[] = []
  for (const travel of travels) chunks.push(...buildTravelChunks(travel, {}, options))
  for (const quest of quests) chunks.push(...buildQuestChunks(quest, options))
  return { chunks, travels: travels.length, quests: quests.length }
}
