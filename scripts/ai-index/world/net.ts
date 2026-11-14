/**
 * Сеть сборки внешнего индекса маршрутов (#3357): один поток, пауза между запросами, сырой ответ на
 * диске. Повторный запуск читает кэш и в сеть не ходит — открытые сервисы (Wikidata, Overpass, AWS S3,
 * NASA POWER) видят каждый адрес один раз. Клиент называется нейтрально: ни проекта, ни домена, ни почты.
 */
import fs from 'node:fs'
import path from 'node:path'

export const USER_AGENT = 'trail-index-builder/0.1'

const DEFAULT_TIMEOUT_MS = 240_000
const MAX_RETRY_PAUSE_MS = 120_000

/** Сервис не ответил после всех повторов: вызывающий решает, ждать, менять экземпляр или отложить маршрут. */
export class NetworkError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NetworkError'
  }
}

/** Ответа нет в кэше, а сеть для этого запуска закрыта (потолок прохода, сервис недоступен). */
export class OfflineError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OfflineError'
  }
}

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** Счётчики сети одного запуска: по ним считаются пробы времени и объёма. */
export interface NetStats {
  requests: number
  cached: number
  bytes: number
  ms: number
}

export const newStats = (): NetStats => ({ requests: 0, cached: 0, bytes: 0, ms: 0 })

export interface FetchOptions {
  /** Файл кэша сырого ответа; есть на диске — сеть не трогается. */
  cacheFile?: string
  method?: 'GET' | 'POST'
  body?: string
  headers?: Record<string, string>
  /** Пауза ПОСЛЕ сетевого запроса, мс. */
  pauseMs?: number
  /** Сколько раз повторить при 429 и 5xx; пауза перед повтором — `retryPauseMs` (или `Retry-After`). */
  retries?: number
  retryPauseMs?: number
  /** Предел ожидания одного запроса, мс: без него зависший сервер останавливает всю сборку. */
  timeoutMs?: number
  /**
   * Проверка ответа до записи в кэш: строка — причина отказа (ответ не кэшируется, запрос повторяется),
   * `null` — ответ годен. Нужна там, где сервис отвечает 200 неполными данными.
   */
  validate?: (body: Buffer) => string | null
  /** Сеть закрыта: ответ берётся только из кэша, иначе `OfflineError`. */
  offline?: boolean
  /** Статусы, которые считаются ответом «данных нет» (404 у плитки рельефа над морем): кэшируется пустой файл. */
  emptyOn?: number[]
  stats?: NetStats
  log?: (line: string) => void
}

/** `null` — сервис ответил «данных нет» (`emptyOn`). */
export async function fetchCached(url: string, options: FetchOptions = {}): Promise<Buffer | null> {
  const { cacheFile, stats } = options
  if (cacheFile && fs.existsSync(cacheFile)) {
    if (stats) stats.cached += 1
    const cached = fs.readFileSync(cacheFile)
    return cached.length === 0 && options.emptyOn?.length ? null : cached
  }
  if (options.offline) throw new OfflineError(`нет в кэше, сеть для этого прохода закрыта: ${cacheFile ?? url}`)
  const retries = options.retries ?? 3
  let lastError = ''
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const started = Date.now()
    let response: Response
    try {
      response = await fetch(url, {
        method: options.method ?? 'GET',
        body: options.body,
        headers: { 'user-agent': USER_AGENT, ...options.headers },
        signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
      })
    } catch (error) {
      lastError = String(error)
      options.log?.(`${new URL(url).host}: ${lastError}, повтор`)
      await sleep(options.retryPauseMs ?? 5000)
      continue
    }
    if (options.emptyOn?.includes(response.status)) {
      if (cacheFile) writeFile(cacheFile, Buffer.alloc(0))
      if (stats) stats.requests += 1
      return null
    }
    if (response.status === 429 || response.status >= 500) {
      lastError = `HTTP ${response.status}`
      const retryAfter = Number(response.headers.get('retry-after'))
      const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : Math.min(MAX_RETRY_PAUSE_MS, (options.retryPauseMs ?? 5000) * (attempt + 1))
      options.log?.(`${lastError} от ${new URL(url).host}, повтор через ${Math.round(wait / 1000)} с`)
      await sleep(wait)
      continue
    }
    if (!response.ok) throw new Error(`HTTP ${response.status} ${url}`)
    const body = Buffer.from(await response.arrayBuffer())
    const invalid = options.validate?.(body) ?? null
    if (invalid) {
      lastError = invalid
      options.log?.(`${new URL(url).host}: ${invalid}, повтор`)
      await sleep(Math.min(MAX_RETRY_PAUSE_MS, (options.retryPauseMs ?? 5000) * (attempt + 1)))
      continue
    }
    if (stats) {
      stats.requests += 1
      stats.bytes += body.length
      stats.ms += Date.now() - started
    }
    if (cacheFile) writeFile(cacheFile, body)
    if (options.pauseMs) await sleep(options.pauseMs)
    return body
  }
  throw new NetworkError(`${url}: ${lastError || 'нет ответа'} после ${retries + 1} попыток`)
}

function writeFile(file: string, body: Buffer): void {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const tmp = `${file}.tmp-${process.pid}`
  fs.writeFileSync(tmp, body)
  fs.renameSync(tmp, file)
}

export const readJson = <T>(file: string): T => JSON.parse(fs.readFileSync(file, 'utf8')) as T

export function writeJson(file: string, value: unknown): void {
  writeFile(file, Buffer.from(`${JSON.stringify(value, null, 2)}\n`))
}
