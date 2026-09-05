// Мягкая просьба об отзыве после засчитанного прохождения (#1795).
//
// За всё время на проде не было ни одного отзыва: форма жила только на экране
// финала, где игрок обычно уже уходит с телефона. Просьба переиспользует запись
// финиша механизма возврата (#1484) — отдельного хранилища не заводим — и
// показывается ОДИН раз на квест, спустя паузу после финиша.

import { useCallback, useEffect, useRef, useState } from 'react'

import { useAuthStore } from '@/stores/authStore'
import {
  RETURN_VISIT_WINDOW_MS,
  markQuestReviewPrompted,
  questRetentionOwnerId,
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
 * Возвращает просьбу об отзыве для каталога квестов. Гостю не показывается:
 * отзыв требует входа, а гостевое прохождение ограничено двумя шагами.
 */
export function useQuestReviewPrompt(enabled = true): {
  prompt: QuestReviewPrompt | null
  dismiss: () => void
} {
  const userId = useAuthStore((state) => state.userId)
  const ownerId = questRetentionOwnerId(userId)
  const [prompt, setPrompt] = useState<QuestReviewPrompt | null>(null)
  const checkedRef = useRef<string | null>(null)

  useEffect(() => {
    if (!enabled || userId == null || String(userId).trim() === '') {
      setPrompt(null)
      return undefined
    }
    if (checkedRef.current === ownerId) return undefined
    checkedRef.current = ownerId

    let cancelled = false
    void (async () => {
      const record = await readQuestFinishRecord(ownerId)
      if (cancelled) return
      const decision = evaluateQuestReviewPrompt(record, Date.now())
      if (!decision.show || !record) return
      // Отметку ставим в момент показа: «не чаще одного раза на квест» — это про
      // показ, а не про закрытие. Иначе проигнорированная просьба возвращалась бы
      // на каждый заход в каталог.
      await markQuestReviewPrompted(record, Date.now())
      if (cancelled) return
      setPrompt(decision.prompt)
    })()

    return () => {
      cancelled = true
    }
  }, [enabled, ownerId, userId])

  const dismiss = useCallback(() => setPrompt(null), [])

  return { prompt, dismiss }
}
