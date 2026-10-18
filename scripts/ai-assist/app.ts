/**
 * HTTP-слой metravel-assist (#2456) на встроенном `node:http`: три эндпоинта, без фреймворка.
 *
 *   POST /ai/search  {q, locale?, type?, limit?}  → {items, took_ms, index_built_at, degraded, cached}
 *   GET  /ai/similar?type=&id=&limit=&locale=&result_type= → {items, took_ms, index_built_at}
 *   GET  /ai/health → {ok, model, dim, count, index_built_at, rss_mb, …}
 *
 * Зависимости приходят снаружи (`createApp`), поэтому тесты поднимают сервер на фикстурном
 * индексе с фальшивым эмбеддером и без сети.
 */
import http from 'node:http'

import type { ChunkType } from '../ai-index/format.ts'
import type { ResponseCache } from './cache.ts'
import type { LoadedIndex } from './index.ts'
import type { LexicalHit, LexicalSearch } from './lexical.ts'
import { BusyError, SingleFlight } from './queue.ts'
import {
  LOCALES,
  type Locale,
  type ResultItem,
  VECTOR_SOURCES,
  itemForRow,
  normalizeQuery,
  rrfMerge,
  sourceVector,
  vectorSources,
} from './search.ts'

export interface AppDeps {
  index: LoadedIndex
  modelKey: string
  embedQuery: (q: string) => Promise<ArrayLike<number>>
  lexical: LexicalSearch
  cache: ResponseCache
  queueTimeoutMs: number
  log?: (line: string) => void
}

export interface SearchResponse {
  items: ResultItem[]
  took_ms: number
  index_built_at: string
  degraded: boolean
  cached: boolean
}

export const MAX_QUERY_CHARS = 500
export const MAX_LIMIT = 20
export const DEFAULT_LIMIT = 10
export const MAX_BODY_BYTES = 16 * 1024
/** Сколько статей просим у лексики: с запасом относительно limit, но без лишней нагрузки на Django. */
export const LEXICAL_LIMIT = 20

class HttpError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, detail?: string) {
    super(detail ?? code)
    this.status = status
    this.code = code
  }
}

const TYPES: ReadonlySet<string> = new Set<ChunkType>(['travel', 'quest'])

function parseLocale(value: unknown): Locale {
  if (value === undefined || value === null || value === '') return 'ru'
  if (typeof value === 'string' && (LOCALES as readonly string[]).includes(value)) return value as Locale
  throw new HttpError(400, 'bad_request', `locale: ожидалось одно из ${LOCALES.join(', ')}`)
}

function parseType(value: unknown, field = 'type'): ChunkType | undefined {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value === 'string' && TYPES.has(value)) return value as ChunkType
  throw new HttpError(400, 'bad_request', `${field}: ожидалось travel или quest`)
}

function parseLimit(value: unknown, fallback: number): number {
  if (value === undefined || value === null || value === '') return fallback
  const limit = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new HttpError(400, 'bad_request', `limit: целое от 1 до ${MAX_LIMIT}`)
  }
  return limit
}

function parseQuery(value: unknown): string {
  if (typeof value !== 'string') throw new HttpError(400, 'bad_request', 'q: обязательная строка')
  const q = value.trim()
  if (!q) throw new HttpError(400, 'bad_request', 'q: пустой запрос')
  if (q.length > MAX_QUERY_CHARS) throw new HttpError(400, 'bad_request', `q: не длиннее ${MAX_QUERY_CHARS} символов`)
  return q
}

function readJsonBody(request: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    let tooLarge = false
    request.on('data', (chunk: Buffer) => {
      if (tooLarge) return
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        // Сокет не рвём: клиент должен получить 413, остаток тела Node отбросит сам
        // (ответ уходит с connection: close).
        tooLarge = true
        chunks.length = 0
        reject(new HttpError(413, 'payload_too_large', `тело больше ${MAX_BODY_BYTES} байт`))
        return
      }
      chunks.push(chunk)
    })
    request.on('end', () => {
      if (tooLarge) return
      const raw = Buffer.concat(chunks).toString('utf8').trim()
      if (!raw) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(raw))
      } catch {
        reject(new HttpError(400, 'bad_request', 'тело запроса — не JSON'))
      }
    })
    request.on('error', reject)
  })
}

const elapsedMs = (started: bigint) => Math.round(Number(process.hrtime.bigint() - started) / 1e4) / 100

