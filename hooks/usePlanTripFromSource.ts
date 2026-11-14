import { useCallback } from 'react'
import { useRouter } from 'expo-router'

import { useAuth } from '@/context/AuthContext'
import { buildLoginHref } from '@/utils/authNavigation'

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
 * Возвращает `planTrip(href)`: `true` — переход в планировщик начат, `false` — посетителю показан вход
 * либо сессия ещё восстанавливается.
 */
export function usePlanTripFromSource() {
  const router = useRouter()
  const { isAuthenticated, authReady } = useAuth()

  const planTrip = useCallback(
    (href: string): boolean => {
      if (!href) return false
      if (isAuthenticated) {
        router.push(href as never)
        return true
      }
      // Пока сессия восстанавливается, посетитель может оказаться вошедшим: на вход не уводим.
      if (authReady === false) return false
      router.push(buildLoginHref({ redirect: href, intent: PLAN_TRIP_AUTH_INTENT, fallbackRedirect: '/trips/plan/create' }) as never)
      return false
    },
    [authReady, isAuthenticated, router],
  )

  return { planTrip, isAuthenticated }
}
