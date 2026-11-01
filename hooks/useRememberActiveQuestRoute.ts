import { useEffect } from 'react'
import { AppState, Platform } from 'react-native'

import {
  forgetActiveQuestRoute,
  rememberActiveQuestRoute,
} from '@/utils/activeQuestResume'

/**
 * Держит адрес открытого квеста для возврата после холодного старта (native).
 * Уход в фон обновляет отметку времени — срок жизни считается от момента,
 * когда человек вышел из приложения. Уход с экрана внутри приложения (блюр,
 * назад) запись снимает: вернуть нужно только туда, где приложение выгрузили.
 */
export function useRememberActiveQuestRoute(href: string | null, active: boolean): void {
  useEffect(() => {
    if (Platform.OS === 'web' || !active || !href) return
    void rememberActiveQuestRoute(href)
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') void rememberActiveQuestRoute(href)
    })
    return () => {
      subscription.remove()
      void forgetActiveQuestRoute(href)
    }
  }, [active, href])
}