export function createApp(deps: AppDeps): http.Server {
  const { index } = deps
  const { manifest } = index.artifact
  const log = deps.log ?? ((line: string) => console.error(line))
  const queue = new SingleFlight()
  const startedAt = Date.now()
  const cachePrefix = `ai-assist:v1:${deps.modelKey}:${manifest.source_sha256.slice(0, 16)}`

  const send = (response: http.ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) => {
    const payload = JSON.stringify(body)
    response.writeHead(status, {
      'content-type': 'application/json; charset=utf-8',
      'content-length': Buffer.byteLength(payload),
      'cache-control': 'no-store',
      ...headers,
    })
    response.end(payload)
  }

  const health = () => {
    const memory = process.memoryUsage()
    return {
      ok: true,
      model: deps.modelKey,
      dim: manifest.dim,
      count: manifest.count,
      index_built_at: manifest.built_at,
      rss_mb: Math.round(memory.rss / 1048576),
      heap_mb: Math.round(memory.heapUsed / 1048576),
      uptime_s: Math.round((Date.now() - startedAt) / 1000),
      queue: { busy: queue.isBusy, waiting: queue.waiting },
      cache: deps.cache.stats(),
    }
  }

  async function search(body: unknown): Promise<SearchResponse> {
    const started = process.hrtime.bigint()
    const input = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
    const q = parseQuery(input.q)
    const locale = parseLocale(input.locale)
    const type = parseType(input.type)
    const limit = parseLimit(input.limit, DEFAULT_LIMIT)
    const cacheKey = `${cachePrefix}:${locale}:${type ?? '*'}:${limit}:${normalizeQuery(q)}`

    const cached = await deps.cache.get(cacheKey)
    if (cached) {
      const parsed = JSON.parse(cached) as SearchResponse
      return { ...parsed, took_ms: elapsedMs(started), cached: true }
    }

    // Лексика — только для статей (бэкенд ищет travels) и стартует уже внутри слота очереди,
    // параллельно с эмбеддингом: запрос, который не дождётся слота (503 busy), не должен
    // запускать поиск в Django на том же vCPU. Отказ лексики → null (degraded) сразу, чтобы
    // промис не стал unhandled rejection при ошибке модели или поиска.
    let lexicalPromise: Promise<LexicalHit[] | null> = Promise.resolve([])
    let vector: ArrayLike<number>
    try {
      vector = await queue.run(deps.queueTimeoutMs, () => {
        if (type !== 'quest') lexicalPromise = deps.lexical(q, LEXICAL_LIMIT).catch(() => null)
        return deps.embedQuery(q)
      })
    } catch (error) {
      if (error instanceof BusyError) throw new HttpError(503, 'busy', error.message)
      throw error
    }
    const vectorHits = vectorSources(index, { vector, locale, type, limit: VECTOR_SOURCES })
    const lexicalHits = await lexicalPromise
    const degraded = lexicalHits === null
    const items = rrfMerge(vectorHits, lexicalHits ?? [], index, limit)
    const result: SearchResponse = { items, took_ms: elapsedMs(started), index_built_at: manifest.built_at, degraded, cached: false }
    // Деградированный ответ не кэшируем: сбой бэкенда не должен жить в кэше час.
    if (!degraded) await deps.cache.set(cacheKey, JSON.stringify(result))
    return result
  }

  function similar(params: URLSearchParams) {
    const started = process.hrtime.bigint()
    const type = parseType(params.get('type'))
    if (!type) throw new HttpError(400, 'bad_request', 'type: обязательно travel или quest')
    const id = Number(params.get('id'))
    if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'bad_request', 'id: положительное целое')
    const limit = parseLimit(params.get('limit'), 6)
    const locale = parseLocale(params.get('locale'))
    const resultType = parseType(params.get('result_type'), 'result_type')
    const key = `${type}:${id}`
    const vector = sourceVector(index, key, locale)
    if (!vector) throw new HttpError(404, 'not_found', `${key} нет в индексе`)
    const hits = vectorSources(index, { vector, locale, type: resultType, excludeSource: key, limit })
    return {
      items: hits.map((hit) => itemForRow(index, hit.index, hit.score)),
      took_ms: elapsedMs(started),
      index_built_at: manifest.built_at,
    }
  }

  return http.createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost')
    try {
      if (url.pathname === '/ai/health') {
        if (request.method !== 'GET') throw new HttpError(405, 'method_not_allowed')
        send(response, 200, health())
        return
      }
      if (url.pathname === '/ai/search') {
        if (request.method !== 'POST') throw new HttpError(405, 'method_not_allowed', 'POST /ai/search')
        send(response, 200, await search(await readJsonBody(request)))
        return
      }
      if (url.pathname === '/ai/similar') {
        if (request.method !== 'GET') throw new HttpError(405, 'method_not_allowed')
        // Ответ зависит только от индекса: его можно отдавать из HTTP-кэша до следующей сборки.
        send(response, 200, similar(url.searchParams), { 'cache-control': 'public, max-age=3600' })
        return
      }
      throw new HttpError(404, 'not_found')
    } catch (error) {
      if (error instanceof HttpError) {
        send(response, error.status, { error: error.code, detail: error.message }, error.status === 413 ? { connection: 'close' } : {})
        return
      }
      log(`${request.method} ${url.pathname}: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`)
      send(response, 500, { error: 'internal' })
    }
  })
}
