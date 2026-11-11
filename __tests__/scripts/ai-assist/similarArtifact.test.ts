/**
 * #3292: слепок «похожих» считается тем же кодом, что `GET /ai/similar`, и сериализуется стабильно.
 */
import { loadIndex, type LoadedIndex } from '@/scripts/ai-assist/index'
import { itemForRow, similarHits } from '@/scripts/ai-assist/search'
import { buildSimilarArtifact, serializeSimilarArtifact, SIMILAR_ARTIFACT_LIMIT } from '@/scripts/ai-assist/similarArtifact'

import { MODEL, writeFixtureIndex } from './fixture'

let index: LoadedIndex

beforeAll(async () => {
  index = await loadIndex(writeFixtureIndex(MODEL), { expectedModel: MODEL, attempts: 1 })
})

describe('слепок «похожих» (#3292)', () => {
  it('несёт дату сборки индекса и число источников — по ним проверяется свежесть', () => {
    const artifact = buildSimilarArtifact(index)
    expect(artifact).toMatchObject({ version: 1, index_built_at: '2026-10-18T16:48:48.951Z', sources: { travel: 3, quest: 2 }, limit: SIMILAR_ARTIFACT_LIMIT })
  })

  it('соседи каждого источника — те же статьи в том же порядке, что отдаёт служба', () => {
    const artifact = buildSimilarArtifact(index)
    expect(Object.keys(artifact.travel).sort()).toEqual(['761', '791', '816'])
    expect(Object.keys(artifact.quest).sort()).toEqual(['1', '2'])
    for (const [type, lists] of [['travel', artifact.travel], ['quest', artifact.quest]] as const) {
      for (const [id, neighbours] of Object.entries(lists)) {
        const hits = similarHits(index, { key: `${type}:${id}`, locale: 'ru', resultType: 'travel', limit: SIMILAR_ARTIFACT_LIMIT })
        expect(neighbours).toEqual(hits?.map((hit) => hit.chunk.source_id))
        // Сам источник среди соседей не стоит, соседи — только статьи.
        if (type === 'travel') expect(neighbours).not.toContain(Number(id))
        for (const neighbour of neighbours) expect(artifact.cards[String(neighbour)]).toBeDefined()
      }
    }
  })

  it('карточка соседа — поля карточки подбора без фрагмента текста', () => {
    const artifact = buildSimilarArtifact(index)
    const hit = similarHits(index, { key: 'travel:816', locale: 'ru', resultType: 'travel', limit: 1 })?.[0]
    expect(hit).toBeDefined()
    const item = itemForRow(index, hit!.index, null)
    expect(artifact.cards[String(item.source_id)]).toEqual({ title: item.title, url: item.url, city: item.city, country: item.country, cover: item.cover })
  })

  it('лимит соседей задаётся; без соседей источник в слепок не попадает', () => {
    const one = buildSimilarArtifact(index, { limit: 1 })
    expect(one.limit).toBe(1)
    for (const neighbours of [...Object.values(one.travel), ...Object.values(one.quest)]) expect(neighbours).toHaveLength(1)
  })

  it('сериализация стабильна: ключи по возрастанию id, запись на строку, обратный разбор даёт тот же объект', () => {
    const artifact = buildSimilarArtifact(index)
    const body = serializeSimilarArtifact(artifact)
    expect(JSON.parse(body)).toEqual(artifact)
    expect(serializeSimilarArtifact(JSON.parse(body))).toBe(body)
    expect(body.endsWith('}\n')).toBe(true)
    const travelKeys = [...body.matchAll(/^ {4}"(\d+)": \[/gm)].map((match) => Number(match[1]))
    expect(travelKeys.slice(0, 3)).toEqual([761, 791, 816])
    // Переставленные ключи входа дают тот же файл.
    const shuffled = { ...artifact, travel: Object.fromEntries(Object.entries(artifact.travel).reverse()), cards: Object.fromEntries(Object.entries(artifact.cards).reverse()) }
    expect(serializeSimilarArtifact(shuffled)).toBe(body)
  })
})
