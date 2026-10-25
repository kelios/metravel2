const ROUTING_API_KEY_CANDIDATES = [
  'EXPO_PUBLIC_ORS_API_KEY',
  'EXPO_PUBLIC_ROUTE_SERVICE_KEY',
  'EXPO_PUBLIC_ROUTE_SERVICE',
  'ORS_API_KEY',
  'ROUTE_SERVICE_KEY',
]

const MOCK_FLAG_NAMES = [
  'EXPO_PUBLIC_TRIPS_MOCK',
  'EXPO_PUBLIC_ACHIEVEMENTS_MOCK',
  'EXPO_PUBLIC_SAFETY_MOCK',
  'EXPO_PUBLIC_OSRM_MOCK',
]

// #2460: ассистент сайта под фича-флагом. Флаг требует адреса llama-server;
// локальный адрес модели в production-сборке — ошибка конфигурации.
const AI_ASSISTANT_FLAG_NAME = 'EXPO_PUBLIC_AI_ASSISTANT'
const AI_ASSISTANT_URL_NAME = 'EXPO_PUBLIC_AI_ASSISTANT_URL'
const AI_PICKS_FLAG_NAME = 'EXPO_PUBLIC_AI_PICKS'
const AI_PICKS_URL_NAME = 'EXPO_PUBLIC_AI_PICKS_URL'

const LEGACY_ROUTING_API_KEY_SOURCES = new Set([
  'EXPO_PUBLIC_ROUTE_SERVICE',
  'ORS_API_KEY',
  'ROUTE_SERVICE_KEY',
])

const isLocalHost = (host) =>
  host === 'localhost' ||
  host === '127.0.0.1' ||
  host === '::1' ||
  /^192\.168\./.test(host) ||
  /^10\./.test(host) ||
  /^172\.(1[6-9]|2\d|3[01])\./.test(host)

const isLikelySelfProxyApiUrl = (parsed) => {
  if (!parsed) return false
  const host = String(parsed.hostname || '').trim().toLowerCase()
  const port = String(parsed.port || '').trim()
  return (
    (host === 'localhost' || host === '127.0.0.1' || host === '::1') &&
    (port === '8081' || port === '8082' || port === '8085' || port === '19006')
  )
}

const isTruthyFlag = (value) => ['1', 'true'].includes(String(value || '').trim().toLowerCase())

