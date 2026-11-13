// Мягкая просьба об отзыве после засчитанного прохождения (#1795).
//
// За всё время на проде не было ни одного отзыва: форма жила только на экране
// финала, где игрок обычно уже уходит с телефона. Просьба переиспользует запись
// финиша механизма возврата (#1484) — отдельного хранилища не заводим — и
// показывается ОДИН раз на квест, спустя паузу после финиша.

import { useCallback, useEffect, useRef, useState } from 'react'

import { useAuthStore } from '@/stores/authStore'
import { questRetentionOwnerId } from '@/utils/questReturnVisit'
import type { QuestReviewPrompt } from '@/utils/questReviewPromptCheck'

export type { QuestReviewPrompt } from '@/utils/questReviewPromptCheck'

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
    // Решение и отметка — за async-границей (`utils/questReviewPromptCheck`):
    // сюда доходит только вошедший пользователь. Чанк не догрузился — просьбы
    // в этот заход нет, как и при отсутствии записи финиша.
    void Promise.resolve()
      .then(() => import('@/utils/questReviewPromptCheck'))
      .then(({ claimQuestReviewPrompt }) => claimQuestReviewPrompt(ownerId, () => cancelled))
      .then((next) => {
        if (!cancelled && next) setPrompt(next)
      }, () => undefined)

    return () => {
      cancelled = true
    }
  }, [enabled, ownerId, userId])

  const dismiss = useCallback(() => setPrompt(null), [])

  return { prompt, dismiss }
}
