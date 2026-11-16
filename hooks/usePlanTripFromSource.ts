import { useCallback } from 'react'
import { Platform } from 'react-native'
import { useRouter } from 'expo-router'

import { useAuth } from '@/context/AuthContext'
import { buildLoginHref } from '@/utils/authNavigation'
import { useTrackedImpression } from '@/hooks/useTrackedImpression'
import type { TripPlannerSource } from '@/utils/tripPlannerAnalytics'

/** Намерение входа для действия «организовать поездку»: после входа посетитель возвращается в форму поездки. */
export const PLAN_TRIP_AUTH_INTENT = 'plan-trip'

/**
 * Действие «организовать поездку по материалу» — одно для страницы статьи (`CTASection`) и карточки
 * под ответом ассистента (#3295): вошедший посетитель попадает в форму новой поездки с подставленными
 * названием, описанием и ссылкой на материал (`buildTripPlanCreateHref*` из `utils/tripPlanLinks.ts`),
 * гость — на вход с намерением `plan-trip` и возвратом в ту же форму: после входа он продолжает с того
 * места, где нажал кнопку. Намерение `create-book` сюда не годится — после входа оно ведёт в форму новой
 * статьи (`resolvePostAuthPath`), а экран входа говорит о книге.
 *
 * Возвращает `Promise<boolean>`: `true` — переход в планировщик начат, `false` — посетителю показан вход
 * либо сессия ещё восстанавливается.
 */
export function usePlanTripFromSource(source?: TripPlannerSource, impressionKey = '') {
  const router = useRouter()
  const { isAuthenticated, authReady } = useAuth()

  const plannerImpression = useTrackedImpression(`${source}:${impressionKey}:${authReady}:${isAuthenticated}`, () => {
    if (authReady && source) {
      void import('@/utils/tripPlannerAnalytics')
        .then(({ trackTripPlannerImpression }) => trackTripPlannerImpression(source, isAuthenticated))
        .catch(() => { /* An unavailable analytics chunk must not affect the CTA. */ })
    }
  })

  const planTrip = useCallback(
    async (href: string): Promise<boolean> => {
      if (!href || authReady === false) return false
      let attributedHref = href
      if (Platform.OS === 'web') {
        try {
          const { beginTripPlannerEntry } = await import('@/utils/tripPlannerAnalytics')
          attributedHref = beginTripPlannerEntry(href, isAuthenticated, source)
        } catch { /* Analytics loading must not block functional navigation. */ }
      }
      if (isAuthenticated) {
        router.push(attributedHref as never)
        return true
      }
      router.push(buildLoginHref({ redirect: attributedHref, intent: PLAN_TRIP_AUTH_INTENT, fallbackRedirect: '/trips/plan/create' }) as never)
      return false
    },
    [authReady, isAuthenticated, router, source],
  )

  return { planTrip, isAuthenticated, plannerImpression }
}
