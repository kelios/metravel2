import { indexMaps } from '@/scripts/ai-assist/index'
import { normalizeQuery, rrfMerge, snippet, sourceVector, vectorSources } from '@/scripts/ai-assist/search'
import { chunkId, type ChunkRecord, type IndexArtifact, sourceSha256 } from '@/scripts/ai-index/format'
import { topK } from '@/scripts/ai-index/query'

import { DIM, fakeVector, loadFixtureIndex } from './fixture'

describe('metravel-assist: search', () => {
  const index = loadFixtureIndex()

  it('snippet режет по границе слова и схлопывает пробелы', () => {
    expect(snippet('  один\n  два   три ')).toBe('один два три')
    const long = Array.from({ length: 60 }, (_, i) => `слово${i}`).join(' ')
    const cut = snippet(long, 50)
    expect(cut.endsWith('…')).toBe(true)
    expect(cut.length).toBeLessThanOrEqual(51)
    expect(cut.slice(0, -1).endsWith(' ')).toBe(false)
  })

  it('normalizeQuery не плодит ключи кэша из-за регистра и пробелов', () => {
    expect(normalizeQuery('  Замки   под КРАКОВОМ ')).toBe('замки под краковом')
    expect(normalizeQuery('й'.normalize('NFD'))).toBe('й'.normalize('NFC'))
  })

  it('vectorSources схлопывает источники и исключает заданный', () => {
    const vector = fakeVector('рождественские ярмарки краков вроцлав гданьск')
    const all = vectorSources(index, { vector, locale: 'ru', limit: 10 })
    expect(all[0].chunk.source_id).toBe(816)
    expect(new Set(all.map((hit) => `${hit.chunk.type}:${hit.chunk.source_id}`)).size).toBe(all.length)
    const without = vectorSources(index, { vector, locale: 'ru', limit: 10, excludeSource: 'travel:816' })
    expect(without.some((hit) => hit.chunk.type === 'travel' && hit.chunk.source_id === 816)).toBe(false)
  })

  it('sourceVector — нормализованное среднее фрагментов источника, по локали если она есть', () => {
    const vector = sourceVector(index, 'travel:816', 'ru')!
    expect(vector).toHaveLength(8)
    expect(Math.hypot(...vector)).toBeCloseTo(1, 5)
    const pl = sourceVector(index, 'quest:1', 'pl')!
    expect(Array.from(pl)).toEqual(Array.from(fakeVector('квест гродно замок фарный костёл задание pl')).map((v) => expect.closeTo(v, 2))) // vectors.f16 хранит binary16
    expect(sourceVector(index, 'travel:1', 'ru')).toBeNull()
  })

  it('vectorSources расширяет скан, когда один источник занимает весь первый срез', () => {
    // Источник A — 70 почти одинаковых фрагментов ближе всех к запросу, затем 25 одиночных статей.
    const query = fakeVector('горы озеро тропа')
    const chunks: ChunkRecord[] = []
    const vectors: Float32Array[] = []
    const push = (sourceId: number, text: string, vector: Float32Array) => {
      chunks.push({ id: chunkId('travel', sourceId, 'ru', text), type: 'travel', source_id: sourceId, url: `u${sourceId}`, title: `t${sourceId}`, city: null, country: null, lat: null, lng: null, month: [], tags: [], locale: 'ru', text })
      vectors.push(vector)
    }
    for (let i = 0; i < 70; i += 1) push(1, `a${i}`, query.map((v, j) => v + (j === i % DIM ? 0.001 * i : 0)))
    for (let i = 0; i < 25; i += 1) push(100 + i, `b${i}`, fakeVector(`статья ${i} горы`))
    const flat = new Float32Array(chunks.length * DIM)
    vectors.forEach((vector, row) => flat.set(vector, row * DIM))
    const artifact: IndexArtifact = { manifest: { model: 'fake', dim: DIM, count: chunks.length, built_at: '', source_sha256: sourceSha256(chunks) }, chunks, vectors: flat }
    const index = { artifact, ...indexMaps(artifact) }
    // limit 20, type travel → первый скан 80 строк: 70 строк A + 10 других = 11 источников < 20.
    const hits = vectorSources(index, { vector: query, locale: 'ru', type: 'travel', limit: 20 })
    expect(hits).toHaveLength(20)
    expect(hits[0].chunk.source_id).toBe(1)
    expect(new Set(hits.map((hit) => hit.chunk.source_id)).size).toBe(20)
    // Просят больше, чем источников вообще: отдаём все 26 без зацикливания.
    expect(vectorSources(index, { vector: query, locale: 'ru', type: 'travel', limit: 40 })).toHaveLength(26)
    expect(vectorSources(index, { vector: query, locale: 'ru', limit: 20 }).length).toBe(20)
    expect(vectorSources(index, { vector: query, locale: 'ru', type: 'quest', limit: 5 })).toEqual([])
  })

  it('topK совпадает с полной сортировкой (порядок равных — по строке) и учитывает accept', () => {
    const count = 300
    const chunks = Array.from({ length: count }, (_, row) => ({ ...index.artifact.chunks[row % index.artifact.chunks.length] }))
    const vectors = new Float32Array(count * DIM)
    // Значения из 7 уровней: много равных скоров проверяют стабильность вставки.
    for (let i = 0; i < vectors.length; i += 1) vectors[i] = ((i * 7919) % 7) / 7
    const artifact: IndexArtifact = { manifest: { model: 'fake', dim: DIM, count, built_at: '', source_sha256: '' }, chunks, vectors }
    const query = Float32Array.from({ length: DIM }, (_, i) => (i % 3) - 1)
    const scores = Array.from({ length: count }, (_, row) => {
      let dot = 0
      for (let i = 0; i < DIM; i += 1) dot += vectors[row * DIM + i] * query[i]
      return { index: row, score: dot }
    })
    const expected = (accept: (row: number) => boolean, k: number) =>
      scores.filter((item) => accept(item.index)).sort((a, b) => b.score - a.score || a.index - b.index).slice(0, k)
    for (const k of [1, 7, 50, count, count + 10]) {
      expect(topK(query, artifact, k).map(({ index, score }) => ({ index, score }))).toEqual(expected(() => true, k))
      const even = (row: number) => row % 2 === 0
      expect(topK(query, artifact, k, even).map(({ index, score }) => ({ index, score }))).toEqual(expected(even, k))
    }
  })

  it('rrfMerge: источник из обоих списков выше любого из одного, порядок стабилен', () => {
    const vector = vectorSources(index, { vector: fakeVector('зубры лес велосипед беловежская пуща дети'), locale: 'ru', limit: 10 })
    const lexical = [
      { source_id: 761, title: 'Ойцувский парк', url: 'https://metravel.by/travels/761', city: 'Ойцув', country: 'Польша' },
      { source_id: 791, title: 'Беловежская пуща', url: 'https://metravel.by/travels/791', city: 'Каменюки', country: 'Беларусь' },
    ]
    const merged = rrfMerge(vector, lexical, index, 3)
    expect(merged).toHaveLength(3)
    expect(merged.map((item) => item.source_id).slice(0, 2).sort()).toEqual([761, 791])
    expect(merged[0].score).not.toBeNull()
    expect(rrfMerge(vector, lexical, index, 3)).toEqual(merged)
    expect(rrfMerge([], [], index, 5)).toEqual([])
  })
})
