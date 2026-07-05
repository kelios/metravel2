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

type GuestProgressPayload = {
  currentIndex: number
  unlockedIndex: number
  answers: Record<string, string>
  attempts: Record<string, number>
  hints: Record<string, boolean>
  showMap: boolean
  completed?: boolean
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
      if (!guestProgress || Object.keys(guestProgress.answers).length === 0) return
      try {
        const serverProgress = await fetchOrCreateProgress(questId)
        // Не затираем более полный серверный прогресс, если он уже есть.
        const serverAnswered = Object.keys(serverProgress.answers ?? {}).length
        const guestAnswered = Object.keys(guestProgress.answers).length
        if (serverAnswered < guestAnswered) {
          await updateProgress(serverProgress.id, {
            current_index: guestProgress.currentIndex,
            unlocked_index: guestProgress.unlockedIndex,
            answers: guestProgress.answers,
            attempts: guestProgress.attempts,
            hints: guestProgress.hints,
            show_map: guestProgress.showMap,
            completed: guestProgress.completed,
          })
          queueAnalyticsEvent('quest_guest_progress_migrated', {
            quest_id: questId,
            answered: guestAnswered,
          })
        }
      } finally {
        await clearGuestQuestProgress(questId)
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
