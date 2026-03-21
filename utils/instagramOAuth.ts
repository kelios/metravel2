const DEFAULT_INSTAGRAM_OAUTH_SCOPES = [
  'instagram_basic',
  'instagram_content_publish',
  'pages_read_engagement',
]

const DEFAULT_INSTAGRAM_OAUTH_CALLBACK_PATH = '/auth/instagram/callback'
const DEFAULT_INSTAGRAM_OAUTH_VERSION = 'v19.0'

type InstagramOAuthConfig = {
  authorizeUrl: string
  redirectUri: string
  scopes: string[]
  appId: string
}

type InstagramOAuthResolution =
  | {
      isConfigured: true
      config: InstagramOAuthConfig
      reason: ''
    }
  | {
      isConfigured: false
      config: null
      reason: string
    }

const normalizeOrigin = (rawValue: string): string => {
  const trimmed = String(rawValue || '').trim()
  if (!trimmed) return ''

  try {
    const url = new URL(trimmed)
    return `${url.protocol}//${url.host}`
  } catch {
    return trimmed.replace(/\/api\/?$/i, '').replace(/\/+$/, '')
  }
}

const getBackendOrigin = (): string => {
  const envApiUrl = String(process.env.EXPO_PUBLIC_API_URL || '').trim()
  const envOrigin = normalizeOrigin(envApiUrl)
  if (envOrigin) return envOrigin

  if (typeof window !== 'undefined' && window.location?.origin) {
    return String(window.location.origin)
  }

  return ''
}

const getInstagramOauthAppId = (): string =>
  String(process.env.EXPO_PUBLIC_META_APP_ID || process.env.EXPO_PUBLIC_INSTAGRAM_APP_ID || '').trim()

const getInstagramOauthScopes = (): string[] => {
  const rawScopes = String(process.env.EXPO_PUBLIC_INSTAGRAM_OAUTH_SCOPES || '').trim()
  if (!rawScopes) return DEFAULT_INSTAGRAM_OAUTH_SCOPES

  const scopes = rawScopes
    .split(',')
    .map((scope) => scope.trim())
    .filter(Boolean)

  return scopes.length > 0 ? scopes : DEFAULT_INSTAGRAM_OAUTH_SCOPES
}

const getInstagramOauthRedirectUri = (): string => {
  const explicitRedirect = String(process.env.EXPO_PUBLIC_INSTAGRAM_OAUTH_REDIRECT_URI || '').trim()
  if (explicitRedirect) return explicitRedirect

  const callbackPath =
    String(process.env.EXPO_PUBLIC_INSTAGRAM_OAUTH_CALLBACK_PATH || '').trim() ||
    DEFAULT_INSTAGRAM_OAUTH_CALLBACK_PATH
  const normalizedPath = callbackPath.startsWith('/') ? callbackPath : `/${callbackPath}`
  const backendOrigin = getBackendOrigin()

  return backendOrigin ? `${backendOrigin}${normalizedPath}` : ''
}

export const getInstagramOAuthResolution = (): InstagramOAuthResolution => {
  const appId = getInstagramOauthAppId()
  if (!appId) {
    return {
      isConfigured: false,
      config: null,
      reason: 'Укажите EXPO_PUBLIC_META_APP_ID для подключения Instagram через Meta OAuth.',
    }
  }

  const redirectUri = getInstagramOauthRedirectUri()
  if (!redirectUri) {
    return {
      isConfigured: false,
      config: null,
      reason: 'Не удалось определить redirect URI для Instagram OAuth.',
    }
  }

  const oauthVersion = String(process.env.EXPO_PUBLIC_INSTAGRAM_OAUTH_VERSION || '').trim() || DEFAULT_INSTAGRAM_OAUTH_VERSION
  const authorizeUrl = `https://www.facebook.com/${oauthVersion}/dialog/oauth`

  return {
    isConfigured: true,
    reason: '',
    config: {
      appId,
      authorizeUrl,
      redirectUri,
      scopes: getInstagramOauthScopes(),
    },
  }
}

export const buildInstagramOAuthUrl = (state?: string): string | null => {
  const resolution = getInstagramOAuthResolution()
  if (!resolution.isConfigured) return null

  const params = new URLSearchParams()
  params.set('client_id', resolution.config.appId)
  params.set('redirect_uri', resolution.config.redirectUri)
  params.set('scope', resolution.config.scopes.join(','))
  params.set('response_type', 'code')

  const normalizedState = String(state || '').trim()
  if (normalizedState) {
    params.set('state', normalizedState)
  }

  return `${resolution.config.authorizeUrl}?${params.toString()}`
}
