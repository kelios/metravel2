/**
 * Схема фильтра карты для `/ai/intent` (#2887): TS-порт `validate_filter()` и
 * `extract_json()` из `scripts/ai-train/sets/osm_intents.py`.
 *
 * Перечисления (категории POI, радиусы, ограничения) читаются из
 * `scripts/ai-train/osm_filter_schema.json` — того же файла, что держит обучающий
 * набор и страж `__tests__/scripts/ai-train-osm-filter-schema.test.ts` (enum'ы =
 * категории и радиусы карты); здесь ничего не дублируется. Путь — от корня
 * репозитория (`process.cwd()`): так запускаются `npm run ai:assist:dev`, jest и
 * образ (`WORKDIR /app`, Dockerfile копирует файл схемы рядом с кодом).
 *
 * Сообщения об ошибках повторяют Python до символа (repr значений — `pyRepr`):
 * тест эквивалентности сравнивает списки ошибок двух реализаций на одних фикстурах.
 */
import fs from 'node:fs'
import path from 'node:path'

export const OSM_FILTER_SCHEMA_PATH = path.resolve(process.cwd(), 'scripts/ai-train/osm_filter_schema.json')

interface OsmFilterSchema {
  required: string[]
  properties: {
    categories: { items: { enum: string[] } }
    radius_km: { enum: number[] }
    center: unknown
    constraints: { properties: Record<string, unknown> }
  }
}

export const OSM_FILTER_SCHEMA = JSON.parse(fs.readFileSync(OSM_FILTER_SCHEMA_PATH, 'utf8')) as OsmFilterSchema
export const OSM_FILTER_KEYS: readonly string[] = Object.keys(OSM_FILTER_SCHEMA.properties)
export const OSM_FILTER_REQUIRED: readonly string[] = OSM_FILTER_SCHEMA.required
export const OSM_FILTER_CATEGORIES: readonly string[] = OSM_FILTER_SCHEMA.properties.categories.items.enum
export const OSM_FILTER_RADII: readonly number[] = OSM_FILTER_SCHEMA.properties.radius_km.enum
export const OSM_FILTER_CONSTRAINTS: readonly string[] = Object.keys(OSM_FILTER_SCHEMA.properties.constraints.properties)

/** Валидный фильтр: ровно то, что модель обязана вернуть. */
export interface OsmFilterIntent {
  categories: string[]
  radius_km: number
  center: { name: string } | null
  constraints: Record<string, boolean>
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** `repr()` Python для значений из JSON: строки, числа, bool, null, списки, объекты. */
export function pyRepr(value: unknown): string {
  if (value === null || value === undefined) return 'None'
  if (typeof value === 'boolean') return value ? 'True' : 'False'
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return value > 0 ? 'inf' : value < 0 ? '-inf' : 'nan'
    // JSON `50.0` в Python остаётся float и печатается как `50.0`; из JS эта разница
    // потеряна — фикстуры теста эквивалентности целые числа пишут без дробной части.
    if (Number.isInteger(value)) return String(value)
    return String(value)
  }
  if (typeof value === 'string') {
    const escaped = value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/\t/g, '\\t')
    if (escaped.includes("'") && !escaped.includes('"')) return `"${escaped}"`
    return `'${escaped.replace(/'/g, "\\'")}'`
  }
  if (Array.isArray(value)) return `[${value.map(pyRepr).join(', ')}]`
  if (isPlainObject(value)) return `{${Object.entries(value).map(([k, v]) => `${pyRepr(k)}: ${pyRepr(v)}`).join(', ')}}`
  return String(value)
}

/** Проблемы разобранного фильтра против схемы (`[]` — валиден); порядок и текст — как у Python. */
export function validateOsmFilter(obj: unknown): string[] {
  const errors: string[] = []
  if (!isPlainObject(obj)) return ['not an object']
  for (const key of Object.keys(obj)) {
    if (!OSM_FILTER_KEYS.includes(key)) errors.push(`unknown key ${pyRepr(key)}`)
  }
  for (const key of OSM_FILTER_REQUIRED) {
    if (!(key in obj)) errors.push(`missing ${pyRepr(key)}`)
  }
  if ('categories' in obj) {
    const cats = obj.categories
    if (!Array.isArray(cats) || cats.length === 0) {
      errors.push('categories must be a non-empty list')
    } else {
      const bad = cats.filter((c) => !OSM_FILTER_CATEGORIES.includes(c as string))
      if (bad.length) errors.push(`unknown categories ${pyRepr(bad)}`)
      if (new Set(cats.map((c) => pyStr(c))).size !== cats.length) errors.push('categories repeat')
    }
  }
  if ('radius_km' in obj) {
    const radius = obj.radius_km
    if (typeof radius === 'boolean' || !OSM_FILTER_RADII.includes(radius as number)) {
      errors.push(`radius_km ${pyRepr(radius)} not in ${pyRepr([...OSM_FILTER_RADII])}`)
    }
  }
  if ('center' in obj && obj.center !== null) {
    const centre = obj.center
    const keys = isPlainObject(centre) ? Object.keys(centre) : null
    const name = isPlainObject(centre) ? centre.name : undefined
    if (!keys || keys.length !== 1 || keys[0] !== 'name' || typeof name !== 'string' || [...name].length < 2) {
      errors.push('center must be null or {"name": str}')
    }
  }
  if ('constraints' in obj) {
    const cons = obj.constraints
    if (!isPlainObject(cons)) {
      errors.push('constraints must be an object')
    } else {
      for (const [k, v] of Object.entries(cons)) {
        if (!OSM_FILTER_CONSTRAINTS.includes(k)) errors.push(`unknown constraint ${pyRepr(k)}`)
        else if (typeof v !== 'boolean') errors.push(`constraint ${pyRepr(k)} must be boolean`)
      }
    }
  }
  return errors
}

/** `str()` Python для элементов списка категорий: повтор ищется по строковому виду. */
function pyStr(value: unknown): string {
  if (typeof value === 'string') return value
  return pyRepr(value)
}

/**
 * Первый `{...}` в ответе модели (в ```json```-ограде или в тексте), как
 * `json.JSONDecoder.raw_decode` с каждой `{`: берётся сбалансированный фрагмент с
 * учётом строк и экранирования, негодный — пропускается. Нет объекта — `null`.
 */
export function extractJsonObject(text: string): unknown | null {
  for (let start = text.indexOf('{'); start !== -1; start = text.indexOf('{', start + 1)) {
    const end = balancedEnd(text, start)
    if (end === -1) continue
    try {
      const parsed: unknown = JSON.parse(text.slice(start, end + 1))
      if (isPlainObject(parsed)) return parsed
    } catch {
      // следующая открывающая скобка
    }
  }
  return null
}

function balancedEnd(text: string, start: number): number {
  let depth = 0
  let inString = false
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i]
    if (inString) {
      if (ch === '\\') i += 1
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') inString = true
    else if (ch === '{' || ch === '[') depth += 1
    else if (ch === '}' || ch === ']') {
      depth -= 1
      if (depth === 0) return ch === '}' ? i : -1
    }
  }
  return -1
}

/** Валидный объект → фильтр с обязательным `constraints` (пустой объект, если модель его опустила). */
export function toOsmFilterIntent(obj: Record<string, unknown>): OsmFilterIntent {
  return {
    categories: [...(obj.categories as string[])],
    radius_km: obj.radius_km as number,
    center: obj.center === null ? null : { name: (obj.center as { name: string }).name },
    constraints: { ...((obj.constraints as Record<string, boolean> | undefined) ?? {}) },
  }
}