const getAiAssistantDiagnosticsCore = (env = process.env, { isProduction = false } = {}) => {
  if (!isTruthyFlag(env[AI_ASSISTANT_FLAG_NAME])) return []
  const diagnostics = []
  const rawUrl = String(env[AI_ASSISTANT_URL_NAME] || '').trim()
  let parsed = null
  try {
    parsed = rawUrl ? new URL(rawUrl) : null
  } catch {
    parsed = null
  }
  if (!parsed || (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')) {
    diagnostics.push({
      code: 'AI_ASSISTANT_URL_INVALID',
      severity: 'error',
      message: `${AI_ASSISTANT_FLAG_NAME}=1 requires ${AI_ASSISTANT_URL_NAME} with an absolute http/https URL of the llama-server.`,
    })
  } else if (isProduction && isLocalHost(parsed.hostname)) {
    diagnostics.push({
      code: 'AI_ASSISTANT_LOCAL_URL_IN_PRODUCTION',
      severity: 'error',
      message: `${AI_ASSISTANT_URL_NAME} points to a local host in a production build; the site assistant would call a server that does not exist for visitors.`,
    })
  }
  if (isProduction) {
    diagnostics.push({
      code: 'AI_ASSISTANT_ENABLED_IN_PRODUCTION',
      severity: 'warning',
      message: `${AI_ASSISTANT_FLAG_NAME}=1 in a production build: the site assistant is enabled (owner decision 18.10.2026 keeps it off until metravel-llm has a server).`,
    })
  }
  return diagnostics
}

/**
 * Смысловой подбор (#2459): флаг без адреса допустим (same-origin `/ai/`), но
 * явный `EXPO_PUBLIC_AI_PICKS_URL` обязан быть абсолютным http(s)-адресом и не
 * может указывать на локальный хост в production-сборке.
 */
const getAiPicksDiagnosticsCore = (env = process.env, { isProduction = false } = {}) => {
  if (!isTruthyFlag(env[AI_PICKS_FLAG_NAME])) return []
  const rawUrl = String(env[AI_PICKS_URL_NAME] || '').trim()
  if (!rawUrl) return []
  let parsed = null
  try {
    parsed = new URL(rawUrl)
  } catch {
    parsed = null
  }
  if (!parsed || (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')) {
    return [{
      code: 'AI_PICKS_URL_INVALID',
      severity: 'error',
      message: `${AI_PICKS_URL_NAME} must be an absolute http/https origin of metravel-assist, or empty for same-origin /ai/.`,
    }]
  }
  if (isProduction && isLocalHost(parsed.hostname)) {
    return [{
      code: 'AI_PICKS_LOCAL_URL_IN_PRODUCTION',
      severity: 'error',
      message: `${AI_PICKS_URL_NAME} points to a local host in a production build; recommendation blocks would call a server that does not exist for visitors.`,
    }]
  }
  return []
}

const isLocalApiEnabled = (env = process.env) =>
  String(env.EXPO_PUBLIC_IS_LOCAL_API || env.IS_LOCAL_API || '').trim().toLowerCase() === 'true'

const resolveRoutingApiKeyWithSourceCore = (env = process.env) => {
  for (const key of ROUTING_API_KEY_CANDIDATES) {
    const value = String(env[key] || '').trim()
    if (value) {
      return { key: value, source: key }
    }
  }
  return { key: undefined, source: undefined }
}

const getRoutingConfigDiagnosticsCore = (env = process.env) => {
  const diagnostics = []
  const { key, source } = resolveRoutingApiKeyWithSourceCore(env)

  if (!key) {
    diagnostics.push({
      code: 'ROUTING_KEY_MISSING',
      message:
        'Routing API key is not set. Provide EXPO_PUBLIC_ORS_API_KEY (recommended) or EXPO_PUBLIC_ROUTE_SERVICE_KEY.',
    })
    return diagnostics
  }

  const configured = ROUTING_API_KEY_CANDIDATES
    .map((candidate) => ({ candidate, value: String(env[candidate] || '').trim() }))
    .filter((entry) => Boolean(entry.value))

  // Only compare values that are explicitly provided in the env object.
  // On web, Expo/Metro only injects EXPO_PUBLIC_* vars; non-prefixed vars
  // (ORS_API_KEY, ROUTE_SERVICE_KEY) may leak from the shell during bundling
  // with stale/different values, producing false-positive conflicts.
  const expoPublicConfigured = configured.filter((entry) =>
    entry.candidate.startsWith('EXPO_PUBLIC_')
  )
  const candidatesForConflict = expoPublicConfigured.length > 0 ? expoPublicConfigured : configured

  const uniqueValues = Array.from(new Set(candidatesForConflict.map((entry) => entry.value)))
  if (candidatesForConflict.length > 1 && uniqueValues.length > 1) {
    diagnostics.push({
      code: 'ROUTING_KEY_CONFLICT',
      message: `Multiple routing key env vars are set with different values. Active source: ${source}.`,
    })
  }

  if (source && LEGACY_ROUTING_API_KEY_SOURCES.has(source)) {
    diagnostics.push({
      code: 'ROUTING_KEY_LEGACY_ALIAS',
      message: `Routing key is loaded from legacy env var ${source}. Prefer EXPO_PUBLIC_ORS_API_KEY.`,
    })
  }

  return diagnostics
}

const getRuntimeConfigDiagnosticsCore = (env = process.env, options = {}) => {
  const diagnostics = []
  const apiUrlRaw = String(env.EXPO_PUBLIC_API_URL || '').trim()
  const platformOS = String(options.platformOS || 'web').trim().toLowerCase()

  if (!apiUrlRaw) {
    diagnostics.push({
      code: 'API_URL_MISSING',
      severity: 'error',
      message: 'EXPO_PUBLIC_API_URL is missing. API calls will fail.',
    })
  } else {
    try {
      const parsed = new URL(apiUrlRaw)
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        diagnostics.push({
          code: 'API_URL_INVALID',
          severity: 'error',
          message: `EXPO_PUBLIC_API_URL must use http/https. Current protocol: ${parsed.protocol}`,
        })
      } else if (isLikelySelfProxyApiUrl(parsed) && (platformOS === 'web' || isLocalApiEnabled(env))) {
        diagnostics.push({
          code: 'API_URL_SELF_PROXY',
          severity: 'error',
          message:
            'EXPO_PUBLIC_API_URL points to the local Expo web server. This causes /api requests to proxy back into Metro instead of the backend.',
        })
      } else if (parsed.protocol === 'http:' && !isLocalHost(parsed.hostname)) {
        diagnostics.push({
          code: 'API_URL_UNSAFE_HTTP',
          severity: 'warning',
          message: 'EXPO_PUBLIC_API_URL uses insecure HTTP for non-localhost endpoint.',
        })
      }
    } catch {
      diagnostics.push({
        code: 'API_URL_INVALID',
        severity: 'error',
        message: 'EXPO_PUBLIC_API_URL is not a valid absolute URL.',
      })
    }
  }

  const isProduction =
    String(env.NODE_ENV || '').trim().toLowerCase() === 'production' ||
    String(env.EXPO_PUBLIC_ENV || '').trim().toLowerCase() === 'production'

  for (const flagName of MOCK_FLAG_NAMES) {
    if (!['1', 'true'].includes(String(env[flagName] || '').trim().toLowerCase())) continue
    diagnostics.push({
      code: 'DEV_MOCK_FLAG_ENABLED',
      severity: isProduction ? 'error' : 'warning',
      message: `${flagName}=true is development-only and must be disabled in production.`,
    })
  }

  diagnostics.push(...getAiAssistantDiagnosticsCore(env, { isProduction }))
  diagnostics.push(...getAiPicksDiagnosticsCore(env, { isProduction }))

  const routingDiagnostics = getRoutingConfigDiagnosticsCore(env).map((diagnostic) => ({
    ...diagnostic,
    severity: 'warning',
  }))

  return diagnostics.concat(routingDiagnostics)
}

module.exports = {
  AI_ASSISTANT_FLAG_NAME,
  AI_ASSISTANT_URL_NAME,
  AI_PICKS_FLAG_NAME,
  AI_PICKS_URL_NAME,
  MOCK_FLAG_NAMES,
  getAiAssistantDiagnosticsCore,
  getAiPicksDiagnosticsCore,
  ROUTING_API_KEY_CANDIDATES,
  resolveRoutingApiKeyWithSourceCore,
  getRoutingConfigDiagnosticsCore,
  getRuntimeConfigDiagnosticsCore,
}
