// Возврат после финиша (#1484): одно событие на прохождение, когда игрок
// снова открывает квесты через заметный промежуток после финала.

import { useEffect, useRef } from 'react'

import { trackReturnVisitAfterFinish } from '@/utils/questRetentionAnalytics'
import { useAuthStore } from '@/stores/authStore'
import { cancelQuestReturnReminder } from '@/services/notifications'
import {
  clearQuestFinishRecord,
  evaluateReturnVisit,
  markReturnVisitReported,
  readQuestFinishRecord,
  questRetentionOwnerId,
} from '@/utils/questReturnVisit'

/**
 * Вешается на экраны каталога квестов. Читает локальную отметку последнего
 * финиша и ровно один раз докладывает возврат; протухшую (за окном 30 дней)
 * запись убирает, чтобы она не висела вечно.
 */
export function useQuestReturnVisit(): void {
  const userId = useAuthStore((state) => state.userId)
  const ownerId = questRetentionOwnerId(userId)
  const checkedRef = useRef<string | null>(null)

  useEffect(() => {
    if (checkedRef.current === ownerId) return
    checkedRef.current = ownerId

    let cancelled = false
    void (async () => {
      const record = await readQuestFinishRecord(ownerId)
      if (cancelled || !record) return

      const decision = evaluateReturnVisit(record, Date.now())
      if (decision.expired) {
        await cancelQuestReturnReminder(ownerId, record.questId)
        await clearQuestFinishRecord(ownerId)
        return
      }
      if (!decision.report) return

      trackReturnVisitAfterFinish({
        questId: record.questId,
        cityId: record.cityId ?? null,
        daysSinceFinish: decision.daysSinceFinish,
      })
      await cancelQuestReturnReminder(ownerId, record.questId)
      await markReturnVisitReported(record)
    })()

    return () => {
      cancelled = true
    }
  }, [ownerId])
}
