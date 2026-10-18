/**
 * Дневной лимит вопросов (#2460): 20 в сутки на устройство/браузер.
 *
 * Серверный лимит на IP (redis) появится вместе с `/ai/ask` (#2456); клиентский
 * счётчик — та же цифра, чтобы UI уже показывал «осталось вопросов» и не
 * гонял модель на Mac впустую. Хранилище — AsyncStorage (на web — localStorage).
 */

import AsyncStorage from '@react-native-async-storage/async-storage'

export const AI_ASK_DAILY_LIMIT = 20
const QUOTA_STORAGE_KEY = 'metravel.aiAssist.quota.v1'

export type QuotaStorage = {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
}

type QuotaRecord = { day: string; used: number }

/** Ключ дня по локальному времени устройства: лимит «на сегодня» для человека. */
export const quotaDayKey = (now: Date = new Date()): string => {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const readRecord = async (storage: QuotaStorage, day: string): Promise<QuotaRecord> => {
  try {
    const raw = await storage.getItem(QUOTA_STORAGE_KEY)
    if (!raw) return { day, used: 0 }
    const parsed = JSON.parse(raw) as Partial<QuotaRecord>
    if (parsed?.day !== day) return { day, used: 0 }
    const used = Number(parsed.used)
    return { day, used: Number.isFinite(used) && used > 0 ? Math.floor(used) : 0 }
  } catch {
    return { day, used: 0 }
  }
}

const writeRecord = async (storage: QuotaStorage, record: QuotaRecord): Promise<void> => {
  try {
    await storage.setItem(QUOTA_STORAGE_KEY, JSON.stringify(record))
  } catch {
    // Недоступное хранилище не блокирует вопрос: лимит страхует сервер.
  }
}

export type QuotaOptions = {
  storage?: QuotaStorage
  limit?: number
  now?: () => Date
}

export const readRemainingQuestions = async ({
  storage = AsyncStorage,
  limit = AI_ASK_DAILY_LIMIT,
  now = () => new Date(),
}: QuotaOptions = {}): Promise<number> => {
  const record = await readRecord(storage, quotaDayKey(now()))
  return Math.max(0, limit - record.used)
}

/** Списывает один вопрос; возвращает остаток после списания. */
export const consumeQuestion = async ({
  storage = AsyncStorage,
  limit = AI_ASK_DAILY_LIMIT,
  now = () => new Date(),
}: QuotaOptions = {}): Promise<number> => {
  const day = quotaDayKey(now())
  const record = await readRecord(storage, day)
  const used = Math.min(limit, record.used + 1)
  await writeRecord(storage, { day, used })
  return Math.max(0, limit - used)
}
