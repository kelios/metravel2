/**
 * Свежесть слепка контента (#3288): индекс и всё, что из него посчитано, устаревают молча —
 * новая статья просто не находится. Проверка сравнивает возраст сборки с порогом и число
 * статей и квестов слепка с каталогом сайта. `checkFreshness` — чистая функция: дату и числа каталога даёт вызывающий.
 */
import fs from 'node:fs'
import path from 'node:path'
import { CHUNKS_FILE, type ChunkRecord, countSources, type IndexManifest, type IndexSourceCounts, indexAgeDays, MANIFEST_FILE, readJsonl } from './format.ts'

export const DEFAULT_MAX_AGE_DAYS = 7
/** Допустимое расхождение числа источников с каталогом: пустая статья без фрагментов в индекс не попадает. */
export const DEFAULT_TOLERANCE = 0.02

export interface FreshnessSubject {
  built_at: string
  sources?: IndexSourceCounts | null
}

export interface FreshnessOptions {
  maxAgeDays?: number
  tolerance?: number
  /** Числа каталога; `null` или отсутствие — проверяется только возраст (режим без сети). */
  catalog?: IndexSourceCounts | null
  now?: number
}

export interface FreshnessReport {
  ok: boolean
  age_days: number | null
  index: IndexSourceCounts | null
  catalog: IndexSourceCounts | null
  /** Доля расхождения с каталогом по каждому типу; `null` — сверка с каталогом не делалась. */
  drift: IndexSourceCounts | null
  problems: string[]
}

const share = (index: number, catalog: number) => Math.abs(index - catalog) / Math.max(1, catalog)

export function checkFreshness(subject: FreshnessSubject, options: FreshnessOptions = {}): FreshnessReport {
  const maxAgeDays = options.maxAgeDays ?? DEFAULT_MAX_AGE_DAYS
  const tolerance = options.tolerance ?? DEFAULT_TOLERANCE
  const problems: string[] = []
  const age = indexAgeDays(subject.built_at, options.now)
  if (age === null) problems.push(`дата сборки не читается: "${subject.built_at}"`)
  else if (age > maxAgeDays) problems.push(`слепок собран ${age} дн. назад при пороге ${maxAgeDays}`)

  const index = subject.sources ?? null
  const catalog = options.catalog ?? null
  let drift: IndexSourceCounts | null = null
  if (catalog) {
    if (!index) {
      problems.push('в слепке нет числа источников: пересоберите его текущим сборщиком')
    } else {
      drift = { travel: share(index.travel, catalog.travel), quest: share(index.quest, catalog.quest) }
      const percent = (value: number) => `${(value * 100).toFixed(1)} %`
      if (drift.travel > tolerance) {
        problems.push(`статей в слепке ${index.travel}, в каталоге ${catalog.travel} — расхождение ${percent(drift.travel)} при пороге ${percent(tolerance)}`)
      }
      if (drift.quest > tolerance) {
        problems.push(`квестов в слепке ${index.quest}, в каталоге ${catalog.quest} — расхождение ${percent(drift.quest)} при пороге ${percent(tolerance)}`)
      }
    }
  }
  return { ok: problems.length === 0, age_days: age, index, catalog, drift, problems }
}

/**
 * Что проверяем: производный файл с полями `index_built_at` и `sources` (слепок «похожих»,
 * `public/assets/data/ai-similar.json`) или сам индекс в каталоге артефакта.
 */
export function readFreshnessSubject(input: { artifactFile?: string; distDir: string }): FreshnessSubject {
  if (input.artifactFile) {
    if (!fs.existsSync(input.artifactFile)) throw new Error(`freshness: нет файла ${input.artifactFile}`)
    const body = JSON.parse(fs.readFileSync(input.artifactFile, 'utf8')) as { index_built_at?: unknown; sources?: IndexSourceCounts | null }
    return { built_at: String(body.index_built_at ?? ''), sources: body.sources ?? null }
  }
  const manifestFile = path.join(input.distDir, MANIFEST_FILE)
  if (!fs.existsSync(manifestFile)) throw new Error(`freshness: нет ${manifestFile}: сначала \`npm run ai:index -- build\``)
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8')) as IndexManifest
  // Артефакт, собранный до #3288, числа источников не несёт — считаем по фрагментам.
  const sources = manifest.sources ?? countSources(readJsonl<ChunkRecord>(path.join(input.distDir, CHUNKS_FILE)))
  return { built_at: manifest.built_at, sources }
}
