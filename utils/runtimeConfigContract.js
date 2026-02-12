const ROUTING_API_KEY_CANDIDATES = [
  'EXPO_PUBLIC_ORS_API_KEY',
  'EXPO_PUBLIC_ROUTE_SERVICE_KEY',
  'EXPO_PUBLIC_ROUTE_SERVICE',
  'ORS_API_KEY',
  'ROUTE_SERVICE_KEY',
]

const LEGACY_ROUTING_API_KEY_SOURCES = new Set([
  'EXPO_PUBLIC_ROUTE_SERVICE',
  'ORS_API_KEY',
  'ROUTE_SERVICE_KEY',
])

const isLocalHost = (host) => host === 'localhost' || host === '127.0.0.1' || host === '::1'

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

  const uniqueValues = Array.from(new Set(configured.map((entry) => entry.value)))
  if (configured.length > 1 && uniqueValues.length > 1) {
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

const getRuntimeConfigDiagnosticsCore = (env = process.env) => {
  const diagnostics = []
  const apiUrlRaw = String(env.EXPO_PUBLIC_API_URL || '').trim()

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

  const routingDiagnostics = getRoutingConfigDiagnosticsCore(env).map((diagnostic) => ({
    ...diagnostic,
    severity: 'warning',
  }))

  return diagnostics.concat(routingDiagnostics)
}

module.exports = {
  ROUTING_API_KEY_CANDIDATES,
  resolveRoutingApiKeyWithSourceCore,
  getRoutingConfigDiagnosticsCore,
  getRuntimeConfigDiagnosticsCore,
}

