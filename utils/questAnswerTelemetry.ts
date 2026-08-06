// Очередь попыток ответа в квестах (#1276, клиентская половина #1275).
//
// Зачем очередь, а не отправка на месте: квест проходят на улице, часто без
// сети, и гость пишет ровно так же, как залогиненный. Событие копится в
// AsyncStorage до успешной доставки — mock-фолбэка в рантайме нет, потерять
// попытку молча нельзя.
//
// Приватность: сырой ввод не кладётся в событие для свободных ответов
// (`any_text`/`any`). Это второй эшелон к серверному правилу #1275 —
// свободная рефлексия не покидает устройство вообще.

import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'

import { sendQuestAnswerAttempts, type QuestAnswerAttemptPayload } from '@/api/quests'
import { ApiError } from '@/api/client'
import { getActiveLocale } from '@/i18n'
import { devWarn } from '@/utils/logger'

export const QUEST_ATTEMPTS_QUEUE_KEY = 'quest_attempts_queue_v1'
export const QUEST_ATTEMPTS_SESSION_KEY = 'quest_attempts_session_v1'

/** Потолок очереди: переполнение дропает самые старые события. */
export const QUEUE_MAX_EVENTS = 500
/** Размер батча доставки. */
export const FLUSH_BATCH_SIZE = 10

const RETRY_BASE_MS = 2000
const RETRY_MAX_MS = 60 * 1000

type QueuedQuestAttempt = QuestAnswerAttemptPayload & { quest_id: number }

export type RecordQuestAttemptInput = {
  questNumericId: number | undefined
  stepId: string
  verdict: 'accepted' | 'rejected'
  /** Нормализованный ввод. Для свободного ответа уйдёт только его длина. */
  normalized: string
  /** Свободный ответ (`any_text`/`any`) — сырой текст не отправляется. */
  isFreeText: boolean
  attemptNo: number
  hintShown: boolean
  elapsedMs?: number
}

// Состояние модульное, а не хуковое: флаш обязан пережить размонтирование
// экрана квеста и вызываться из cleanup-эффекта без стейта.
let queue: QueuedQuestAttempt[] | null = null
let queueLoadPromise: Promise<QueuedQuestAttempt[]> | null = null
let sessionKey: string | null = null
let sessionKeyPromise: Promise<string> | null = null
let flushChain: Promise<void> | null = null
let retryAttempt = 0
let retryTimer: ReturnType<typeof setTimeout> | null = null

/** uuid4 без внешней зависимости: crypto, где он есть, иначе Math.random. */
export function createClientAttemptId(): string {
  const cryptoRef = (globalThis as { crypto?: Crypto }).crypto
  if (typeof cryptoRef?.randomUUID === 'function') return cryptoRef.randomUUID()

  const bytes = new Uint8Array(16)
  if (typeof cryptoRef?.getRandomValues === 'function') {
    cryptoRef.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256)
  }
  // Версия 4 и вариант RFC 4122 — сервер хранит поле как uuid.
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

const resolvePlatform = (): string => (Platform.OS === 'web' ? 'web' : String(Platform.OS))

/**
 * Ключ сессии прохождения — общий для гостя и залогиненного, чтобы логин
 * посреди квеста не разрывал прохождение на две несвязанные сессии.
 */
export async function getQuestAttemptSessionKey(): Promise<string> {
  if (sessionKey) return sessionKey
  if (!sessionKeyPromise) {
    sessionKeyPromise = (async () => {
      try {
        const stored = await AsyncStorage.getItem(QUEST_ATTEMPTS_SESSION_KEY)
        if (stored) return stored
      } catch {
        // Приватный режим браузера: работаем с сессией только в памяти.
      }
      const created = createClientAttemptId()
      try {
        await AsyncStorage.setItem(QUEST_ATTEMPTS_SESSION_KEY, created)
      } catch {
        // noop — ключ живёт до перезагрузки страницы.
      }
      return created
    })()
      .then((value) => {
        sessionKey = value
        return value
      })
      .catch(() => {
        sessionKey = createClientAttemptId()
        return sessionKey
      })
      .finally(() => {
        sessionKeyPromise = null
      })
  }
  return sessionKeyPromise
}

const isQueuedAttempt = (value: unknown): value is QueuedQuestAttempt => {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return (
    typeof record.client_attempt_id === 'string' &&
    typeof record.step_id === 'string' &&
    Number.isFinite(record.quest_id) &&
    (record.verdict === 'accepted' || record.verdict === 'rejected')
  )
}

const loadQueue = async (): Promise<QueuedQuestAttempt[]> => {
  if (queue) return queue
  if (!queueLoadPromise) {
    queueLoadPromise = (async () => {
      try {
        const raw = await AsyncStorage.getItem(QUEST_ATTEMPTS_QUEUE_KEY)
        const parsed = raw ? JSON.parse(raw) : []
        return Array.isArray(parsed) ? parsed.filter(isQueuedAttempt) : []
      } catch {
        // Повреждённый JSON или недоступное хранилище — начинаем с пустой очереди.
        return []
      }
    })()
      .then((loaded) => {
        queue = loaded
        return loaded
      })
      .finally(() => {
        queueLoadPromise = null
      })
  }
  return queueLoadPromise
}

const persistQueue = async (): Promise<void> => {
  try {
    await AsyncStorage.setItem(QUEST_ATTEMPTS_QUEUE_KEY, JSON.stringify(queue ?? []))
  } catch {
    // Best effort: недоступное хранилище не должно ронять прохождение квеста.
  }
}

