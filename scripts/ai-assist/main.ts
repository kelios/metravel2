/**
 * Точка входа сервиса metravel-assist (#2456):
 *   AI_INDEX_DIR=.codex-temp/ai-index/dist npm run ai:assist:dev
 *
 * Порядок старта: конфиг → индекс (проверка count/length/sha и модели) → модель (прогрев) →
 * redis (опционально) → лимиты и журнал `/ai/ask` → HTTP. Любая ошибка до listen — выход с кодом 1 и понятным сообщением.
 */
import { AI_OFFTOPIC_STRIKES_TO_BLOCK } from '../../api/aiAssist/policy.ts'
import { createGenerator } from '../../api/aiAssist/generator.ts'
import { createEmbedder } from '../ai-index/embed.ts'
import { indexAgeDays } from '../ai-index/format.ts'
import { DEFAULT_MAX_AGE_DAYS } from '../ai-index/freshness.ts'
import { resolveModel } from '../ai-index/models.ts'
import { createApp } from './app.ts'
import { ResponseCache } from './cache.ts'
import { loadConfig } from './config.ts'
import { createDemandLog } from './demandLog.ts'
import { IndexModelMismatch, loadIndex } from './index.ts'
import { createLexicalSearch } from './lexical.ts'
import { AUTHOR_DRAFT_LIMITS_PREFIX } from './authorDraft.ts'
import { INTENT_LIMITS_PREFIX } from './intent.ts'
import { AskLimits, createCounterStore, createDayClock } from './limits.ts'
import { createRedisClient } from './redis.ts'
import { createTagCatalog } from './suggestTags.ts'

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
  const ageDays = indexAgeDays(manifest.built_at)
  if (ageDays === null || ageDays > DEFAULT_MAX_AGE_DAYS) {
    log(`⚠️ индекс собран ${ageDays ?? '?'} дн. назад (порог ${DEFAULT_MAX_AGE_DAYS}): материалы, опубликованные позже, не находятся — \`npm run ai:index -- build\``)
  }

  log(`модель: ${spec.hfId} (${spec.dtype}), потоков ${config.threads}, кэш ${config.modelCacheDir}${config.offline ? ', offline' : ''}`)
  const embedder = await createEmbedder(spec, { threads: config.threads, cacheDir: config.modelCacheDir, offline: config.offline })
  const warm = process.hrtime.bigint()
  await embedder.embedQuery('прогрев')
  log(`модель готова, прогрев ${(Number(process.hrtime.bigint() - warm) / 1e6).toFixed(0)} мс`)

  const redis = config.redisUrl ? createRedisClient({ url: config.redisUrl }) : null
  const cache = new ResponseCache({ capacity: config.cacheSize, ttlSeconds: config.cacheTtlSeconds, redis, log })
  const lexical = createLexicalSearch({ backendUrl: config.backendUrl, timeoutMs: config.lexicalTimeoutMs, log })
  // #2886: словарь и значения статей для `/ai/suggest-tags`, час в памяти.
  const tagCatalog = createTagCatalog({ backendUrl: config.backendUrl, timeoutMs: config.tagsTimeoutMs, log })

  const counterStore = createCounterStore(redis, log)
  const dayClock = createDayClock(config.dayTimeZone)
  const limits = new AskLimits({
    store: counterStore,
    clock: dayClock,
    dailyLimit: config.askDailyLimit,
    strikesToBlock: AI_OFFTOPIC_STRIKES_TO_BLOCK,
  })
  // #2885: помощник автора считает запросы отдельно от вопросов ассистента (из `AskLimits` нужна только квота).
  const authorDraftLimits = new AskLimits({
    store: counterStore,
    clock: dayClock,
    dailyLimit: config.authorDraftDailyLimit,
    strikesToBlock: AI_OFFTOPIC_STRIKES_TO_BLOCK,
    prefix: AUTHOR_DRAFT_LIMITS_PREFIX,
  })
  // #2887: фильтр карты по описанию — свой суточный счётчик на IP.
  const mapIntentLimits = new AskLimits({
    store: counterStore,
    clock: dayClock,
    dailyLimit: config.mapIntentDailyLimit,
    strikesToBlock: AI_OFFTOPIC_STRIKES_TO_BLOCK,
    prefix: INTENT_LIMITS_PREFIX,
  })
  const demandLog = createDemandLog({ path: config.demandLogPath, log })
  const generator = config.llmUrl ? createGenerator(config.llmUrl, { timeoutMs: config.llmTimeoutMs }) : null
  log(
    `/ai/ask: модель ${config.llmUrl ?? 'не задана (AI_LLM_URL)'}, лимит ${config.askDailyLimit}/сутки на IP, ` +
      `блок после ${AI_OFFTOPIC_STRIKES_TO_BLOCK} вопросов не по теме, /ai/author-draft ${config.authorDraftDailyLimit}/сутки на IP, ` +
      `/ai/intent ${config.mapIntentDailyLimit}/сутки на IP, день по ${config.dayTimeZone}, ` +
      `счётчики ${redis ? 'redis' : 'в памяти'}, журнал ${config.demandLogPath}`,
  )

  if (config.evalTrace) log('⚠️ AI_ASSIST_EVAL_TRACE=1: /ai/ask отдаёт карточки подсказки и сырой ответ модели, /ai/health — адрес модели. Только для контура оценки')

  const server = createApp({
    index,
    modelKey: spec.key,
    embedQuery: (q) => embedder.embedQuery(q),
    lexical,
    cache,
    queueTimeoutMs: config.queueTimeoutMs,
    ask: {
      generator,
      limits,
      demandLog,
      queueTimeoutMs: config.askQueueTimeoutMs,
      trustProxy: config.trustProxy,
      evalTrace: config.evalTrace ? { llmUrl: config.llmUrl } : null,
    },
    authorDraft: { limits: authorDraftLimits },
    mapIntent: { limits: mapIntentLimits },
    suggestTags: { catalog: tagCatalog },
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
