import { useEffect, useRef } from 'react'
import { Linking } from 'react-native'
import { usePathname, useRootNavigationState, useRouter, type Href } from 'expo-router'

import { getInitialNotificationResponse } from '@/services/notifications'
import { readActiveQuestRouteForResume } from '@/utils/activeQuestResume'
import { mapIncomingAppLinkToHref, mapNotificationPayloadToHref } from '@/utils/incomingAppLinks'

/**
 * Холодный старт после того, как ОС выгрузила приложение посреди квеста,
 * возвращает на экран квеста вместо главной (см. utils/activeQuestResume).
 * Ссылка и тап по уведомлению важнее: если старт пришёл по ним, или к моменту
 * решения пользователь уже не на главной, ничего не делаем.
 */
export function useResumeActiveQuest(): void {
  const router = useRouter()
  const pathname = usePathname()
  const rootNavigationState = useRootNavigationState()
  const isNavigationReady = Boolean(rootNavigationState?.key)
  const routerRef = useRef(router)
  const pathnameRef = useRef(pathname)
  const decidedRef = useRef(false)
  const mountedRef = useRef(true)

  routerRef.current = router
  pathnameRef.current = pathname

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    // Решение одно на холодный старт: ре-рендеры и смена router его не повторяют.
    if (!isNavigationReady || decidedRef.current) return
    decidedRef.current = true

    void (async () => {
      const href = await readActiveQuestRouteForResume()
      if (!href || !mountedRef.current) return

      const initialUrl = await Linking.getInitialURL().catch(() => null)
      if (mapIncomingAppLinkToHref(initialUrl)) return

      const notification = await getInitialNotificationResponse()
      if (notification && mapNotificationPayloadToHref(notification.data)) return

      if (!mountedRef.current || pathnameRef.current !== '/') return
      routerRef.current.push(href as Href)
    })()
  }, [isNavigationReady])
}
