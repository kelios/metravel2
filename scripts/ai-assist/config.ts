/**
 * Конфигурация сервиса metravel-assist (#2456) из переменных окружения.
 * Все значения читаются один раз при старте; секретов здесь нет.
 */
import { AI_ASK_DAILY_LIMIT, AI_AUTHOR_DRAFT_DAILY_LIMIT, AI_MAP_INTENT_DAILY_LIMIT } from '../../api/aiAssist/policy.ts'
import { defaultModelCacheDir } from '../ai-index/models.ts'
import { DEFAULT_DEMAND_LOG_PATH } from './demandLog.ts'
import { DEFAULT_DAY_TIME_ZONE } from './limits.ts'
import { ASK_FRAGMENT_CHARS } from './search.ts'

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
  /** Таймаут каталога словарных значений для `/ai/suggest-tags` (#2886): словарь и `GET /api/travels/<id>/`. */
  tagsTimeoutMs: number
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
  /** Запросов помощника автора (`/ai/author-draft`, #2885) в сутки на IP. */
  authorDraftDailyLimit: number
  /** Запросов фильтра карты (`/ai/intent`, #2887) в сутки на IP. */
  mapIntentDailyLimit: number
  /** Часовой пояс календарного дня лимитов (полночь — сброс). */
  dayTimeZone: string
  demandLogPath: string
  /** IP посетителя из `X-Real-IP`/`X-Forwarded-For` — сервис стоит за nginx. */
  trustProxy: boolean
  /** Контур оценки (#3286): событие `trace` в потоке `/ai/ask` и адрес модели в `/ai/health`. В образе прода не задаётся. */
  evalTrace: boolean
  /** Длина текстового фрагмента карточки `/ai/ask` после строки фактов (#3287), знаков; 0 — без фрагмента. */
  askFragmentChars: { travel: number; quest: number }
  /**
   * Новые строки подсказки `/ai/ask` (#3289), которых модель не видела в обучении: «Почему подходит» в
   * карточке и «материала о месте нет» перед вопросом. Обе включены; `0` выключает — для живого
   * сравнения двух вариантов.
   */
  promptHints: { whyFits: boolean; noPlace: boolean }
  /**
   * Сокращение подсказки `/ai/ask` до карточек, выделенных условиями вопроса (#3289): не больше трёх с
   * добором по порядку. Включено; `0` выключает — для живого сравнения.
   */
  promptFocus: boolean
  /**
   * Как отвечает справка о сайте (#3293): `direct` — текст записи и ссылка без модели (по умолчанию: текст
   * утверждает владелец, модель его искажала), `model` — запись уходит модели карточкой подсказки.
   */
  helpMode: 'direct' | 'model'
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
    tagsTimeoutMs: envNumber(env, 'AI_ASSIST_TAGS_TIMEOUT_MS', 2500),
    cacheSize: envNumber(env, 'AI_ASSIST_CACHE_SIZE', 500),
    cacheTtlSeconds: envNumber(env, 'AI_ASSIST_CACHE_TTL_SECONDS', 3600),
    redisUrl: env.REDIS_URL || null,
    llmUrl: env.AI_LLM_URL ? env.AI_LLM_URL.replace(/\/+$/, '') : null,
    llmTimeoutMs: envNumber(env, 'AI_ASSIST_LLM_TIMEOUT_MS', 60_000),
    askQueueTimeoutMs: envNumber(env, 'AI_ASSIST_ASK_QUEUE_TIMEOUT_MS', 2000),
    askDailyLimit: Math.max(1, envNumber(env, 'AI_ASK_DAILY_LIMIT', AI_ASK_DAILY_LIMIT)),
    authorDraftDailyLimit: Math.max(1, envNumber(env, 'AI_AUTHOR_DRAFT_DAILY_LIMIT', AI_AUTHOR_DRAFT_DAILY_LIMIT)),
    mapIntentDailyLimit: Math.max(1, envNumber(env, 'AI_MAP_INTENT_DAILY_LIMIT', AI_MAP_INTENT_DAILY_LIMIT)),
    dayTimeZone: env.AI_ASSIST_DAY_TZ || DEFAULT_DAY_TIME_ZONE,
    demandLogPath: env.AI_DEMAND_LOG || DEFAULT_DEMAND_LOG_PATH,
    trustProxy: env.AI_ASSIST_TRUST_PROXY !== '0',
    evalTrace: env.AI_ASSIST_EVAL_TRACE === '1',
    askFragmentChars: {
      travel: envNumber(env, 'AI_ASSIST_ASK_FRAGMENT_TRAVEL_CHARS', ASK_FRAGMENT_CHARS.travel),
      quest: envNumber(env, 'AI_ASSIST_ASK_FRAGMENT_QUEST_CHARS', ASK_FRAGMENT_CHARS.quest),
    },
    promptHints: {
      whyFits: env.AI_ASSIST_PROMPT_WHY_FITS !== '0',
      noPlace: env.AI_ASSIST_PROMPT_NO_PLACE !== '0',
    },
    promptFocus: env.AI_ASSIST_PROMPT_FOCUS !== '0',
    helpMode: env.AI_ASSIST_HELP_MODE === 'model' ? 'model' : 'direct',
  }
}
