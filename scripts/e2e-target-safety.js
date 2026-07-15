const DEFAULT_LOCAL_E2E_API_URL = 'http://127.0.0.1:8000'
const {
  LIVE_CONTRACT_SUITE,
  PRODUCTION_SMOKE_SUITE,
} = require('./e2e-suite-classification')

const parseHttpUrl = (rawValue, label) => {
  let parsed
  try {
    parsed = new URL(rawValue)
  } catch {
    throw new Error(`${label} must be a valid http(s) URL, received: ${rawValue}`)
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`${label} must use http or https, received: ${rawValue}`)
  }

  return parsed
}

const isMetravelProductionUrl = (rawValue) => {
  if (!rawValue) return false
  const { hostname } = parseHttpUrl(rawValue, 'E2E target')
  return hostname === 'metravel.by' || hostname.endsWith('.metravel.by')
}

const resolveE2ETargets = (env = process.env) => {
  const suite = String(env.E2E_SUITE || '').trim().toLowerCase()
  const apiUrl = String(env.E2E_API_URL || DEFAULT_LOCAL_E2E_API_URL).trim()
  const baseUrl = String(env.BASE_URL || '').trim()
  const productionTarget = isMetravelProductionUrl(apiUrl) || isMetravelProductionUrl(baseUrl)

  if (suite === LIVE_CONTRACT_SUITE) {
    if (!String(env.E2E_API_URL || '').trim() || env.E2E_ALLOW_LIVE_MUTATIONS !== '1') {
      throw new Error(
        'Live-contract E2E requires an explicit E2E_API_URL and E2E_ALLOW_LIVE_MUTATIONS=1.',
      )
    }
  }

  if (productionTarget) {
    const explicitlyAllowed = env.E2E_ALLOW_PRODUCTION_API === '1'
    if (!explicitlyAllowed || suite !== PRODUCTION_SMOKE_SUITE) {
      throw new Error(
        'Production E2E targets are blocked. Use E2E_SUITE=production-smoke and ' +
          'E2E_ALLOW_PRODUCTION_API=1 for the read-only production smoke suite only.',
      )
    }
  }

  parseHttpUrl(apiUrl, 'E2E_API_URL')
  if (baseUrl) parseHttpUrl(baseUrl, 'BASE_URL')

  return {
    apiUrl,
    baseUrl,
    productionTarget,
    suite,
  }
}

module.exports = {
  DEFAULT_LOCAL_E2E_API_URL,
  LIVE_CONTRACT_SUITE,
  PRODUCTION_SMOKE_SUITE,
  isMetravelProductionUrl,
  resolveE2ETargets,
}
