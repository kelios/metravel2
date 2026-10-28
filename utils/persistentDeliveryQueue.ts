// Персистентная очередь доставки на бэкенд: элементы живут в AsyncStorage до
// подтверждения сервером, переживают перезапуск и офлайн. Общая для телеметрии
// приложения (падения, события), чтобы каждый поток не заводил свою очередь.

import AsyncStorage from '@react-native-async-storage/async-storage'

import { ApiError } from '@/api/client'
import { devWarn } from '@/utils/logger'

const RETRY_BASE_MS = 2000
const RETRY_MAX_MS = 60 * 1000

export type PersistentDeliveryQueueOptions<T> = {
  storageKey: string
  /** Потолок очереди: переполнение дропает самые старые элементы. */
  maxItems: number
  batchSize: number
  idOf: (item: T) => string
  isValid: (value: unknown) => value is T
  send: (batch: T[]) => Promise<unknown>
}

export type PersistentDeliveryQueue<T> = {
  /** true — запись переживёт завершение процесса; false — осталась только в памяти. */
  enqueue: (item: T) => Promise<boolean>
  /** Сериализованный флаш: параллельный вызов встаёт за текущим. */
  flush: () => Promise<void>
  /** Только для тестов: сбрасывает модульное состояние очереди. */
  __reset: () => void
}

export function createPersistentDeliveryQueue<T>(
  options: PersistentDeliveryQueueOptions<T>,
): PersistentDeliveryQueue<T> {
  const { storageKey, maxItems, batchSize, idOf, isValid, send } = options

  let items: T[] | null = null
  let loadPromise: Promise<T[]> | null = null
  let flushChain: Promise<void> | null = null
  let retryAttempt = 0
  let retryTimer: ReturnType<typeof setTimeout> | null = null
  let persistChain: Promise<boolean> = Promise.resolve(true)

  const load = async (): Promise<T[]> => {
    if (items) return items
    if (!loadPromise) {
      loadPromise = (async () => {
        // Ошибка чтения не означает пустую очередь: не перезаписываем диск
        // новым отчётом, если старые пока невозможно прочитать.
        const raw = await AsyncStorage.getItem(storageKey)
        try {
          const parsed = raw ? JSON.parse(raw) : []
          return Array.isArray(parsed) ? parsed.filter(isValid).slice(-maxItems) : []
        } catch {
          // Повреждённый JSON восстановить невозможно.
          return []
        }
      })()
        .then((loaded) => {
          items = loaded
          return loaded
        })
        .finally(() => {
          loadPromise = null
        })
    }
    return loadPromise
  }

  const persist = (): Promise<boolean> => {
    const snapshot = JSON.stringify(items ?? [])
    // Enqueue и ответ сети могут пересечься: старый снимок не должен
    // завершить запись после нового и вернуть доставленные записи на диск.
    persistChain = persistChain.then(async () => {
      try {
        await AsyncStorage.setItem(storageKey, snapshot)
        return true
      } catch {
        return false
      }
    })
    return persistChain
  }

  const clearRetryTimer = () => {
    if (retryTimer) {
      clearTimeout(retryTimer)
      retryTimer = null
    }
  }

  const drop = (delivered: T[]) => {
    if (!items || !delivered.length) return
    const ids = new Set(delivered.map(idOf))
    items = items.filter((item) => !ids.has(idOf(item)))
  }

  const scheduleRetry = () => {
    clearRetryTimer()
    const delay = Math.min(RETRY_BASE_MS * 2 ** retryAttempt, RETRY_MAX_MS)
    retryAttempt += 1
    retryTimer = setTimeout(() => {
      retryTimer = null
      void flush()
    }, delay)
  }

  const drain = async (): Promise<void> => {
    await load()
    if (!items?.length) return
    clearRetryTimer()

    // Отдаём батчи, пока сервер принимает: первый неуспех останавливает цикл,
    // чтобы не долбить недоступный сервер.
    for (;;) {
      const batch = (items ?? []).slice(0, batchSize)
      if (!batch.length) break
      try {
        await send(batch)
        drop(batch)
        await persist()
        retryAttempt = 0
      } catch (error) {
        const status = error instanceof ApiError ? error.status : undefined
        if (status === 400) {
          devWarn(`Delivery queue ${storageKey}: batch rejected with ${status}, dropped`)
          drop(batch)
          await persist()
          continue
        }
        devWarn(`Delivery queue ${storageKey}: will retry`, error)
        scheduleRetry()
        break
      }
    }
  }

  const flush = (): Promise<void> => {
    const next = (flushChain ?? Promise.resolve()).then(drain, drain)
    // Цепочка не должна оставаться отклонённой: следующий вызов встанет за ней.
    flushChain = next.catch(() => { scheduleRetry() })
    return flushChain
  }

  const enqueue = async (item: T): Promise<boolean> => {
    await load()
    // Читаем ссылку ПОСЛЕ await: параллельный флаш пересобирает массив, и push
    // в захваченный до await — это потерянный элемент.
    const queue = items ?? (items = [])
    queue.push(item)
    if (queue.length > maxItems) queue.splice(0, queue.length - maxItems)
    return persist()
  }

  const __reset = () => {
    clearRetryTimer()
    items = null
    loadPromise = null
    flushChain = null
    retryAttempt = 0
    persistChain = Promise.resolve(true)
  }

  return { enqueue, flush, __reset }
}
