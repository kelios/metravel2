// Возврат в начатый квест после холодного старта (native).
//
// Во время квеста человек уходит в Google/Apple Maps, камеру, мессенджер —
// и iOS/Android выгружают приложение из памяти. Холодный старт expo-router
// всегда открывает главную, и квест приходилось искать заново. Экран квеста
// держит здесь свой адрес, пока он открыт; NativeAppRuntime на холодном старте
// возвращает на него. Прогресс шага восстанавливает сам визард
// (questProgressStorage), здесь — только маршрут.

import AsyncStorage from '@react-native-async-storage/async-storage'

export const ACTIVE_QUEST_ROUTE_KEY = 'activeQuestRoute:v1'

/**
 * Сколько запись живёт после ухода из приложения. Перерыв на обед посреди
 * квеста — возврат в квест; открытие на следующий день — обычный старт.
 */
export const ACTIVE_QUEST_RESUME_TTL_MS = 12 * 60 * 60 * 1000

export type ActiveQuestRouteRecord = {
  href: string
  /** Последний раз экран квеста был на виду, ms epoch. */
  savedAt: number
}

const QUEST_ROUTE_PATTERN = /^\/quests\/[^/?#]+\/[^/?#]+$/

export const buildActiveQuestHref = (
  cityId: string | null | undefined,
  questId: string | null | undefined,
): string | null => {
  const city = String(cityId ?? '').trim()
  const quest = String(questId ?? '').trim()
  if (!city || !quest) return null
  return `/quests/${encodeURIComponent(city)}/${encodeURIComponent(quest)}`
}

export const isActiveQuestHref = (href: unknown): href is string =>
  typeof href === 'string' && QUEST_ROUTE_PATTERN.test(href)

const parseRecord = (raw: string | null): ActiveQuestRouteRecord | null => {
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as Partial<ActiveQuestRouteRecord>
    if (!isActiveQuestHref(value?.href)) return null
    if (typeof value.savedAt !== 'number' || !Number.isFinite(value.savedAt)) return null
    return { href: value.href, savedAt: value.savedAt }
  } catch {
    return null
  }
}

// Уход с квеста A сразу на квест B даёт forget(A) и remember(B) подряд: без
// очереди remove от A мог бы стереть только что записанный B.
let storageQueue: Promise<unknown> = Promise.resolve()
const enqueue = <T>(task: () => Promise<T>): Promise<T> => {
  const next = storageQueue.then(task, task)
  storageQueue = next.catch(() => undefined)
  return next
}

export const rememberActiveQuestRoute = (href: string, now: number = Date.now()): Promise<void> =>
  enqueue(async () => {
    if (!isActiveQuestHref(href)) return
    const record: ActiveQuestRouteRecord = { href, savedAt: now }
    await AsyncStorage.setItem(ACTIVE_QUEST_ROUTE_KEY, JSON.stringify(record)).catch(() => undefined)
  })

/** Снимает запись, только если она про этот квест — чужую не трогает. */
export const forgetActiveQuestRoute = (href: string): Promise<void> =>
  enqueue(async () => {
    const raw = await AsyncStorage.getItem(ACTIVE_QUEST_ROUTE_KEY).catch(() => null)
    const record = parseRecord(raw)
    if (raw && record && record.href !== href) return
    await AsyncStorage.removeItem(ACTIVE_QUEST_ROUTE_KEY).catch(() => undefined)
  })

/** Адрес квеста для возврата или null, если записи нет или она устарела. */
export const readActiveQuestRouteForResume = (now: number = Date.now()): Promise<string | null> =>
  enqueue(async () => {
    const raw = await AsyncStorage.getItem(ACTIVE_QUEST_ROUTE_KEY).catch(() => null)
    const record = parseRecord(raw)
    if (!record) {
      if (raw) await AsyncStorage.removeItem(ACTIVE_QUEST_ROUTE_KEY).catch(() => undefined)
      return null
    }
    const age = now - record.savedAt
    if (age < 0 || age > ACTIVE_QUEST_RESUME_TTL_MS) {
      await AsyncStorage.removeItem(ACTIVE_QUEST_ROUTE_KEY).catch(() => undefined)
      return null
    }
    return record.href
  })
