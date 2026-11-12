// Решение «просить ли отзыв» по записи финиша и отметка показа (#1795).
// Живёт за async-границей: хук `useQuestReviewPrompt` грузит его только для
// вошедшего пользователя — гостю, большинству посетителей каталога, этот код
// не нужен, а в стартовом чанке `__shared:quests-catalog` он занимал место (s39-B).

import {
  RETURN_VISIT_WINDOW_MS,
  markQuestReviewPrompted,
  readQuestFinishRecord,
  type QuestFinishRecord,
} from '@/utils/questReturnVisit'

/**
 * Пауза между финишем и просьбой. Сразу после финала просить незачем: форма и
 * так на экране финала, а второе напоминание в том же заходе — это навязчивость.
 */
export const QUEST_REVIEW_PROMPT_MIN_GAP_MS = 30 * 60 * 1000

export type QuestReviewPrompt = {
  questId: string
  cityId?: string
  cityName?: string
}

export type QuestReviewPromptDecision =
  | { show: false }
  | { show: true; prompt: QuestReviewPrompt }

/** Чистое решение «просить ли отзыв по этой записи финиша» — вынесено для тестов. */
export function evaluateQuestReviewPrompt(
  record: QuestFinishRecord | null,
  now: number,
): QuestReviewPromptDecision {
  if (!record || record.reviewPromptedAt) return { show: false }
  const elapsed = now - record.finishedAt
  // Часы устройства могли уехать назад — отрицательный разрыв не считаем.
  if (elapsed < QUEST_REVIEW_PROMPT_MIN_GAP_MS) return { show: false }
  if (elapsed > RETURN_VISIT_WINDOW_MS) return { show: false }
  return {
    show: true,
    prompt: { questId: record.questId, cityId: record.cityId, cityName: record.cityName },
  }
}

/**
 * Просьба по записи финиша владельца или `null`. Отметку ставим в момент
 * показа: «не чаще одного раза на квест» — это про показ, а не про закрытие.
 * Иначе проигнорированная просьба возвращалась бы на каждый заход в каталог.
 */
export async function claimQuestReviewPrompt(
  ownerId: string,
  cancelled: () => boolean,
): Promise<QuestReviewPrompt | null> {
  const record = await readQuestFinishRecord(ownerId)
  if (cancelled()) return null
  const decision = evaluateQuestReviewPrompt(record, Date.now())
  if (!decision.show || !record) return null
  await markQuestReviewPrompted(record, Date.now())
  return decision.prompt
}
