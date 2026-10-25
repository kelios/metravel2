/**
 * Дневной лимит вопросов (#2460): 20 в сутки на устройство/браузер.
 *
 * Серверный лимит на IP (redis) держит `/ai/ask` (#2713, `scripts/ai-assist/limits.ts`);
 * клиентский счётчик — та же цифра из `policy.ts`, чтобы UI показывал «осталось
 * вопросов» и не гонял модель впустую. Хранилище — AsyncStorage (на web — localStorage).
 */

import AsyncStorage from '@react-native-async-storage/async-storage'

import { AI_ASK_DAILY_LIMIT, AI_OFFTOPIC_STRIKES_TO_BLOCK } from './policy'

export { AI_ASK_DAILY_LIMIT, AI_OFFTOPIC_STRIKES_TO_BLOCK }
const QUOTA_STORAGE_KEY = 'metravel.aiAssist.quota.v1'
export const OFFTOPIC_STORAGE_KEY = 'metravel.aiAssist.offtopic.v1'

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

const readRecord = async (storage: QuotaStorage, day: string, key = QUOTA_STORAGE_KEY): Promise<QuotaRecord> => {
  try {
    const raw = await storage.getItem(key)
    if (!raw) return { day, used: 0 }
    const parsed = JSON.parse(raw) as Partial<QuotaRecord>
    if (parsed?.day !== day) return { day, used: 0 }
    const used = Number(parsed.used)
    return { day, used: Number.isFinite(used) && used > 0 ? Math.floor(used) : 0 }
  } catch {
    return { day, used: 0 }
  }
}

const writeRecord = async (storage: QuotaStorage, record: QuotaRecord, key = QUOTA_STORAGE_KEY): Promise<void> => {
  try {
    await storage.setItem(key, JSON.stringify(record))
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

export type OffTopicState = {
  /** Вопросов не по теме сегодня. */
  strikes: number
  /** Ассистент закрыт до конца дня. */
  blocked: boolean
}

type OffTopicOptions = Omit<QuotaOptions, 'limit'> & { strikesToBlock?: number }

const toOffTopicState = (strikes: number, strikesToBlock: number): OffTopicState => ({
  strikes,
  blocked: strikes >= strikesToBlock,
})

/**
 * Вопросы не по теме за день: 1-й и 2-й — предупреждение, 3-й — блок до полуночи
 * по времени устройства (как дневной лимит). Вопросы по теме счётчик не
 * сбрасывают. Клиентский счётчик обходится очисткой хранилища — настоящий блок
 * держит сервер `/ai/ask` (#2713).
 */
export const readOffTopicState = async ({
  storage = AsyncStorage,
  now = () => new Date(),
  strikesToBlock = AI_OFFTOPIC_STRIKES_TO_BLOCK,
}: OffTopicOptions = {}): Promise<OffTopicState> => {
  const record = await readRecord(storage, quotaDayKey(now()), OFFTOPIC_STORAGE_KEY)
  return toOffTopicState(record.used, strikesToBlock)
}

/** Засчитывает вопрос не по теме; возвращает состояние после него. */
export const registerOffTopicStrike = async ({
  storage = AsyncStorage,
  now = () => new Date(),
  strikesToBlock = AI_OFFTOPIC_STRIKES_TO_BLOCK,
}: OffTopicOptions = {}): Promise<OffTopicState> => {
  const day = quotaDayKey(now())
  const record = await readRecord(storage, day, OFFTOPIC_STORAGE_KEY)
  const strikes = Math.min(strikesToBlock, record.used + 1)
  await writeRecord(storage, { day, used: strikes }, OFFTOPIC_STORAGE_KEY)
  return toOffTopicState(strikes, strikesToBlock)
}
