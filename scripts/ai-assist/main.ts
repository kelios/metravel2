/**
 * Точка входа сервиса metravel-assist (#2456):
 *   AI_INDEX_DIR=.codex-temp/ai-index/dist npm run ai:assist:dev
 *
 * Порядок старта: конфиг → индекс (проверка count/length/sha и модели) → модель (прогрев) →
 * redis (опционально) → HTTP. Любая ошибка до listen — выход с кодом 1 и понятным сообщением.
 */
import { createEmbedder } from '../ai-index/embed.ts'
import { resolveModel } from '../ai-index/models.ts'
import { createApp } from './app.ts'
import { ResponseCache } from './cache.ts'
import { loadConfig } from './config.ts'
import { IndexModelMismatch, loadIndex } from './index.ts'
import { createLexicalSearch } from './lexical.ts'
import { createRedisClient } from './redis.ts'

const log = (line: string) => console.error(`[${new Date().toISOString()}] ${line}`)

async function main(): Promise<void> {
  const config = loadConfig()
  // AI_ASSIST_MODEL закрепляет модель (в образе — запечённую); без него берём модель индекса.
  const pinnedModel = process.env.AI_ASSIST_MODEL || undefined

  log(`индекс: ${config.indexDir}`)
  const index = await loadIndex(config.indexDir, { expectedModel: pinnedModel })
  const { manifest } = index.artifact
  const spec = resolveModel(pinnedModel ?? manifest.model)
  log(`индекс загружен: ${manifest.count} фрагментов × ${manifest.dim}, модель ${manifest.model}, собран ${manifest.built_at}`)

  log(`модель: ${spec.hfId} (${spec.dtype}), потоков ${config.threads}, кэш ${config.modelCacheDir}${config.offline ? ', offline' : ''}`)
  const embedder = await createEmbedder(spec, { threads: config.threads, cacheDir: config.modelCacheDir, offline: config.offline })
  const warm = process.hrtime.bigint()
  await embedder.embedQuery('прогрев')
  log(`модель готова, прогрев ${(Number(process.hrtime.bigint() - warm) / 1e6).toFixed(0)} мс`)

  const redis = config.redisUrl ? createRedisClient({ url: config.redisUrl }) : null
  const cache = new ResponseCache({ capacity: config.cacheSize, ttlSeconds: config.cacheTtlSeconds, redis, log })
  const lexical = createLexicalSearch({ backendUrl: config.backendUrl, timeoutMs: config.lexicalTimeoutMs, log })

  const server = createApp({
    index,
    modelKey: spec.key,
    embedQuery: (q) => embedder.embedQuery(q),
    lexical,
    cache,
    queueTimeoutMs: config.queueTimeoutMs,
    log,
  })
  server.keepAliveTimeout = 5000
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(config.port, config.host, () => resolve())
  })
  log(`metravel-assist слушает http://${config.host}:${config.port}, бэкенд ${config.backendUrl}, rss ${Math.round(process.memoryUsage().rss / 1048576)} МБ`)

  let stopping = false
  const stop = async (signal: string) => {
    if (stopping) return
    stopping = true
    log(`${signal}: останавливаюсь`)
    server.close()
    redis?.close()
    await embedder.dispose()
    process.exit(0)
  }
  process.on('SIGTERM', () => void stop('SIGTERM'))
  process.on('SIGINT', () => void stop('SIGINT'))
}

main().catch((error) => {
  if (error instanceof IndexModelMismatch) log(`отказ старта: ${error.message}`)
  else log(`отказ старта: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`)
  process.exit(1)
})
