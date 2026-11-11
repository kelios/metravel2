/**
 * Слепок «похожих» (#3292): соседи каждой статьи и квеста, посчитанные заранее тем же кодом,
 * что `GET /ai/similar`. Блоки «Похожие статьи» на странице статьи и «Статьи по городу» на
 * странице квеста читают его обычным статическим файлом — служба и модель на сервере не нужны.
 *
 * Форма рассчитана на один небольшой файл: карточка статьи хранится один раз (`cards`), а у
 * источника — только список id соседей. Соседи — всегда статьи: оба блока сайта просят
 * `result_type=travel`. Сериализация стабильная (ключи по возрастанию id, запись на строку),
 * чтобы правка одной статьи давала в git короткий diff.
 */
import { type IndexSourceCounts, countSources } from '../ai-index/format.ts'
import type { LoadedIndex } from './index.ts'
import { itemForRow, similarHits } from './search.ts'

export const SIMILAR_ARTIFACT_VERSION = 1
/** Столько соседей просит самый большой блок сайта (страница статьи); квест показывает первые три. */
export const SIMILAR_ARTIFACT_LIMIT = 6

export interface SimilarCard {
  title: string
  url: string
  city: string | null
  country: string | null
  cover: string | null
}

export interface SimilarArtifact {
  version: typeof SIMILAR_ARTIFACT_VERSION
  /** Дата сборки индекса, из которого посчитан слепок: по ней проверяется свежесть (#3288). */
  index_built_at: string
  sources: IndexSourceCounts
  limit: number
  /** Карточки статей-соседей по id статьи. */
  cards: Record<string, SimilarCard>
  /** id статьи → id похожих статей по убыванию близости. */
  travel: Record<string, number[]>
  /** id квеста → id статей по смыслу квеста. */
  quest: Record<string, number[]>
}

const byNumericKey = (a: string, b: string) => Number(a) - Number(b)

export function buildSimilarArtifact(index: LoadedIndex, options: { limit?: number } = {}): SimilarArtifact {
  const limit = options.limit ?? SIMILAR_ARTIFACT_LIMIT
  const { manifest, chunks } = index.artifact
  const artifact: SimilarArtifact = {
    version: SIMILAR_ARTIFACT_VERSION,
    index_built_at: manifest.built_at,
    sources: manifest.sources ?? countSources(chunks),
    limit,
    cards: {},
    travel: {},
    quest: {},
  }
  for (const key of index.rowsBySource.keys()) {
    const [type, id] = key.split(':')
    if (type !== 'travel' && type !== 'quest') continue
    // Локаль ru: соседи — статьи, а они есть только на русском; у квеста берутся его ru-фрагменты
    // (или единственная локаль, если русской нет) — так же считает служба для ru-страницы.
    const hits = similarHits(index, { key, locale: 'ru', resultType: 'travel', limit }) ?? []
    if (!hits.length) continue
    artifact[type][id] = hits.map((hit) => {
      const item = itemForRow(index, hit.index, null)
      const cardId = String(item.source_id)
      artifact.cards[cardId] ??= { title: item.title, url: item.url, city: item.city, country: item.country, cover: item.cover }
      return item.source_id
    })
  }
  return artifact
}

const sortedLines = <T>(record: Record<string, T>): string =>
  Object.keys(record)
    .sort(byNumericKey)
    .map((key) => `    ${JSON.stringify(key)}: ${JSON.stringify(record[key])}`)
    .join(',\n')

/** JSON с одной записью на строку и ключами по возрастанию id — одинаковый вход даёт одинаковый файл. */
export function serializeSimilarArtifact(artifact: SimilarArtifact): string {
  const section = (name: 'cards' | 'travel' | 'quest') => `  ${JSON.stringify(name)}: {\n${sortedLines(artifact[name] as Record<string, unknown>)}\n  }`
  return [
    '{',
    `  "version": ${JSON.stringify(artifact.version)},`,
    `  "index_built_at": ${JSON.stringify(artifact.index_built_at)},`,
    `  "sources": ${JSON.stringify(artifact.sources)},`,
    `  "limit": ${JSON.stringify(artifact.limit)},`,
    `${section('cards')},`,
    `${section('travel')},`,
    section('quest'),
    '}',
    '',
  ].join('\n')
}
