/**
 * Конфигурация сервиса metravel-assist (#2456) из переменных окружения.
 * Все значения читаются один раз при старте; секретов здесь нет.
 */
import { AI_ASK_DAILY_LIMIT } from '../../api/aiAssist/policy.ts'
import { defaultModelCacheDir } from '../ai-index/models.ts'
import { DEFAULT_DEMAND_LOG_PATH } from './demandLog.ts'
import { DEFAULT_DAY_TIME_ZONE } from './limits.ts'

export interface AssistConfig {
  port: number
  host: string
  /** Директория артефакта индекса (#2454): chunks.jsonl + vectors.f16 + manifest.json. */
  indexDir: string
  /** База бэкенда для лексической половины гибрида (`GET /api/travels/?query=`). */
  backendUrl: string
  /** Потоки ONNX для эмбеддинга запроса; прод — 1 vCPU. */
  threads: number
  modelCacheDir: string
  /** Без обращений к huggingface.co: веса обязаны лежать в кэше (контейнер). */
  offline: boolean
  /** Сколько ждать своей очереди к модели до 503 busy. */
  queueTimeoutMs: number
  /** Таймаут запроса к бэкенду; дольше — degraded, не ожидание. */
  lexicalTimeoutMs: number
  cacheSize: number
  cacheTtlSeconds: number
  redisUrl: string | null
  /** `llama-server` metravel-llm для `/ai/ask`; null — вопросы по теме получают 503 generator_unavailable. */
  llmUrl: string | null
  /** Таймаут ответа модели (#2457 ставит `proxy_read_timeout 60s` на `/ai/ask`). */
  llmTimeoutMs: number
  /** Ожидание очереди к модели до 429 busy. */
  askQueueTimeoutMs: number
  /** Вопросов в сутки на IP. */
  askDailyLimit: number
  /** Часовой пояс календарного дня лимитов (полночь — сброс). */
  dayTimeZone: string
  demandLogPath: string
  /** IP посетителя из `X-Real-IP`/`X-Forwarded-For` — сервис стоит за nginx. */
  trustProxy: boolean
}

function envNumber(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const raw = env[name]
  if (raw === undefined || raw === '') return fallback
  const value = Number(raw)
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name}=${raw}: ожидалось неотрицательное число`)
  return value
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AssistConfig {
  return {
    port: envNumber(env, 'PORT', 8787),
    host: env.HOST || '0.0.0.0',
    indexDir: env.AI_INDEX_DIR || 'dist/ai-index',
    backendUrl: (env.BACKEND_URL || 'http://127.0.0.1:8000').replace(/\/+$/, ''),
    threads: Math.max(1, envNumber(env, 'AI_ASSIST_THREADS', 1)),
    modelCacheDir: env.AI_ASSIST_MODEL_CACHE || defaultModelCacheDir(),
    offline: env.AI_ASSIST_OFFLINE === '1',
    queueTimeoutMs: envNumber(env, 'AI_ASSIST_QUEUE_TIMEOUT_MS', 2000),
    lexicalTimeoutMs: envNumber(env, 'AI_ASSIST_LEXICAL_TIMEOUT_MS', 1500),
    cacheSize: envNumber(env, 'AI_ASSIST_CACHE_SIZE', 500),
    cacheTtlSeconds: envNumber(env, 'AI_ASSIST_CACHE_TTL_SECONDS', 3600),
    redisUrl: env.REDIS_URL || null,
    llmUrl: env.AI_LLM_URL ? env.AI_LLM_URL.replace(/\/+$/, '') : null,
    llmTimeoutMs: envNumber(env, 'AI_ASSIST_LLM_TIMEOUT_MS', 60_000),
    askQueueTimeoutMs: envNumber(env, 'AI_ASSIST_ASK_QUEUE_TIMEOUT_MS', 2000),
    askDailyLimit: Math.max(1, envNumber(env, 'AI_ASK_DAILY_LIMIT', AI_ASK_DAILY_LIMIT)),
    dayTimeZone: env.AI_ASSIST_DAY_TZ || DEFAULT_DAY_TIME_ZONE,
    demandLogPath: env.AI_DEMAND_LOG || DEFAULT_DEMAND_LOG_PATH,
    trustProxy: env.AI_ASSIST_TRUST_PROXY !== '0',
  }
}
