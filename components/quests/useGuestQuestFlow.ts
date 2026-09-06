import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'expo-router'

import { buildLoginHref } from '@/utils/authNavigation'
import { queueAnalyticsEvent } from '@/utils/analytics'
import { trackRegisterCtaClicked } from '@/utils/growthFunnelAnalytics'
import {
  clearGuestQuestProgress,
  GUEST_QUEST_FREE_STEPS,
  loadGuestQuestProgress,
  saveGuestQuestProgress,
  type GuestQuestProgress,
} from '@/utils/guestQuestProgress'
import { fetchOrCreateProgress, updateProgress } from '@/api/quests'
import {
  countAnsweredSteps,
  mergeQuestProgress,
  normalizeQuestProgressSnapshot,
  snapshotFromServerProgress,
  toQuestProgressServerPayload,
} from '@/utils/questProgressMerge'

type GuestProgressPayload = {
  currentIndex: number
  unlockedIndex: number
  answers: Record<string, string>
  attempts: Record<string, number>
  hints: Record<string, boolean>
  showMap: boolean
  completed?: boolean
  skipped?: Record<string, boolean>
  earlyFinish?: boolean
  updatedAt?: number
  answeredAt?: Record<string, number>
}

type UseGuestQuestFlowParams = {
  questId: string
  cityId: string
  isAuthenticated: boolean
  /** Готовность quest bundle — миграцию запускаем только когда есть данные */
  enabled: boolean
}

/**
 * Гостевой поток квеста: локальное хранение прогресса (AsyncStorage, без токена),
 * загрузка стартового прогресса для гостя, переход на /login|/registration с
 * redirect обратно, и одноразовая миграция локального прогресса в аккаунт после
 * логина (fetchOrCreateProgress + updateProgress), затем очистка локального.
 */
export function useGuestQuestFlow({ questId, cityId, isAuthenticated, enabled }: UseGuestQuestFlowParams) {
  const router = useRouter()
  const [guestInitial, setGuestInitial] = useState<GuestQuestProgress | null | undefined>(undefined)
  const migratedRef = useRef(false)

  const redirectPath = questId && cityId ? `/quests/${cityId}/${questId}` : '/quests'

  // Загрузка гостевого прогресса (один раз, пока не залогинен).
  useEffect(() => {
    if (isAuthenticated || !enabled || !questId) {
      setGuestInitial(null)
      return
    }
    let cancelled = false
    void loadGuestQuestProgress(questId).then((progress) => {
      if (!cancelled) setGuestInitial(progress)
    })
    return () => {
      cancelled = true
    }
  }, [enabled, isAuthenticated, questId])

  const persistGuestProgress = useCallback(
    (data: GuestProgressPayload) => {
      if (!questId) return
      void saveGuestQuestProgress(questId, {
        currentIndex: data.currentIndex,
        unlockedIndex: data.unlockedIndex,
        answers: data.answers,
        attempts: data.attempts,
        hints: data.hints,
        showMap: data.showMap,
        completed: data.completed,
        skipped: data.skipped,
        earlyFinish: data.earlyFinish,
        updatedAt: data.updatedAt,
        answeredAt: data.answeredAt,
      })
    },
    [questId],
  )

  const goToLogin = useCallback(() => {
    queueAnalyticsEvent('quest_guest_gate_login_click', { quest_id: questId, city: cityId })
    router.push(buildLoginHref({ redirect: redirectPath, intent: 'quest' }) as never)
  }, [cityId, questId, redirectPath, router])

  const goToRegister = useCallback(() => {
    queueAnalyticsEvent('quest_guest_gate_register_click', { quest_id: questId, city: cityId })
    trackRegisterCtaClicked({ source: 'quest_guest_gate', intent: 'quest', authState: 'guest' })
    const href = `/registration?redirect=${encodeURIComponent(redirectPath)}&intent=quest`
    router.push(href as never)
  }, [cityId, questId, redirectPath, router])

  // Миграция локального прогресса в аккаунт после логина.
  useEffect(() => {
    if (!isAuthenticated || !enabled || !questId || migratedRef.current) return
    migratedRef.current = true

    void (async () => {
      const guestProgress = await loadGuestQuestProgress(questId)
      if (!guestProgress || countAnsweredSteps(guestProgress.answers) === 0) return
      try {
        const serverProgress = await fetchOrCreateProgress(questId)
        // Тот же путь слияния, что и у авторизованной синхронизации: аккаунт мог
        // уже пройти часть квеста на другом устройстве — ни гостевые, ни
        // серверные ответы не теряем.
        const { merged, serverNeedsPush } = mergeQuestProgress(
          normalizeQuestProgressSnapshot(guestProgress),
          snapshotFromServerProgress(serverProgress),
        )
        if (serverNeedsPush) {
          await updateProgress(serverProgress.id, toQuestProgressServerPayload(merged))
          queueAnalyticsEvent('quest_guest_progress_migrated', {
            quest_id: questId,
            answered: countAnsweredSteps(merged.answers),
          })
        }
        // #1803: чистим гостевую копию ТОЛЬКО после успешного слияния. Раньше
        // это стояло в `finally`, и упавшее создание строки уносило гостевые
        // ответы безвозвратно: после разведения чтения и создания у строки
        // появилось два независимых создателя (эта миграция и флаш синхронизации),
        // а `quest_progress` несёт unique_together (quest, user) — проигравший
        // POST получает 400.
        await clearGuestQuestProgress(questId)
      } catch (error) {
        const { devError } = require('@/utils/logger')
        devError('Guest quest progress migration failed, local copy kept:', error)
        migratedRef.current = false
      }
    })()
  }, [enabled, isAuthenticated, questId])

  return {
    guestInitial,
    guestReady: guestInitial !== undefined,
    guestFreeSteps: GUEST_QUEST_FREE_STEPS,
    persistGuestProgress,
    goToLogin,
    goToRegister,
  }
}
