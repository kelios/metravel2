import { useCallback, useMemo } from 'react'
import { useRouter } from 'expo-router'
import { useAuth } from '@/context/AuthContext'
import { buildLoginHref, getWebRedirectPath } from '@/utils/authNavigation'

type Params = {
  intent?: string
  /** #2898: название того, что гость хотел сделать, — для заголовка экрана входа. */
  subject?: string | null
  redirect?: string
  fallbackRedirect?: string
  replace?: boolean
}

export function useRequireAuth(params: Params = {}) {
  const router = useRouter()
  const { isAuthenticated, authReady } = useAuth((auth) => ({
    isAuthenticated: auth.isAuthenticated,
    authReady: auth.authReady,
  }))

  const loginHref = useMemo(() => {
    const fallbackRedirect = params.fallbackRedirect ?? '/'
    const redirect = params.redirect ?? getWebRedirectPath(fallbackRedirect)
    return buildLoginHref({ redirect, intent: params.intent ?? null, fallbackRedirect, subject: params.subject })
  }, [params.fallbackRedirect, params.intent, params.redirect, params.subject])

  const pushAuth = useCallback((rawHref: string) => {
    // buildLoginHref returns string; expo-router expects Href — safe cast
    const href = rawHref as unknown as Parameters<typeof router.push>[0]
    if (params.replace) router.replace(href)
    else router.push(href)
  }, [params.replace, router])

  // Без аргументов: `requireAuth` передают прямо в `onPress`, и событие нажатия
  // не должно попасть в параметры ссылки.
  const requireAuth = useCallback(() => {
    if (!authReady) return false
    if (isAuthenticated) return true
    pushAuth(loginHref)
    return false
  }, [authReady, isAuthenticated, loginHref, pushAuth])

  /**
   * #2898: то же, но с названием элемента для заголовка экрана входа — когда оно
   * известно только в момент нажатия (общая кнопка избранного карточек).
   */
  const requireAuthFor = useCallback((subject: string | null | undefined) => {
    if (!authReady) return false
    if (isAuthenticated) return true
    const fallbackRedirect = params.fallbackRedirect ?? '/'
    pushAuth(buildLoginHref({
      redirect: params.redirect ?? getWebRedirectPath(fallbackRedirect),
      intent: params.intent ?? null,
      fallbackRedirect,
      subject,
    }))
    return false
  }, [authReady, isAuthenticated, params.fallbackRedirect, params.intent, params.redirect, pushAuth])

  return { isAuthenticated, authReady, loginHref, requireAuth, requireAuthFor }
}

