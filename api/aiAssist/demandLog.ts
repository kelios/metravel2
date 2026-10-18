/**
 * Журнал спроса (#2460): вопросы, на которые у сайта не нашлось материалов, —
 * источник тем для владельца.
 *
 * До сервиса `/ai/ask` (#2456) с его `logs/ai-demand.jsonl` журнал ведётся на
 * устройстве: последние записи в AsyncStorage, в DEV — ещё и в консоль. Экспорт
 * одной строкой JSONL (`exportDemandLog`) совпадает по форме с серверным файлом,
 * чтобы `ai:demand:report` сервиса читал оба без переделки.
 */

import AsyncStorage from '@react-native-async-storage/async-storage'

import type { QuotaStorage } from './limits'

export const DEMAND_LOG_STORAGE_KEY = 'metravel.aiAssist.demand.v1'
export const DEMAND_LOG_MAX_ENTRIES = 200
const DEMAND_QUESTION_MAX_LENGTH = 500

export type DemandReason = 'no_sources' | 'generator_unavailable'

export type DemandEntry = {
  ts: string
  q: string
  locale: string
  reason: DemandReason
}

type DemandLogOptions = {
  storage?: QuotaStorage
  now?: () => Date
}

export const readDemandLog = async ({ storage = AsyncStorage }: DemandLogOptions = {}): Promise<DemandEntry[]> => {
  try {
    const raw = await storage.getItem(DEMAND_LOG_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as DemandEntry[]) : []
  } catch {
    return []
  }
}

export const logDemand = async (
  entry: { q: string; locale: string; reason: DemandReason },
  { storage = AsyncStorage, now = () => new Date() }: DemandLogOptions = {},
): Promise<DemandEntry[]> => {
  const record: DemandEntry = {
    ts: now().toISOString(),
    q: String(entry.q ?? '').trim().slice(0, DEMAND_QUESTION_MAX_LENGTH),
    locale: String(entry.locale ?? ''),
    reason: entry.reason,
  }
  if (!record.q) return readDemandLog({ storage })
  const next = [...(await readDemandLog({ storage })), record].slice(-DEMAND_LOG_MAX_ENTRIES)
  try {
    await storage.setItem(DEMAND_LOG_STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Журнал — вспомогательный: недоступное хранилище не ломает ответ.
  }
  if (__DEV__) {
    console.info('[ai-assist] demand', record)
  }
  return next
}

/** JSONL — та же форма, что у серверного `logs/ai-demand.jsonl`. */
export const exportDemandLog = async (options: DemandLogOptions = {}): Promise<string> =>
  (await readDemandLog(options)).map((entry) => JSON.stringify(entry)).join('\n')
