'use strict'

const { createTokenSession, toolTokenSources, TokenError, formatTokenError, readTokenCandidate } = require('./metravel-token')
const { targetPolicy, trustedRequest } = require('./metravel-token-transport')

// All consumers declare an identity; there is no inferred owner -> QA fallback.
// Creation is lazy so --help and offline content dry-runs never read secrets.
function createToolSession({ origin = 'https://metravel.by', profile = 'qa104', expectedUserId = 104, explicit, order, ...options } = {}) {
  const target = targetPolicy(origin.replace(/\/api\/?$/, ''), options.fixture)
  let session
  const get = () => {
    if (!session) {
      session = createTokenSession({
        ...options, origin: target.origin, profile, expectedUserId,
        sources: options.sources || (target.local ? [{ kind: 'value', value: explicit }] : toolTokenSources({ explicit, order, ...options })),
        refreshPolicy: profile === 'qa104' && target.production ? 'primary-qa' : 'never',
      })
    }
    return session
  }
  return { ensureToken: () => get().ensureToken(), request: (endpoint, init) => get().request(endpoint, init) }
}

function bodyMaintenanceSession(options = {}) {
  const id = Number(process.env.METRAVEL_ACTOR_ID || 1)
  if (![1, 104].includes(id)) throw new TokenError('configuration')
  return createToolSession({ ...options, profile: id === 104 ? 'qa104' : 'owner', expectedUserId: id })
}

async function publicRequest(origin, endpoint, init) {
  return trustedRequest(targetPolicy(origin.replace(/\/api\/?$/, '')).origin, endpoint, init, { allowRedirectStatus: true })
}

async function requestText(session, method, url, body, headers = {}) {
  const response = await session.request(url, { method, body, headers })
  return { status: response.status, body: await response.text() }
}

function assertOk(response) {
  if (!response.ok) throw new TokenError('response', { status: response.status })
  return response
}

function parseResponseJson(text) {
  try { return JSON.parse(text) } catch { throw new TokenError('response') }
}

function rethrowTerminalAuthError(error) {
  if (error instanceof TokenError && ['authentication', 'identity'].includes(error.reason)) throw error
}

module.exports = { rethrowTerminalAuthError, createToolSession, bodyMaintenanceSession, publicRequest, requestText, assertOk, parseResponseJson, TokenError, formatTokenError, readTokenCandidate, toolTokenSources }
