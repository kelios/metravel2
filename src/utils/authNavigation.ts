import { Platform } from 'react-native'

type BuildLoginHrefParams = {
  redirect?: string | null
  intent?: string | null
  fallbackRedirect?: string
}

const normalizeRedirect = (value: string, fallback: string) => {
  const raw = String(value || '').trim()
  if (!raw) return fallback
  // Only allow internal paths.
  if (!raw.startsWith('/')) return fallback
  return raw
}

export const getWebRedirectPath = (fallbackRedirect: string = '/') => {
  if (Platform.OS !== 'web') return fallbackRedirect
  if (typeof window === 'undefined') return fallbackRedirect

  try {
    const { pathname, search, hash } = window.location
    const combined = `${pathname || ''}${search || ''}${hash || ''}`
    return normalizeRedirect(combined, fallbackRedirect)
  } catch {
    return fallbackRedirect
  }
}

export const buildLoginHref = ({
  redirect,
  intent,
  fallbackRedirect = '/',
}: BuildLoginHrefParams = {}) => {
  const resolvedRedirect =
    redirect && redirect.trim().length > 0 ? normalizeRedirect(redirect, fallbackRedirect) : getWebRedirectPath(fallbackRedirect)

  const params = new URLSearchParams()
  params.set('redirect', resolvedRedirect)
  if (intent) params.set('intent', String(intent))
  return `/login?${params.toString()}`
}

