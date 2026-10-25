/**
 * HTTP-слой metravel-assist (#2456, #2713) на встроенном `node:http`: четыре эндпоинта, без фреймворка.
 *
 *   POST /ai/search  {q, locale?, type?, limit?}  → {items, took_ms, index_built_at, degraded, cached}
 *   POST /ai/ask     {q, locale?, history?}        → SSE `sources → text* → done` (ask.ts)
 *   GET  /ai/similar?type=&id=&limit=&locale=&result_type= → {items, took_ms, index_built_at}
 *   GET  /ai/health → {ok, model, dim, count, index_built_at, rss_mb, …}
 *
 * Зависимости приходят снаружи (`createApp`), поэтому тесты поднимают сервер на фикстурном
 * индексе с фальшивым эмбеддером и без сети.
 */
import http from 'node:http'

import type { ChunkType } from '../ai-index/format.ts'
import { AI_SOURCES_LIMIT } from '../../api/aiAssist/policy.ts'
import type { AiSource } from '../../api/aiAssist/types.ts'
import { type AskDeps, createAskHandler, type RetrievalResult } from './ask.ts'
import type { ResponseCache } from './cache.ts'
import type { LoadedIndex } from './index.ts'
import type { LexicalHit, LexicalSearch } from './lexical.ts'
import { HttpError, MAX_LIMIT, MAX_QUERY_CHARS, parseLimit, parseLocale, parseQuery, parseType } from './params.ts'
import { BusyError, SingleFlight } from './queue.ts'
import { type Locale, type ResultItem, VECTOR_SOURCES, itemForRow, normalizeQuery, rrfMerge, sourceVector, vectorSources } from './search.ts'

export { MAX_LIMIT, MAX_QUERY_CHARS }

/** Зависимости `/ai/ask`; подбор и очередь к эмбеддингу — общие с `/ai/search`. */
export type AskAppDeps = Omit<AskDeps, 'retrieve' | 'llmQueue' | 'log'>

export interface AppDeps {
  index: LoadedIndex
  modelKey: string
  embedQuery: (q: string) => Promise<ArrayLike<number>>
  lexical: LexicalSearch
  cache: ResponseCache
  queueTimeoutMs: number
  ask: AskAppDeps
  log?: (line: string) => void
}

export interface SearchResponse {
  items: ResultItem[]
  took_ms: number
  index_built_at: string
  degraded: boolean
  cached: boolean
}

export const DEFAULT_LIMIT = 10
export const MAX_BODY_BYTES = 16 * 1024
/** Сколько статей просим у лексики: с запасом относительно limit, но без лишней нагрузки на Django. */
export const LEXICAL_LIMIT = 20

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
  const llmQueue = new SingleFlight()
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
      llm: deps.ask.generator ? 'configured' : 'unconfigured',
      ask_queue: { busy: llmQueue.isBusy, waiting: llmQueue.waiting },
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

  interface HybridQuery {
    q: string
    locale: Locale
    type?: ChunkType
    limit: number
  }

  /** Гибрид «вектор + лексика» без кэша: общий для `/ai/search` и подбора карточек `/ai/ask`. */
  async function hybrid({ q, locale, type, limit }: HybridQuery): Promise<{ items: ResultItem[]; degraded: boolean }> {
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
    return { items: rrfMerge(vectorHits, lexicalHits ?? [], index, limit), degraded: lexicalHits === null }
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

    const { items, degraded } = await hybrid({ q, locale, type, limit })
    const result: SearchResponse = { items, took_ms: elapsedMs(started), index_built_at: manifest.built_at, degraded, cached: false }
    // Деградированный ответ не кэшируем: сбой бэкенда не должен жить в кэше час.
    if (!degraded) await deps.cache.set(cacheKey, JSON.stringify(result))
    return result
  }

  /** Карточки для промпта ассистента: та же форма `AiSource`, что у клиентского подбора. */
  const toSource = (item: ResultItem): AiSource => ({
    type: item.type,
    source_id: String(item.source_id),
    title: item.title,
    url: item.url,
    path: new URL(item.url).pathname,
    snippet: item.snippet,
    score: item.score ?? 0,
  })

  async function retrieve(q: string, locale: Locale): Promise<RetrievalResult> {
    const { items, degraded } = await hybrid({ q, locale, limit: AI_SOURCES_LIMIT })
    return { sources: items.map(toSource), degraded }
  }

  const ask = createAskHandler({ ...deps.ask, retrieve, llmQueue, log })

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
      if (url.pathname === '/ai/ask') {
        if (request.method !== 'POST') throw new HttpError(405, 'method_not_allowed', 'POST /ai/ask')
        await ask(request, response, await readJsonBody(request))
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
        if (response.headersSent) {
          // Поток /ai/ask уже открыт: закрыть честнее, чем дописать JSON в SSE.
          response.destroy()
          return
        }
        const headers: Record<string, string> = error.status === 413 ? { connection: 'close' } : {}
        if (error.retryAfterSec !== null) headers['retry-after'] = String(error.retryAfterSec)
        send(response, error.status, { error: error.code, detail: error.message, ...error.extra }, headers)
        return
      }
      log(`${request.method} ${url.pathname}: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`)
      if (response.headersSent) response.destroy()
      else send(response, 500, { error: 'internal' })
    }
  })
}
