import { useCallback, useMemo } from 'react'
import { useRouter } from 'expo-router'
import { useAuth } from '@/context/AuthContext'
import { buildLoginHref, getWebRedirectPath } from '@/utils/authNavigation'

type Params = {
  intent?: string
  redirect?: string
  fallbackRedirect?: string
  replace?: boolean
}

export function useRequireAuth(params: Params = {}) {
  const router = useRouter()
  const { isAuthenticated, authReady } = useAuth()

  const loginHref = useMemo(() => {
    const fallbackRedirect = params.fallbackRedirect ?? '/'
    const redirect = params.redirect ?? getWebRedirectPath(fallbackRedirect)
    return buildLoginHref({ redirect, intent: params.intent ?? null, fallbackRedirect })
  }, [params.fallbackRedirect, params.intent, params.redirect])

  const requireAuth = useCallback(() => {
    if (!authReady) return false
    if (isAuthenticated) return true

    const href = loginHref as any
    if (params.replace) router.replace(href)
    else router.push(href)
    return false
  }, [authReady, isAuthenticated, loginHref, params.replace, router])

  return { isAuthenticated, authReady, loginHref, requireAuth }
}

