/**
 * Факты источников для `facts.jsonl` индекса (#3287): raw-слепок каталога → записи `SourceFacts`.
 *
 * Те же `questFactsOf` / `travelFactsOf`, которыми экран читает каталог (`api/aiAssist/sourceFacts.ts`),
 * поэтому запись индекса и карточка экрана получают одни и те же значения. Квест лежит в raw на
 * нескольких локалях, факты у него общие — запись одна.
 */
import fs from 'node:fs'
import path from 'node:path'

import { questFactsOf, routeKindOf, routeLengthKm, type SourceFacts, travelFactsOf } from '../../api/aiAssist/sourceFacts.ts'
import { questTags, type RawQuest, type RawTravel } from './chunk.ts'

/** Словари каталога из `/api/getFiltersTravel/`: id → название (RU). */
export interface RawDictionaries {
  transports: Record<string, string>
  categories: Record<string, string>
}

export const DICTIONARIES_FILE = 'dictionaries.json'
export const emptyDictionaries = (): RawDictionaries => ({ transports: {}, categories: {} })

const toNameMap = (value: unknown): Record<string, string> => {
  const out: Record<string, string> = {}
  for (const item of Array.isArray(value) ? value : []) {
    const id = (item as { id?: unknown })?.id
    const name = String((item as { name?: unknown })?.name ?? '').trim()
    if ((typeof id === 'number' || typeof id === 'string') && name) out[String(id)] = name
  }
  return out
}

/** Ответ `/api/getFiltersTravel/` → словари, которые нужны фактам статьи. */
export function parseDictionaries(payload: unknown): RawDictionaries {
  const data = (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>
  return { transports: toNameMap(data.transports), categories: toNameMap(data.categories) }
}

export function readDictionaries(rawDir: string): RawDictionaries {
  const file = path.join(rawDir, DICTIONARIES_FILE)
  if (!fs.existsSync(file)) return emptyDictionaries()
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<RawDictionaries>
  return { transports: parsed.transports ?? {}, categories: parsed.categories ?? {} }
}

/** Названия по id словаря; id без названия пропускается — в запись идут только слова, не номера. */
const namesOf = (ids: unknown, dictionary: Record<string, string>): string[] =>
  (Array.isArray(ids) ? ids : []).map((id) => dictionary[String(id)]).filter((name): name is string => Boolean(name))

/**
 * Длины файлов маршрута статей (#3353): id статьи → длины её файлов, км (`/api/travels/<id>/routes/`,
 * `summary.distance_km`). Лежит отдельным файлом raw-слепка: файл маршрута меняется независимо от статьи.
 */
export type RawRouteLengths = Record<string, number[]>

export const ROUTES_FILE = 'routes.json'

export function readRouteLengths(rawDir: string): RawRouteLengths {
  const file = path.join(rawDir, ROUTES_FILE)
  if (!fs.existsSync(file)) return {}
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as { travels?: RawRouteLengths }
  return parsed.travels ?? {}
}

export function buildTravelFacts(raw: RawTravel, dictionaries: RawDictionaries = emptyDictionaries(), routes: RawRouteLengths = {}): SourceFacts {
  const transports = namesOf(raw.transports, dictionaries.transports)
  const categories = namesOf(raw.categories, dictionaries.categories)
  return travelFactsOf(raw.id, {
    number_days: raw.number_days,
    month: raw.month,
    transports,
    categories,
    // Длина маршрута (#3353): число километров в названии либо единственный файл маршрута статьи.
    distance_km: routeLengthKm({
      title: raw.title ?? raw.name,
      kind: routeKindOf({ categories, transports }),
      number_days: raw.number_days,
      routeFilesKm: routes[String(raw.id)],
    }),
  })
}

export function buildQuestFacts(raw: RawQuest): SourceFacts {
  return questFactsOf(raw.id, {
    points: raw.points,
    duration_min: raw.duration_min,
    difficulty: raw.difficulty,
    pet_friendly: raw.pet_friendly,
    tags: questTags(raw),
  })
}

/** Факты корпуса: по записи на статью и на квест (первая локаль квеста в порядке чтения raw). */
export function buildCorpusFacts(
  travels: RawTravel[],
  quests: RawQuest[],
  dictionaries: RawDictionaries = emptyDictionaries(),
  routes: RawRouteLengths = {},
): SourceFacts[] {
  const facts: SourceFacts[] = travels.map((travel) => buildTravelFacts(travel, dictionaries, routes))
  const seen = new Set<number>()
  for (const quest of quests) {
    if (seen.has(quest.id)) continue
    seen.add(quest.id)
    facts.push(buildQuestFacts(quest))
  }
  return facts
}
