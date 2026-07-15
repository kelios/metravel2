import { Platform } from 'react-native'

type BuildLoginHrefParams = {
  redirect?: string | null
  intent?: string | null
  fallbackRedirect?: string
}

const RAW_WHITESPACE_PATTERN = /\s/
const SCHEME_AFTER_ROOT_PATTERN = /^\/[a-z][a-z\d+.-]*:/i
const PERCENT_ESCAPE_PATTERN = /%[\da-f]{2}/i
const MAX_DECODE_PASSES = 4

const hasControlCharacter = (value: string): boolean => {
  for (let index = 0; index < value.length; index += 1) {
    const charCode = value.charCodeAt(index)
    if (charCode <= 31 || charCode === 127) return true
  }
  return false
}

const isSafeInternalRedirect = (value: string): boolean => {
  if (!value) return false

  let layer = value
  for (let pass = 0; pass <= MAX_DECODE_PASSES; pass += 1) {
    if (
      !layer.startsWith('/') ||
      layer.startsWith('//') ||
      layer.includes('\\') ||
      hasControlCharacter(layer) ||
      SCHEME_AFTER_ROOT_PATTERN.test(layer) ||
      (pass === 0 && RAW_WHITESPACE_PATTERN.test(layer))
    ) {
      return false
    }

    if (!PERCENT_ESCAPE_PATTERN.test(layer)) {
      // A literal percent in the original value is malformed. A percent that
      // appears only after decoding (for example, `%25`) is safe URL data.
      return pass > 0 || !layer.includes('%')
    }

    let decoded: string
    try {
      decoded = decodeURIComponent(layer)
    } catch {
      // A malformed escape in the untrusted raw value is invalid. If a fully
      // valid first decode merely reveals a literal percent sequence in safe
      // internal URL data, there is no additional structural layer to inspect.
      return pass > 0
    }

    if (decoded === layer) return true
    layer = decoded
  }

  // Refuse unusually deep encoding instead of leaving another decoding layer
  // that could reveal a protocol-relative or scheme URL later.
  return false
}

export const normalizeInternalAuthRedirect = (
  value: unknown,
  fallbackRedirect: string = '/',
): string => {
  const safeFallback = isSafeInternalRedirect(fallbackRedirect) ? fallbackRedirect : '/'
  return typeof value === 'string' && isSafeInternalRedirect(value) ? value : safeFallback
}

export const resolvePostAuthPath = ({
  redirect,
  intent,
  fallbackRedirect = '/',
}: BuildLoginHrefParams = {}): string => {
  if (intent === 'create-book') return '/travel/new'
  if (intent === 'build-pdf') return '/export'
  return normalizeInternalAuthRedirect(redirect, fallbackRedirect)
}

export const getWebRedirectPath = (fallbackRedirect: string = '/') => {
  const safeFallback = normalizeInternalAuthRedirect(null, fallbackRedirect)
  if (Platform.OS !== 'web') return safeFallback
  if (typeof window === 'undefined') return safeFallback

  try {
    const { pathname, search, hash } = window.location
    const combined = `${pathname || ''}${search || ''}${hash || ''}`
    return normalizeInternalAuthRedirect(combined, safeFallback)
  } catch {
    return safeFallback
  }
}

export const buildLoginHref = ({
  redirect,
  intent,
  fallbackRedirect = '/',
}: BuildLoginHrefParams = {}) => {
  const resolvedRedirect =
    redirect && redirect.length > 0
      ? normalizeInternalAuthRedirect(redirect, fallbackRedirect)
      : getWebRedirectPath(fallbackRedirect)

  const params = new URLSearchParams()
  params.set('redirect', resolvedRedirect)
  if (intent) params.set('intent', String(intent))
  return `/login?${params.toString()}`
}

export const buildRegistrationHref = ({
  redirect,
  intent,
  fallbackRedirect = '/',
}: BuildLoginHrefParams = {}) => {
  const resolvedRedirect =
    redirect && redirect.length > 0
      ? normalizeInternalAuthRedirect(redirect, fallbackRedirect)
      : getWebRedirectPath(fallbackRedirect)

  const params = new URLSearchParams()
  params.set('redirect', resolvedRedirect)
  if (intent) params.set('intent', String(intent))
  return `/registration?${params.toString()}`
}
