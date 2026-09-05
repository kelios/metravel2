// Возврат после финиша квеста (#1484): device-local запись последнего
// прохождения и решение, считать ли текущий заход возвратом.
//
// Событие `return_visit_after_finish` меряет ровно то, чего у продукта не было,
// — повторный визит. Поэтому запись хранится локально (сервер про заходы в
// каталог ничего не знает) и отчитывается один раз на финиш.

import AsyncStorage from '@react-native-async-storage/async-storage'

import { devWarn } from '@/utils/logger'

const LEGACY_QUEST_FINISH_RECORD_KEY = 'questFinish:v1'
export const QUEST_FINISH_RECORD_KEY = 'questFinish:v2'

export const questRetentionOwnerId = (userId: string | number | null | undefined): string =>
  userId == null || String(userId).trim() === '' ? 'guest' : `user:${String(userId).trim()}`

export const questFinishRecordKey = (ownerId: string): string =>
  `${QUEST_FINISH_RECORD_KEY}:${encodeURIComponent(ownerId)}`

/**
 * Минимальный разрыв между финишем и заходом, который считается возвратом.
 * Меньше — это то же посещение: переход к следующему квесту сразу после
 * финала меряется кликом `next_quest_click`, а не возвратом.
 */
export const RETURN_VISIT_MIN_GAP_MS = 6 * 60 * 60 * 1000

/** Окно наблюдения из тикета: «доля вернувшихся в течение 30 дней». */
export const RETURN_VISIT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000

export type QuestFinishRecord = {
  ownerId: string
  questId: string
  cityId?: string
  cityName?: string
  /** Время финиша, ms epoch. */
  finishedAt: number
  /** Возврат по этой записи уже отправлен — второй раз не шлём. */
  returnReported?: boolean
  /** Возвратное OS-уведомление уже поставлено для этого точного финиша. */
  reminderScheduledAt?: number
  /** Мягкая просьба об отзыве по этому финишу уже показана (#1795): один раз на квест. */
  reviewPromptedAt?: number
}

function isRecord(value: unknown): value is QuestFinishRecord {
  if (!value || typeof value !== 'object') return false
  const record = value as QuestFinishRecord
  return (
    typeof record.ownerId === 'string' &&
    record.ownerId.length > 0 &&
    typeof record.questId === 'string' &&
    Number.isFinite(record.finishedAt)
  )
}

export async function readQuestFinishRecord(ownerId: string): Promise<QuestFinishRecord | null> {
  try {
    // v1 не имел владельца и небезопасен при смене аккаунта — только удаляем.
    void AsyncStorage.removeItem(LEGACY_QUEST_FINISH_RECORD_KEY).catch(() => undefined)
    const raw = await AsyncStorage.getItem(questFinishRecordKey(ownerId))
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return isRecord(parsed) ? parsed : null
  } catch (error) {
    devWarn('[questReturnVisit] failed to read finish record:', error)
    return null
  }
}

/**
 * Запомнить финиш. Перезаписывает предыдущую запись: возврат меряется от
 * последнего прохождения, а незакрытый старый финиш к этому моменту либо уже
 * отчитан, либо вышел за окно наблюдения.
 */
export async function rememberQuestFinish(record: {
  ownerId: string
  questId: string
  cityId?: string | null
  cityName?: string | null
  finishedAt: number
}): Promise<QuestFinishRecord | null> {
  const ownerId = String(record.ownerId || '').trim()
  const questId = String(record.questId || '').trim()
  if (!ownerId || !questId || !Number.isFinite(record.finishedAt)) return null
  try {
    const previous = await readQuestFinishRecord(ownerId)
    // Тот же квест в том же прохождении: финал перерисовывается на каждом
    // ответе догоняющей точки, и перезапись сдвигала бы отсчёт возврата.
    if (previous?.questId === questId && previous.finishedAt === record.finishedAt) return previous
    const next: QuestFinishRecord = {
      ownerId,
      questId,
      cityId: record.cityId?.trim() || undefined,
      cityName: record.cityName?.trim() || undefined,
      finishedAt: record.finishedAt,
    }
    await AsyncStorage.setItem(
      questFinishRecordKey(ownerId),
      JSON.stringify(next),
    )
    return next
  } catch (error) {
    devWarn('[questReturnVisit] failed to store finish record:', error)
    return null
  }
}

export async function markReturnVisitReported(record: QuestFinishRecord): Promise<void> {
  try {
    await AsyncStorage.setItem(
      questFinishRecordKey(record.ownerId),
      JSON.stringify({ ...record, returnReported: true } satisfies QuestFinishRecord),
    )
  } catch (error) {
    devWarn('[questReturnVisit] failed to mark return visit:', error)
  }
}

/**
 * Просьба об отзыве по этому финишу показана. Отдельное поле, а не удаление
 * записи: возврат (#1484) меряется по той же записи и после просьбы.
 */
export async function markQuestReviewPrompted(
  record: QuestFinishRecord,
  promptedAt: number,
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      questFinishRecordKey(record.ownerId),
      JSON.stringify({ ...record, reviewPromptedAt: promptedAt } satisfies QuestFinishRecord),
    )
  } catch (error) {
    devWarn('[questReturnVisit] failed to mark review prompt:', error)
  }
}

/**
 * Отзыв о квесте оставлен — просьбу по его записи гасим, чтобы каталог не
 * просил повторно. Чужой квест в записи не трогаем.
 */
export async function markQuestReviewLeft(ownerId: string, questId: string): Promise<void> {
  const record = await readQuestFinishRecord(ownerId)
  if (!record || record.questId !== questId || record.reviewPromptedAt) return
  await markQuestReviewPrompted(record, Date.now())
}

export async function markQuestReturnReminderScheduled(
  record: QuestFinishRecord,
  scheduledAt: number,
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      questFinishRecordKey(record.ownerId),
      JSON.stringify({ ...record, reminderScheduledAt: scheduledAt } satisfies QuestFinishRecord),
    )
  } catch (error) {
    devWarn('[questReturnVisit] failed to mark reminder:', error)
  }
}

export async function clearQuestFinishRecord(ownerId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(questFinishRecordKey(ownerId))
  } catch (error) {
    devWarn('[questReturnVisit] failed to clear finish record:', error)
  }
}

export type ReturnVisitDecision =
  | { report: false; expired: boolean }
  | { report: true; expired: false; daysSinceFinish: number }

/** Считать ли текущий заход возвратом по этой записи. */
export function evaluateReturnVisit(
  record: QuestFinishRecord | null,
  now: number,
): ReturnVisitDecision {
  if (!record || record.returnReported) return { report: false, expired: false }

  const elapsed = now - record.finishedAt
  // Часы устройства могли уехать назад — отрицательный разрыв не возврат.
  if (elapsed < RETURN_VISIT_MIN_GAP_MS) return { report: false, expired: false }
  if (elapsed > RETURN_VISIT_WINDOW_MS) return { report: false, expired: true }

  return {
    report: true,
    expired: false,
    daysSinceFinish: Math.floor(elapsed / (24 * 60 * 60 * 1000)),
  }
}
