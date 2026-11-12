import { indexMaps } from '@/scripts/ai-assist/index'
import { helpHits, normalizeQuery, rrfMerge, snippet, sourceVector, vectorSources } from '@/scripts/ai-assist/search'
import { chunkId, type ChunkRecord, type IndexArtifact, sourceSha256, writeIndex } from '@/scripts/ai-index/format'
import { topK } from '@/scripts/ai-index/query'

import { makeTempDir } from '../cli-test-utils'
import { DIM, fakeVector, loadFixtureIndex, MODEL } from './fixture'

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
    const artifact: IndexArtifact = { manifest: { model: 'fake', dim: DIM, count: chunks.length, built_at: '', source_sha256: sourceSha256(chunks) }, chunks, vectors: flat, facts: [] }
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
    const artifact: IndexArtifact = { manifest: { model: 'fake', dim: DIM, count, built_at: '', source_sha256: '' }, chunks, vectors, facts: [] }
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

describe('metravel-assist: helpHits — порядок записей справки (#3293, замер r2)', () => {
  /** Вектор с заданной близостью к вопросу: вопрос — первая ось, остаток уходит в ось `axis`. */
  const toward = (cosine: number, axis: number): Float32Array => {
    const vector = new Float32Array(DIM)
    vector[0] = cosine
    vector[axis] = Math.sqrt(1 - cosine * cosine)
    return vector
  }
  const question = toward(1, 1)
  const rows: Array<{ chunk: ChunkRecord; vector: Float32Array }> = []
  const add = (type: ChunkRecord['type'], sourceId: number, locale: string, tags: string[], text: string, cosine: number) =>
    rows.push({
      chunk: { id: chunkId(type, sourceId, locale, text), type, source_id: sourceId, url: 'https://metravel.by/quests', title: text, city: null, country: null, lat: null, lng: null, month: [], tags, locale, text, cover: null, ...(type === 'help' ? { answer: `ответ записи ${sourceId}` } : {}) },
      vector: toward(cosine, 1 + (rows.length % (DIM - 1))),
    })
  // «Ці ёсць у квэсце падказкі?» (lv91): у записи об ошибке в квесте одна формулировка чуть ближе (0,64),
  // у записи о подсказках близки и формулировки, и ответ.
  add('help', 31, 'ru', ['help-quest-report', 'обратная связь'], 'В квесте неправильный ответ, куда писать?', 0.64)
  add('help', 31, 'ru', ['help-quest-report', 'обратная связь', 'answer'], 'Напишите через форму на странице контактов.', 0.2)
  add('help', 30, 'ru', ['help-quest-hints', 'квесты'], 'Есть ли в квесте подсказки?', 0.61)
  add('help', 30, 'ru', ['help-quest-hints', 'квесты'], 'Что делать, если не могу ответить на вопрос?', 0.63)
  add('help', 30, 'ru', ['help-quest-hints', 'квесты'], 'Можно ли пропустить задание?', 0.3)
  add('help', 30, 'ru', ['help-quest-hints', 'квесты', 'answer'], 'Откройте подсказку на карточке точки.', 0.55)
  add('help', 30, 'pl', ['help-quest-hints', 'квесты'], 'Czy w queście są podpowiedzi?', 0.9)
  add('help', 30, 'pl', ['help-quest-hints', 'квесты', 'answer'], 'Otwórz podpowiedź na karcie punktu.', 0.8)
  // Запись без фрагмента ответа (индекс, собранный до доранжирования) — балл по одной формулировке.
  add('help', 5, 'ru', ['help-how-to-register', 'цена и регистрация'], 'Как зарегистрироваться?', 0.5)
  // Материал справке не мешает, как бы близок ни был.
  add('quest', 9, 'ru', [], 'Квест по Гродно', 1)
  const dist = makeTempDir('ai-assist-help-')
  writeIndex(dist, { model: MODEL, dim: DIM, chunks: rows.map((row) => row.chunk), vectors: rows.map((row) => row.vector), builtAt: '2026-11-12T00:00:00.000Z' })
  const index = loadFixtureIndex(dist)
  const brief = (locale: 'ru' | 'pl') => helpHits(index, question, locale).map((hit) => ({ id: index.artifact.chunks[hit.row].source_id, title: index.artifact.chunks[hit.row].title, cosine: Number(hit.cosine.toFixed(2)), score: Number(hit.score.toFixed(2)), topic: hit.topic }))

  it('первой встаёт запись, близкая целиком (две формулировки и ответ), а не та, у которой ближе одна формулировка', () => {
    expect(brief('ru')).toEqual([
      { id: 30, title: 'Что делать, если не могу ответить на вопрос?', cosine: 0.63, score: 1.17, topic: 'квесты' },
      { id: 31, title: 'В квесте неправильный ответ, куда писать?', cosine: 0.64, score: 0.84, topic: 'обратная связь' },
      { id: 5, title: 'Как зарегистрироваться?', cosine: 0.5, score: 0.5, topic: 'цена и регистрация' },
    ])
  })

  it('запись берётся на языке вопроса, если переведена; непереведённая — на русском', () => {
    expect(brief('pl')).toEqual([
      { id: 30, title: 'Czy w queście są podpowiedzi?', cosine: 0.9, score: 1.7, topic: 'квесты' },
      { id: 31, title: 'В квесте неправильный ответ, куда писать?', cosine: 0.64, score: 0.84, topic: 'обратная связь' },
      { id: 5, title: 'Как зарегистрироваться?', cosine: 0.5, score: 0.5, topic: 'цена и регистрация' },
    ])
  })
})
