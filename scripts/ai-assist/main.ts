/**
 * Точка входа сервиса metravel-assist (#2456):
 *   AI_INDEX_DIR=.codex-temp/ai-index/dist npm run ai:assist:dev
 *
 * Порядок старта: конфиг → индекс (проверка count/length/sha и модели) → модель (прогрев) →
 * redis (опционально) → лимиты и журнал `/ai/ask` → HTTP. Любая ошибка до listen — выход с кодом 1 и понятным сообщением.
 */
import { AI_OFFTOPIC_STRIKES_TO_BLOCK } from '../../api/aiAssist/policy.ts'
import { createGenerator } from './generator.ts'
import { createEmbedder } from '../ai-index/embed.ts'
import { indexAgeDays } from '../ai-index/format.ts'
import { DEFAULT_MAX_AGE_DAYS } from '../ai-index/freshness.ts'
import { resolveModel } from '../ai-index/models.ts'
import { createApp } from './app.ts'
import { ResponseCache } from './cache.ts'
import { loadConfig } from './config.ts'
import { createDemandLog } from './demandLog.ts'
import { FEEDBACK_LIMITS_PREFIX, FEEDBACK_REQUESTS_PER_QUESTION } from './feedback.ts'
import { IndexModelMismatch, loadIndex } from './index.ts'
import { createLexicalSearch } from './lexical.ts'
import { AUTHOR_DRAFT_LIMITS_PREFIX } from './authorDraft.ts'
import { INTENT_LIMITS_PREFIX } from './intent.ts'
import { PLAN_LIMITS_PREFIX } from './plan.ts'
import { AskLimits, createCounterStore, createDayClock } from './limits.ts'
import { createRedisClient } from './redis.ts'
import { createTagCatalog } from './suggestTags.ts'
import { createVisitorProfile, isPlainPublicBackend } from './visitorProfile.ts'
import { loadWorldIndex } from './worldIndex.ts'

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

  // #3357: внешний индекс маршрутов мира — отдельный артефакт; без переменной блока «Ещё в мире» нет.
  const world = config.worldIndexDir ? loadWorldIndex(config.worldIndexDir, { expectedModel: spec.key }) : null
  if (world) {
    log(
      `маршруты мира: ${config.worldIndexDir} — ${world.trails.length} маршрутов, ${world.manifest.chunks} фрагментов, собран ${world.manifest.built_at}; ` +
        `файл слоя ODbL: ${config.worldLayerUrl ?? 'адрес не задан (AI_WORLD_LAYER_URL) — ссылки под блоком нет'}`,
    )
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
    strikesToBlock: config.askOffTopicStrikes,
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
  // #3298: план по дням — свой суточный счётчик на IP.
  const planLimits = new AskLimits({
    store: counterStore,
    clock: dayClock,
    dailyLimit: config.planDailyLimit,
    strikesToBlock: AI_OFFTOPIC_STRIKES_TO_BLOCK,
    prefix: PLAN_LIMITS_PREFIX,
  })
  // #3296: голоса за ответ — свой суточный счётчик на IP в том же хранилище: голос и уточнение причины на вопрос.
  const feedbackLimits = new AskLimits({
    store: counterStore,
    clock: dayClock,
    dailyLimit: config.askDailyLimit * FEEDBACK_REQUESTS_PER_QUESTION,
    strikesToBlock: AI_OFFTOPIC_STRIKES_TO_BLOCK,
    prefix: FEEDBACK_LIMITS_PREFIX,
  })
  const demandLog = createDemandLog({ path: config.demandLogPath, log })
  // Записи журнала старше срока хранения удаляются при старте и далее раз в сутки (#3296).
  void demandLog.prune(true)
  const generator = config.llmUrl ? createGenerator(config.llmUrl, { timeoutMs: config.llmTimeoutMs }) : null
  log(
    `/ai/ask: модель ${config.llmUrl ?? 'не задана (AI_LLM_URL)'}, лимит ${config.askDailyLimit}/сутки на IP, ` +
      `блок после ${config.askOffTopicStrikes} вопросов не по теме, /ai/author-draft ${config.authorDraftDailyLimit}/сутки на IP, ` +
      `/ai/intent ${config.mapIntentDailyLimit}/сутки на IP, день по ${config.dayTimeZone}, ` +
      `счётчики ${redis ? 'redis' : 'в памяти'}, журнал ${config.demandLogPath}`,
  )

  if (!config.promptHints.whyFits || !config.promptHints.noPlace) {
    log(`/ai/ask: строки подсказки #3289 — «Почему подходит» ${config.promptHints.whyFits ? 'вкл' : 'ВЫКЛ'}, «материала о месте нет» ${config.promptHints.noPlace ? 'вкл' : 'ВЫКЛ'}`)
  }
  if (!config.promptFocus) log('/ai/ask: сокращение подсказки до карточек, выделенных условиями вопроса (#3289), ВЫКЛ')
  log(`/ai/plan: ${config.planDailyLimit}/сутки на IP, план собирает ${config.planModel ? 'модель с проверкой и доводкой кодом, запасной путь — код (AI_PLAN_MODEL=1)' : 'код; путь модели — AI_PLAN_MODEL=1'}`)
  if (config.helpMode === 'model') log('/ai/ask: справка о сайте (#3293) идёт через модель — AI_ASSIST_HELP_MODE=model; по умолчанию запись отдаётся без модели')
  // #3354: личный контекст вошедшего посетителя. Токен уходит только на бэкенд.
  const visitorProfile = config.promptProfile
    ? createVisitorProfile({
        backendUrl: config.backendUrl,
        timeoutMs: config.profileTimeoutMs,
        ttlSeconds: config.profileTtlSeconds,
        capacity: config.profileCacheSize,
        cookieName: config.authCookieName,
        log,
      })
    : null
  log(
    visitorProfile
      ? `/ai/ask: личный контекст посетителя (#3354) вкл — бюджет ${config.profileTimeoutMs} мс, сводка в памяти ${config.profileTtlSeconds} с, до ${config.profileCacheSize} посетителей`
      : '/ai/ask: личный контекст посетителя (#3354) ВЫКЛ — AI_ASSIST_PROMPT_PROFILE=0',
  )
  if (visitorProfile && isPlainPublicBackend(config.backendUrl)) {
    log('⚠️ BACKEND_URL без https и не во внутренней сети: токен посетителя пойдёт к API открытым текстом — задайте https-адрес либо AI_ASSIST_PROMPT_PROFILE=0')
  }
  if (config.evalTrace) log('⚠️ AI_ASSIST_EVAL_TRACE=1: /ai/ask отдаёт карточки подсказки и сырой ответ модели, /ai/health — адрес модели. Только для контура оценки')

  const server = createApp({
    index,
    world,
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
      promptHints: config.promptHints,
      helpMode: config.helpMode,
      worldLayerUrl: config.worldLayerUrl,
      ...(visitorProfile ? { visitor: visitorProfile.resolve } : {}),
    },
    askFragmentChars: config.askFragmentChars,
    promptFocus: config.promptFocus,
    authorDraft: { limits: authorDraftLimits },
    mapIntent: { limits: mapIntentLimits },
    plan: { limits: planLimits, modelEnabled: config.planModel },
    feedback: { limits: feedbackLimits },
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
