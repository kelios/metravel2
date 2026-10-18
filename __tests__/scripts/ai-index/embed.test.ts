import { createHash } from 'crypto'
import fs from 'fs'
import os from 'os'
import path from 'path'

import { planEmbedding, runEmbed, type Embedder } from '@/scripts/ai-index/embed'
import { chunkId, readIndex, type ChunkRecord } from '@/scripts/ai-index/format'
import { EMBEDDING_MODELS, type EmbeddingModelSpec } from '@/scripts/ai-index/models'
import { evaluate, search, topK, topSources } from '@/scripts/ai-index/query'

const DIM = 8

const makeChunk = (sourceId: number, text: string, type: ChunkRecord['type'] = 'travel'): ChunkRecord => ({
  id: chunkId(type, sourceId, 'ru', text),
  type,
  source_id: sourceId,
  url: `https://metravel.by/${type}s/${sourceId}`,
  title: `${type} ${sourceId}`,
  city: null,
  country: null,
  lat: null,
  lng: null,
  month: [],
  tags: [],
  locale: 'ru',
  text,
})

/** Детерминированный «эмбеддер»: вектор из sha256 текста, нормализованный; одинаковые слова → близкие векторы. */
function fakeVector(text: string): Float32Array {
  const vector = new Float32Array(DIM)
  for (const word of text.toLowerCase().split(/\s+/)) {
    const digest = createHash('sha256').update(word).digest()
    for (let i = 0; i < DIM; i += 1) vector[i] += digest[i] / 255 - 0.5
  }
  const norm = Math.hypot(...vector) || 1
  return vector.map((v) => v / norm)
}

function fakeEmbedder(calls: string[] = []): Embedder {
  const spec: EmbeddingModelSpec = {
    key: 'fake-model',
    hfId: 'test/fake',
    dim: DIM,
    dtype: 'q8',
    recipe: 'pooled',
    pooling: 'mean',
    formatDocument: ({ text }) => text,
    formatQuery: (query) => query,
  }
  return {
    spec,
    async embedDocuments(chunks) {
      chunks.forEach((chunk) => calls.push(chunk.text))
      return chunks.map((chunk) => fakeVector(spec.formatDocument(chunk)))
    },
    async embedQuery(query) {
      return fakeVector(spec.formatQuery(query))
    },
    async dispose() {},
  }
}

describe('ai-index models: рецепт вектора — контракт', () => {
  it('EmbeddingGemma берёт штатный sentence_embedding, Qwen3 — last_token по last_hidden_state', () => {
    expect(EMBEDDING_MODELS['embeddinggemma-300m']).toMatchObject({ dim: 768, dtype: 'q8', recipe: 'sentence_embedding' })
    expect(EMBEDDING_MODELS['qwen3-embedding-0.6b']).toMatchObject({ dim: 1024, dtype: 'q8', recipe: 'pooled', pooling: 'last_token' })
    for (const spec of Object.values(EMBEDDING_MODELS)) {
      expect(spec.formatQuery('q')).not.toBe(spec.formatDocument({ title: 't', text: 'q' }))
    }
  })
})

