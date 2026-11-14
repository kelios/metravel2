import { useCallback } from 'react'
import { useRouter } from 'expo-router'

import { useAuth } from '@/context/AuthContext'
import { useRequireAuth } from '@/hooks/useRequireAuth'

/**
 * Действие «организовать поездку по материалу» — одно для страницы статьи (`CTASection`) и карточки
 * под ответом ассистента (#3295): вошедший посетитель попадает в форму новой поездки с подставленными
 * названием, описанием и ссылкой на материал (`buildTripPlanCreateHref*` из `utils/tripPlanLinks.ts`),
 * гость — на экран входа с тем же намерением, что у кнопки на странице статьи.
 *
 * Возвращает `planTrip(href)`: `true` — переход в планировщик начат, `false` — посетителю показан вход.
 */
export function usePlanTripFromSource() {
  const router = useRouter()
  const { isAuthenticated } = useAuth()
  const { requireAuth } = useRequireAuth({ intent: 'create-book' })

  const planTrip = useCallback(
    (href: string): boolean => {
      if (!href) return false
      if (!isAuthenticated) {
        requireAuth()
        return false
      }
      router.push(href as never)
      return true
    },
    [isAuthenticated, requireAuth, router],
  )

  return { planTrip, isAuthenticated }
}
