/**
 * Схема плана по дням для `POST /ai/plan` (#3298) — по образцу схемы фильтра карты (`osmFilterSchema.ts`):
 * модель отвечает JSON `{days: [{items: [{source, id, hours}]}], note}`, служба не верит ни одному полю,
 * пока оно не прошло проверку.
 *
 * Что проверяется:
 *   - на верхнем уровне только `days` и `note`; `days` — непустой список, не длиннее запрошенного числа дней;
 *   - день — объект с полем `items`: непустой список не длиннее `PLAN_SCHEMA_MAX_ITEMS`. Необязательное
 *     строковое поле `note` в дне принимается и отбрасывается: модель продукта повторяет в дне верхнее
 *     поле `note` (24 ответа из 54 в пробе 15.11.2026) — это безвредное лишнее поле, а не обход: в ответ
 *     службы оно не идёт. Любой другой ключ дня — не по схеме;
 *   - материал — ровно `source` (`travel` или `quest`), `id` (положительное целое) и `hours`; пара
 *     `source:id` обязана быть среди карточек подсказки и встречаться в плане один раз;
 *   - `hours` — число от `PLAN_SCHEMA_MIN_HOURS` до `PLAN_SCHEMA_MAX_HOURS`;
 *   - `note` — строка не длиннее `PLAN_NOTE_MAX_CHARS` (может отсутствовать). Посетителю фраза модели не
 *     показывается: это непроверенный текст, он остаётся только в `trace` контура оценки.
 *
 * Названия, адреса и координаты модель не пишет: их подставляет служба из индекса по `source:id`. Текст
 * вокруг JSON (ограда ```json```, вводная фраза) не мешает — берётся первый объект ответа.
 */
import { extractJsonObject } from './osmFilterSchema.ts'

export const PLAN_SOURCES = ['travel', 'quest'] as const
export type PlanSource = (typeof PLAN_SOURCES)[number]

/** Больше материалов в одном дне схема не принимает; сколько из них останется, решает доводка. */
export const PLAN_SCHEMA_MAX_ITEMS = 8
export const PLAN_SCHEMA_MIN_HOURS = 0.25
export const PLAN_SCHEMA_MAX_HOURS = 12
export const PLAN_NOTE_MAX_CHARS = 400

export interface RawPlanItem {
  source: PlanSource
  id: number
  hours: number
}
export interface RawPlan {
  days: Array<{ items: RawPlanItem[] }>
  /** Фраза модели к плану — только для `trace`; посетителю не показывается. */
  note: string
}

export interface PlanSchemaOptions {
  /** Карточки подсказки ключами `travel:816`, `quest:13` — других материалов в плане быть не может. */
  allowed: ReadonlySet<string>
  /** Запрошенное число дней: план длиннее — не по схеме. */
  maxDays: number
}

const isPlainObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const show = (value: unknown): string => {
  try {
    return JSON.stringify(value)?.slice(0, 60) ?? String(value)
  } catch {
    return String(value)
  }
}

const TOP_KEYS = ['days', 'note']
const DAY_KEYS = ['items', 'note']
const ITEM_KEYS = ['source', 'id', 'hours']

/** Проблемы разобранного плана против схемы; `[]` — план годен. */
export function validateTripPlan(obj: unknown, options: PlanSchemaOptions): string[] {
  if (!isPlainObject(obj)) return ['not an object']
  const errors: string[] = []
  for (const key of Object.keys(obj)) if (!TOP_KEYS.includes(key)) errors.push(`unknown key ${show(key)}`)
  if ('note' in obj && (typeof obj.note !== 'string' || [...obj.note].length > PLAN_NOTE_MAX_CHARS)) errors.push(`note must be a string up to ${PLAN_NOTE_MAX_CHARS} chars`)
  const days = obj.days
  if (!Array.isArray(days) || days.length === 0) return [...errors, 'days must be a non-empty list']
  if (days.length > options.maxDays) errors.push(`days: ${days.length} more than requested ${options.maxDays}`)
  const seen = new Set<string>()
  days.forEach((day, dayIndex) => {
    const at = `days[${dayIndex}]`
    if (!isPlainObject(day)) {
      errors.push(`${at} must be an object`)
      return
    }
    for (const key of Object.keys(day)) if (!DAY_KEYS.includes(key)) errors.push(`${at}: unknown key ${show(key)}`)
    // Фраза модели в дне: принимается только строкой и дальше не идёт.
    if ('note' in day && (typeof day.note !== 'string' || [...day.note].length > PLAN_NOTE_MAX_CHARS)) errors.push(`${at}: note must be a string up to ${PLAN_NOTE_MAX_CHARS} chars`)
    const items = day.items
    if (!Array.isArray(items) || items.length === 0) {
      errors.push(`${at}.items must be a non-empty list`)
      return
    }
    if (items.length > PLAN_SCHEMA_MAX_ITEMS) errors.push(`${at}.items: ${items.length} more than ${PLAN_SCHEMA_MAX_ITEMS}`)
    items.forEach((item, itemIndex) => {
      const where = `${at}.items[${itemIndex}]`
      if (!isPlainObject(item)) {
        errors.push(`${where} must be an object`)
        return
      }
      for (const key of Object.keys(item)) if (!ITEM_KEYS.includes(key)) errors.push(`${where}: unknown key ${show(key)}`)
      for (const key of ITEM_KEYS) if (!(key in item)) errors.push(`${where}: missing ${show(key)}`)
      const { source, id, hours } = item
      const sourceOk = typeof source === 'string' && (PLAN_SOURCES as readonly string[]).includes(source)
      const idOk = typeof id === 'number' && Number.isInteger(id) && id > 0
      if ('source' in item && !sourceOk) errors.push(`${where}: source ${show(source)} not in ${show(PLAN_SOURCES)}`)
      if ('id' in item && !idOk) errors.push(`${where}: id ${show(id)} must be a positive integer`)
      if (sourceOk && idOk) {
        const key = `${source}:${id}`
        if (!options.allowed.has(key)) errors.push(`${where}: ${key} is not among prompt cards`)
        else if (seen.has(key)) errors.push(`${where}: ${key} repeats`)
        seen.add(key)
      }
      if ('hours' in item && !(typeof hours === 'number' && Number.isFinite(hours) && hours >= PLAN_SCHEMA_MIN_HOURS && hours <= PLAN_SCHEMA_MAX_HOURS)) {
        errors.push(`${where}: hours ${show(hours)} out of ${PLAN_SCHEMA_MIN_HOURS}..${PLAN_SCHEMA_MAX_HOURS}`)
      }
    })
  })
  return errors
}

/** Ответ модели → план по схеме; `null` — JSON не найден или не по схеме (`errors` — почему). */
export function parsePlanAnswer(text: string, options: PlanSchemaOptions): { plan: RawPlan | null; errors: string[] } {
  const parsed = extractJsonObject(String(text ?? ''))
  if (parsed === null) return { plan: null, errors: ['no JSON object in answer'] }
  const errors = validateTripPlan(parsed, options)
  if (errors.length) return { plan: null, errors }
  const object = parsed as { days: Array<{ items: RawPlanItem[] }>; note?: string }
  return {
    plan: {
      days: object.days.map((day) => ({ items: day.items.map((item) => ({ source: item.source, id: item.id, hours: item.hours })) })),
      note: typeof object.note === 'string' ? object.note : '',
    },
    errors: [],
  }
}
