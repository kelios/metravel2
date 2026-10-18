/**
 * Поиск по индексу: косинус (векторы нормализованы → скалярное произведение), top-k фрагментов,
 * и оценка модели на наборе запросов (recall@k по источникам, латентность запроса).
 */
import type { Embedder } from './embed.ts'
import type { ChunkRecord, IndexArtifact } from './format.ts'

export interface Hit {
  index: number
  score: number
  chunk: ChunkRecord
}

export function topK(query: ArrayLike<number>, artifact: IndexArtifact, k: number): Hit[] {
  const { dim, count } = artifact.manifest
  if (query.length !== dim) throw new Error(`query dim ${query.length} ≠ index dim ${dim}`)
  if (k <= 0) return []
  const { vectors } = artifact
  const best: Array<{ index: number; score: number }> = []
  for (let row = 0; row < count; row += 1) {
    let dot = 0
    const offset = row * dim
    for (let i = 0; i < dim; i += 1) dot += vectors[offset + i] * query[i]
    if (best.length < k) {
      best.push({ index: row, score: dot })
      best.sort((a, b) => b.score - a.score)
    } else if (dot > best[best.length - 1].score) {
      best[best.length - 1] = { index: row, score: dot }
      best.sort((a, b) => b.score - a.score)
    }
  }
  return best.map((item) => ({ ...item, chunk: artifact.chunks[item.index] }))
}

export const sourceKey = (chunk: Pick<ChunkRecord, 'type' | 'source_id'>) => `${chunk.type}:${chunk.source_id}`

/** Top-k по источникам: фрагменты одной статьи/квеста (любой локали) схлопываются в лучший. */
export function topSources(hits: Hit[], k: number): Hit[] {
  const seen = new Set<string>()
  const out: Hit[] = []
  for (const hit of hits) {
    const key = sourceKey(hit.chunk)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(hit)
    if (out.length >= k) break
  }
  return out
}

export async function search(embedder: Embedder, artifact: IndexArtifact, text: string, k = 5): Promise<Hit[]> {
  const vector = await embedder.embedQuery(text)
  return topK(vector, artifact, k)
}

export function formatHit(hit: Hit, snippet = 140): string {
  const text = hit.chunk.text.replace(/\s+/g, ' ')
  return `${hit.score.toFixed(3)}  ${hit.chunk.type}:${hit.chunk.source_id} [${hit.chunk.locale}] ${hit.chunk.url}\n       ${hit.chunk.title}\n       ${text.slice(0, snippet)}${text.length > snippet ? '…' : ''}`
}

export interface EvalQuery {
  query: string
  /** Ожидаемые источники в формате `travel:<id>` / `quest:<id>`; достаточно одного совпадения. */
  expect: string[]
}

export interface EvalQueryResult {
  query: string
  hit: boolean
  rank: number | null
  latencyMs: number
  top: string[]
}

export interface EvalSummary {
  model: string
  queries: number
  /** Глубина выдачи по источникам, для которой считается recallAtK. */
  k: number
  recallAt1: number
  recallAtK: number
  mrr: number
  latencyP50Ms: number
  latencyP95Ms: number
  results: EvalQueryResult[]
}

function percentile(values: number[], p: number): number {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))
  return sorted[index]
}

export async function evaluate(embedder: Embedder, artifact: IndexArtifact, queries: EvalQuery[], k = 5): Promise<EvalSummary> {
  const results: EvalQueryResult[] = []
  // Прогрев: первый запрос платит за инициализацию сессии и не входит в замер.
  await embedder.embedQuery('прогрев')
  for (const item of queries) {
    const started = process.hrtime.bigint()
    const vector = await embedder.embedQuery(item.query)
    const latencyMs = Number(process.hrtime.bigint() - started) / 1e6
    const sources = topSources(topK(vector, artifact, k * 8), k)
    const keys = sources.map((hit) => sourceKey(hit.chunk))
    const rankIndex = keys.findIndex((key) => item.expect.includes(key))
    results.push({
      query: item.query,
      hit: rankIndex >= 0,
      rank: rankIndex >= 0 ? rankIndex + 1 : null,
      latencyMs,
      top: sources.map((hit) => `${sourceKey(hit.chunk)} ${hit.chunk.title}`),
    })
  }
  const latencies = results.map((r) => r.latencyMs)
  const n = results.length || 1
  return {
    model: artifact.manifest.model,
    queries: results.length,
    k,
    recallAt1: results.filter((r) => r.rank === 1).length / n,
    recallAtK: results.filter((r) => r.hit).length / n,
    mrr: results.reduce((sum, r) => sum + (r.rank ? 1 / r.rank : 0), 0) / n,
    latencyP50Ms: percentile(latencies, 50),
    latencyP95Ms: percentile(latencies, 95),
    results,
  }
}
