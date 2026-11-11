/**
 * Факты источников для `facts.jsonl` индекса (#3287): raw-слепок каталога → записи `SourceFacts`.
 *
 * Те же `questFactsOf` / `travelFactsOf`, которыми экран читает каталог (`api/aiAssist/sourceFacts.ts`),
 * поэтому запись индекса и карточка экрана получают одни и те же значения. Квест лежит в raw на
 * нескольких локалях, факты у него общие — запись одна.
 */
import fs from 'node:fs'
import path from 'node:path'

import { questFactsOf, type SourceFacts, travelFactsOf } from '../../api/aiAssist/sourceFacts.ts'
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

export function buildTravelFacts(raw: RawTravel, dictionaries: RawDictionaries = emptyDictionaries()): SourceFacts {
  return travelFactsOf(raw.id, {
    number_days: raw.number_days,
    month: raw.month,
    transports: namesOf(raw.transports, dictionaries.transports),
    categories: namesOf(raw.categories, dictionaries.categories),
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
export function buildCorpusFacts(travels: RawTravel[], quests: RawQuest[], dictionaries: RawDictionaries = emptyDictionaries()): SourceFacts[] {
  const facts: SourceFacts[] = travels.map((travel) => buildTravelFacts(travel, dictionaries))
  const seen = new Set<number>()
  for (const quest of quests) {
    if (seen.has(quest.id)) continue
    seen.add(quest.id)
    facts.push(buildQuestFacts(quest))
  }
  return facts
}