const clearRetryTimer = () => {
  if (retryTimer) {
    clearTimeout(retryTimer)
    retryTimer = null
  }
}

const scheduleRetry = () => {
  clearRetryTimer()
  const delay = Math.min(RETRY_BASE_MS * 2 ** retryAttempt, RETRY_MAX_MS)
  retryAttempt += 1
  retryTimer = setTimeout(() => {
    retryTimer = null
    void flushQuestAnswerAttempts()
  }, delay)
}

const dropDelivered = (delivered: QueuedQuestAttempt[]) => {
  if (!queue || !delivered.length) return
  const deliveredIds = new Set(delivered.map((event) => event.client_attempt_id))
  queue = queue.filter((event) => !deliveredIds.has(event.client_attempt_id))
}

/** Первый батч очереди: события одного квеста, не больше FLUSH_BATCH_SIZE. */
const takeBatch = (events: QueuedQuestAttempt[]): QueuedQuestAttempt[] => {
  const head = events[0]
  if (!head) return []
  return events
    .filter((event) => event.quest_id === head.quest_id)
    .slice(0, FLUSH_BATCH_SIZE)
}

/**
 * Кладёт попытку в очередь. Событие получает `client_attempt_id` один раз и
 * переживает с ним все ретраи — повторная доставка на сервере схлопывается в
 * `duplicates`, а не создаёт вторую строку.
 */
export async function recordQuestAnswerAttempt(input: RecordQuestAttemptInput): Promise<void> {
  // Без числового id квеста событие некуда адресовать: bulk-приём принимает
  // батч на конкретный quest_id. Молча копить неадресуемые события хуже, чем
  // не собирать их вовсе.
  if (!Number.isFinite(input.questNumericId)) return

  const event: QueuedQuestAttempt = {
    quest_id: Number(input.questNumericId),
    client_attempt_id: createClientAttemptId(),
    step_id: input.stepId,
    verdict: input.verdict,
    // Сырой ввод — только для закрытых типов ответа (см. правило приватности).
    ...(input.isFreeText ? {} : { raw_answer: input.normalized }),
    answer_length: input.normalized.length,
    attempt_no: input.attemptNo,
    hint_shown: input.hintShown,
    ...(Number.isFinite(input.elapsedMs) ? { elapsed_ms: Math.max(0, Math.round(input.elapsedMs as number)) } : {}),
    platform: resolvePlatform(),
    locale: getActiveLocale(),
    occurred_at: new Date().toISOString(),
  }

  await loadQueue()
  // Читаем ссылку ПОСЛЕ await: параллельный флаш пересобирает `queue` новым
  // массивом, и push в захваченный до await — это потерянное событие.
  const events = queue ?? (queue = [])
  events.push(event)
  if (events.length > QUEUE_MAX_EVENTS) events.splice(0, events.length - QUEUE_MAX_EVENTS)
  await persistQueue()

  if (events.length >= FLUSH_BATCH_SIZE) void flushQuestAnswerAttempts()
}

const drainQueue = async (): Promise<void> => {
  await loadQueue()
  if (!queue?.length) return

  clearRetryTimer()
  const session = await getQuestAttemptSessionKey()

  // За один заход отдаём столько батчей, сколько уходит без ошибки: первый
  // неуспех останавливает цикл, чтобы не долбить недоступный сервер.
  for (;;) {
    const batch = takeBatch(queue ?? [])
    if (!batch.length) break

    try {
      await sendQuestAnswerAttempts({
        quest_id: batch[0].quest_id,
        session_key: session,
        attempts: batch.map(({ quest_id: _questId, ...attempt }) => attempt),
      })
      dropDelivered(batch)
      await persistQueue()
      retryAttempt = 0
    } catch (error) {
      const status = error instanceof ApiError ? error.status : undefined
      // 4xx кроме 429 — событие серверу не подходит и не подойдёт никогда;
      // оставить его в очереди значит навсегда заткнуть ею доставку.
      if (typeof status === 'number' && status >= 400 && status < 500 && status !== 429) {
        devWarn('Quest attempt batch rejected, dropping:', status)
        dropDelivered(batch)
        await persistQueue()
        continue
      }
      devWarn('Could not deliver quest attempts, will retry:', error)
      scheduleRetry()
      break
    }
  }
}

/**
 * Отправляет накопленные события батчами. Неуспех оставляет батч в очереди и
 * планирует ретрай с бэкоффом; офлайн просто копит события до следующего
 * открытия квеста.
 *
 * Вызовы сериализуются в одну цепочку: параллельный флаш не шлёт дубль батча,
 * а `await` дожидается именно доставки, а не постановки в очередь.
 */
export function flushQuestAnswerAttempts(): Promise<void> {
  const next = (flushChain ?? Promise.resolve()).then(drainQueue, drainQueue)
  // Цепочка не должна оставаться отклонённой: следующий вызов встанет за ней.
  flushChain = next.catch(() => {})
  return flushChain
}

/** Только для тестов: сбрасывает модульное состояние очереди. */
export function __resetQuestAnswerTelemetry(): void {
  clearRetryTimer()
  queue = null
  queueLoadPromise = null
  sessionKey = null
  sessionKeyPromise = null
  flushChain = null
  retryAttempt = 0
}