describe('ai-index embed: инкремент', () => {
  let distDir: string
  beforeEach(() => {
    distDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-index-embed-'))
  })
  afterEach(() => {
    fs.rmSync(distDir, { recursive: true, force: true })
  })

  it('planEmbedding переиспользует векторы той же модели по id и считает только новые', () => {
    const chunks = [makeChunk(1, 'замок над рекой'), makeChunk(2, 'озеро в лесу')]
    const previous = {
      manifest: { model: 'fake-model', dim: 2, count: 2, built_at: '', source_sha256: '' },
      chunks: [makeChunk(2, 'озеро в лесу'), makeChunk(3, 'старый текст')],
      vectors: Float32Array.from([0.6, 0.8, 1, 0]),
    }
    const plan = planEmbedding(chunks, previous, 'fake-model')
    expect(plan.compute.map((c) => c.source_id)).toEqual([1])
    expect(plan.reuse.get(chunks[1].id)).toEqual(Float32Array.from([0.6, 0.8]))
    const other = planEmbedding(chunks, { ...previous, manifest: { ...previous.manifest, model: 'other' } }, 'fake-model')
    expect(other.compute).toHaveLength(2)
    expect(other.reuse.size).toBe(0)
    expect(planEmbedding(chunks, null, 'fake-model').compute).toHaveLength(2)
    // Тот же текст под новым заголовком — другой документ для модели, вектор не переиспользуется.
    const retitled = [chunks[0], { ...chunks[1], title: 'новый заголовок' }]
    expect(planEmbedding(retitled, previous, 'fake-model').compute.map((c) => c.source_id)).toEqual([1, 2])
  })

  it('runEmbed: повторный запуск без изменений пересчитывает 0, изменённый фрагмент — только его', async () => {
    const chunks = [makeChunk(1, 'замок над рекой'), makeChunk(2, 'озеро в лесу'), makeChunk(3, 'горная тропа')]
    const calls: string[] = []
    const embedder = fakeEmbedder(calls)
    const log: string[] = []
    const first = await runEmbed({ chunks, distDir, embedder, log: (l) => log.push(l) })
    expect(first).toMatchObject({ computed: 3, reused: 0, count: 3 })
    expect(calls).toHaveLength(3)
    const artifact = readIndex(distDir)!
    expect(artifact.manifest).toMatchObject({ model: 'fake-model', dim: DIM, count: 3 })
    expect(artifact.chunks.map((c) => c.id)).toEqual(chunks.map((c) => c.id))

    calls.length = 0
    const second = await runEmbed({ chunks, distDir, embedder, log: (l) => log.push(l) })
    expect(second).toMatchObject({ computed: 0, reused: 3, count: 3 })
    expect(calls).toHaveLength(0)
    expect(log.some((line) => line.includes('пересчитано 0 фрагментов'))).toBe(true)
    expect(readIndex(distDir)!.manifest.source_sha256).toBe(artifact.manifest.source_sha256)

    const changed = [chunks[0], makeChunk(2, 'озеро в лесу и болото'), chunks[2]]
    calls.length = 0
    const third = await runEmbed({ chunks: changed, distDir, embedder, log: () => {} })
    expect(third).toMatchObject({ computed: 1, reused: 2, count: 3 })
    expect(calls).toEqual(['озеро в лесу и болото'])
    const updated = readIndex(distDir)!
    expect(Array.from(updated.vectors.subarray(0, DIM)).map((v) => v.toFixed(2))).toEqual(
      Array.from(artifact.vectors.subarray(0, DIM)).map((v) => v.toFixed(2)),
    )
    expect(updated.manifest.source_sha256).not.toBe(artifact.manifest.source_sha256)

    const full = await runEmbed({ chunks: changed, distDir, embedder, full: true, log: () => {} })
    expect(full).toMatchObject({ computed: 3, reused: 0 })
  })
})

describe('ai-index query: поиск и оценка', () => {
  it('topK отдаёт ближайшие фрагменты, topSources схлопывает источник', async () => {
    const chunks = [
      makeChunk(1, 'замок над рекой Неман'),
      makeChunk(1, 'замок и костёл в местечке'),
      makeChunk(2, 'озеро в лесу и купание'),
      makeChunk(3, 'квест по старому городу', 'quest'),
    ]
    const embedder = fakeEmbedder()
    const vectors = await embedder.embedDocuments(chunks)
    const flat = new Float32Array(chunks.length * DIM)
    vectors.forEach((v, i) => flat.set(v, i * DIM))
    const artifact = {
      manifest: { model: 'fake-model', dim: DIM, count: chunks.length, built_at: '', source_sha256: '' },
      chunks,
      vectors: flat,
    }
    const hits = topK(await embedder.embedQuery('замок над рекой Неман'), artifact, 3)
    expect(hits).toHaveLength(3)
    expect(hits[0].chunk.text).toBe('замок над рекой Неман')
    expect(hits[0].score).toBeCloseTo(1, 5)
    expect(hits[0].score).toBeGreaterThanOrEqual(hits[1].score)
    expect(() => topK(new Float32Array(3), artifact, 1)).toThrow(/dim/)
    expect(topK(await embedder.embedQuery('замок'), artifact, 0)).toEqual([])

    const viaSearch = await search(embedder, artifact, 'замок над рекой Неман', 4)
    expect(topSources(viaSearch, 2).map((hit) => hit.chunk.source_id)).toHaveLength(2)
    expect(new Set(topSources(viaSearch, 4).map((hit) => `${hit.chunk.type}:${hit.chunk.source_id}`)).size).toBe(3)

    const summary = await evaluate(
      embedder,
      artifact,
      [
        { query: 'замок над рекой Неман', expect: ['travel:1'] },
        { query: 'озеро в лесу и купание', expect: ['travel:2', 'travel:9'] },
        { query: 'совершенно другое', expect: ['quest:404'] },
      ],
      2,
    )
    expect(summary.queries).toBe(3)
    expect(summary.recallAt1).toBeCloseTo(2 / 3, 5)
    expect(summary.k).toBe(2)
    expect(summary.recallAtK).toBeCloseTo(2 / 3, 5)
    expect(summary.mrr).toBeCloseTo(2 / 3, 5)
    expect(summary.results[2]).toMatchObject({ hit: false, rank: null })
    expect(summary.results[0].top[0]).toContain('travel:1')
    expect(summary.latencyP50Ms).toBeGreaterThanOrEqual(0)
  })
})
