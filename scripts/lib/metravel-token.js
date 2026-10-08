'use strict'

const os = require('node:os')
const path = require('node:path')
const { TokenError, formatTokenError, validateToken, containsControl } = require('./metravel-token-errors')
const { parseSource, readTokenCandidate, readRegular, protectedCache, assertRefreshDestinations, persistToken, withRefreshLock, fixtureHome, assertContained } = require('./metravel-token-cache')
const { targetPolicy, endpointUrl, snapshotBody, trustedRequest } = require('./metravel-token-transport')
const refreshFlights = new Map()
const PROFILES = new Set(['qa104', 'owner', 'editor', 'staff-readonly'])

function qaTokenSources({ explicit, env = process.env, homeDir = os.homedir(), extraSources = [] } = {}) {
  return [
    { kind: 'value', value: explicit }, { kind: 'env', name: 'METRAVEL_TOKEN', env },
    ...extraSources, { kind: 'file', path: path.join(homeDir, '.metravel_token'), format: 'plain' },
  ]
}

// Cache names and their historical precedence live only at this boundary.
// An alias is a candidate, never authority to overwrite another identity.
function toolTokenSources({ explicit, order = ['env', 'home'], env = process.env, homeDir = os.homedir(), rootDir = process.cwd() } = {}) {
  const known = {
    env: { kind: 'env', name: 'METRAVEL_TOKEN', env },
    home: { kind: 'file', path: path.join(homeDir, '.metravel_token'), format: 'plain' },
    json: { kind: 'file', path: path.join(rootDir, '.secrets', 'metravel-token.json'), format: 'json' },
    mcp: { kind: 'file', path: path.join(rootDir, '.secrets', 'mcp_token.json'), format: 'json' },
    editorEnv: { kind: 'env', name: 'METRAVEL_EDITOR_TOKEN', env },
    editorHome: { kind: 'file', path: path.join(homeDir, '.metravel_editor_token'), format: 'plain' },
  }
  if (!Array.isArray(order) || order.some((name) => !Object.prototype.hasOwnProperty.call(known, name))) throw new TokenError('configuration')
  return [{ kind: 'value', value: explicit }, ...order.map((name) => known[name])]
}

function normalizeLoginCredentials(values, requireOwner = true) {
  if (!values || typeof values.email !== 'string' || typeof values.password !== 'string' || !values.password ||
      containsControl(values.email) || (values.ownerEmail !== undefined && (typeof values.ownerEmail !== 'string' || containsControl(values.ownerEmail)))) {
    throw new TokenError('credentials', { operation: 'login' })
  }
  const email = values.email.trim()
  const ownerEmail = typeof values.ownerEmail === 'string' ? values.ownerEmail.trim() : ''
  if (!email || (requireOwner && !ownerEmail) || (values.ownerEmail !== undefined && !ownerEmail) ||
      (ownerEmail && email.toLowerCase() === ownerEmail.toLowerCase())) throw new TokenError('credentials', { operation: 'login' })
  return { email, password: values.password }
}

function primaryCredentials(options = {}) {
  const env = options.env || process.env
  const file = path.resolve(options.envFile || path.join(process.cwd(), '.env.e2e'))
  if (path.basename(file) !== '.env.e2e') throw new TokenError('credentials', { operation: 'login' })
  const parsed = {}
  // The existing e2e-env-files applyEnvFile mutates global process.env and also
  // exposes a loader for .env.dev/.env. Keep its quote/first-value semantics here
  // for the selected primary file only, without changing global environment.
  const stored = readRegular(file)
  if (stored) for (const line of stored.bytes.toString('utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
    if (parsed[key] == null) parsed[key] = value
  }
  const email = env.E2E_EMAIL || parsed.E2E_EMAIL
  const password = env.E2E_PASSWORD || parsed.E2E_PASSWORD
  const ownerEmail = env.E2E_EMAIL2 || parsed.E2E_EMAIL2
  return normalizeLoginCredentials({ email, password, ownerEmail })
}

function createTokenSession(options = {}) {
  const profile = options.profile
  const expectedUserId = options.expectedUserId == null && ['qa104', 'staff-readonly'].includes(profile) ? 104 : options.expectedUserId
  if (!PROFILES.has(profile) || !Number.isSafeInteger(expectedUserId) || expectedUserId < 1 ||
      (['qa104', 'staff-readonly'].includes(profile) && expectedUserId !== 104)) throw new TokenError('configuration', { operation: 'configure' })
  const target = targetPolicy(options.origin, options.fixture)
  const origin = target.origin
  const fixture = options.fixture
  if (fixture && !options.homeDir) throw new TokenError('configuration', { operation: 'configure' })
  const homeDir = fixture ? fixtureHome(options.homeDir) : options.homeDir || os.homedir()
  const sources = options.sources || []
  if (!Array.isArray(sources) || sources.length > 16) throw new TokenError('configuration', { operation: 'configure' })
  if (fixture) for (const source of sources) {
    if (source.kind === 'env' && (!source.env || source.env === process.env)) throw new TokenError('configuration', { operation: 'configure' })
    if (source.kind === 'file') assertContained(source.path, homeDir)
  }
  if (target.local && sources.some((source) => source.kind !== 'value' &&
      !(source.origin === origin && ((source.kind === 'file' && !protectedCache(source.path)) || (source.kind === 'env' && source.env && source.env !== process.env))))) {
    throw new TokenError('configuration', { operation: 'configure' })
  }
  const refreshPolicy = options.refreshPolicy || 'never'
  if (!['never', 'primary-qa'].includes(refreshPolicy) || (refreshPolicy === 'primary-qa' && (profile !== 'qa104' || target.local))) throw new TokenError('configuration', { operation: 'configure' })
  if (target.local && (options.credentials || options.writableCaches)) throw new TokenError('configuration', { operation: 'configure' })
  const canRefresh = profile === 'qa104' && refreshPolicy === 'primary-qa'
  const dedicated = { kind: 'file', path: path.join(homeDir, '.metravel_token.qa104'), format: 'plain' }
  const caches = options.writableCaches || [{ ...dedicated, authority: 'qa104' }]
  if (canRefresh && (!Array.isArray(caches) || !caches.length || caches.length > 8 || caches.some((cache) => protectedCache(cache.path)))) throw new TokenError('configuration', { operation: 'configure' })
  if (fixture) {
    for (const cache of caches) assertContained(cache.path, homeDir)
    for (const name of ['.metravel_token.qa104', '.metravel_token.profiles.json', '.metravel_token.qa104.lock']) assertContained(path.join(homeDir, name), homeDir)
    if (canRefresh && fixture.credentials) normalizeLoginCredentials(fixture.credentials, false)
  }
  if (canRefresh && !fixture && options.credentials && options.credentials.env && Object.prototype.hasOwnProperty.call(options.credentials.env, 'E2E_EMAIL')) {
    const env = options.credentials.env
    normalizeLoginCredentials({ email: env.E2E_EMAIL, password: env.E2E_PASSWORD, ownerEmail: env.E2E_EMAIL2 })
  }
  let current = null
  const rejected = new Set()
  const verified = new Set()
  const verifiedIdentities = new Set()
  const family = `${origin}|qa104|${path.resolve(homeDir)}`
  const timeoutMs = Math.min(15000, options.timeoutMs || 15000)
  const refreshTimeoutMs = Math.min(40000, options.refreshTimeoutMs || 40000)

  async function verify(token, deadline) {
    if (verified.has(token)) return token
    const response = await trustedRequest(origin, '/api/user/me/', {
      method: 'GET', headers: { Accept: 'application/json', Authorization: `Token ${token}` },
    }, { fixture, timeoutMs: deadline ? Math.min(timeoutMs, deadline - Date.now()) : timeoutMs })
    if (response.status === 401) { rejected.add(token); throw new TokenError('authentication', { operation: 'verify', status: 401 }) }
    if (response.status !== 200) throw new TokenError('response', { operation: 'verify', status: response.status })
    let data
    try { data = await response.json() } catch { throw new TokenError('identity', { operation: 'verify' }) }
    if (!data || !Number.isSafeInteger(data.id) || data.id !== expectedUserId) throw new TokenError('identity', { operation: 'verify' })
    verified.add(token)
    verifiedIdentities.add(token)
    return token
  }

  async function refresh() {
    if (!canRefresh) throw new TokenError('authentication', { operation: 'refresh', status: 401 })
    if (refreshFlights.has(family)) {
      const token = await refreshFlights.get(family)
      return verify(token)
    }
    const deadline = Date.now() + refreshTimeoutMs
    const flight = withRefreshLock(path.join(homeDir, '.metravel_token.qa104.lock'), deadline, async () => {
      const seen = new Set()
      // Dedicated authority is checked before aliases. A conflicting new valid
      // owner token is terminal, even when an old alias could still be used.
      for (const source of [dedicated, ...sources]) {
        const token = parseSource(source)
        if (!token || rejected.has(token) || seen.has(token)) continue
        seen.add(token)
        try { return await verify(token, deadline) }
        catch (error) {
          if (!(error instanceof TokenError) || error.status !== 401 || error.reason !== 'authentication') throw error
        }
      }
      try { assertRefreshDestinations({ origin, homeDir, caches, verifiedTokens: verifiedIdentities }) }
      catch (error) { throw error instanceof TokenError ? error : new TokenError('cache', { operation: 'persist' }) }
      const credentials = fixture ? (fixture.credentials && normalizeLoginCredentials(fixture.credentials, false)) : primaryCredentials(options.credentials)
      if (!credentials || typeof credentials.email !== 'string' || typeof credentials.password !== 'string' || !credentials.email || !credentials.password) throw new TokenError('credentials', { operation: 'login' })
      const response = await trustedRequest(origin, '/api/user/login/', {
        method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: Buffer.from(JSON.stringify(credentials)),
      }, { fixture, timeoutMs: Math.min(timeoutMs, deadline - Date.now()) })
      if (response.status !== 200) throw new TokenError('authentication', { operation: 'login', status: response.status })
      let data
      try { data = await response.json() } catch { throw new TokenError('response', { operation: 'login' }) }
      const token = validateToken(data && data.token)
      await verify(token, deadline)
      if (Date.now() >= deadline) throw new TokenError('timeout', { operation: 'refresh' })
      persistToken({ token, origin, homeDir, caches, verifiedTokens: verifiedIdentities })
      return token
    }, fixture ? fixture.lockHooks : undefined)
    refreshFlights.set(family, flight)
    try { return await flight } finally { if (refreshFlights.get(family) === flight) refreshFlights.delete(family) }
  }

  async function ensureToken() {
    if (current) return current
    const token = readTokenCandidate(sources)
    if (token) {
      try { current = await verify(token); return current }
      catch (error) {
        if (!(error instanceof TokenError) || error.reason !== 'authentication' || error.status !== 401) throw error
      }
    }
    if (!canRefresh) throw new TokenError(token ? 'authentication' : 'missing-token', { operation: 'verify', status: token ? 401 : undefined })
    current = await refresh()
    return current
  }

  async function request(endpoint, init = {}) {
    // Validate the destination before discovery/identity/login: an invalid URL
    // may not cause even an otherwise legitimate credential operation.
    endpointUrl(origin, endpoint)
    const method = (init.method || 'GET').toUpperCase()
    if (!['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'].includes(method)) throw new TokenError('configuration')
    if (init.json !== undefined && (init.body !== undefined || init.bodyFactory)) throw new TokenError('body')
    let originalBody
    try { originalBody = init.json !== undefined ? JSON.stringify(init.json) : init.bodyFactory ? await init.bodyFactory() : init.body }
    catch { throw new TokenError('body') }
    let frozen
    try { frozen = await snapshotBody(originalBody) } catch (error) { throw error instanceof TokenError ? error : new TokenError('body') }
    let headers
    try { headers = Object.fromEntries(new Headers(init.headers || {}).entries()) } catch { throw new TokenError('configuration') }
    // Caller-supplied transport/TLS/auth overrides never reach the adapter.
    for (const key of ['authorization', 'host', 'proxy-authorization', 'connection', 'content-length']) delete headers[key]
    if (init.json !== undefined) headers['content-type'] = 'application/json'
    else if (frozen.contentType) headers['content-type'] = frozen.contentType
    let token = await ensureToken()
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt && init.bodyFactory) {
        let next
        try { next = await snapshotBody(await init.bodyFactory(), frozen.boundary) } catch { throw new TokenError('body') }
        if (next.contentType !== frozen.contentType || Boolean(next.bytes) !== Boolean(frozen.bytes) || (next.bytes && !next.bytes.equals(frozen.bytes))) throw new TokenError('body')
      }
      const response = await trustedRequest(origin, endpoint, {
        method, headers: { ...headers, Authorization: `Token ${token}` }, body: frozen.bytes, signal: init.signal,
      }, { fixture, timeoutMs })
      if (response.status !== 401) return response
      rejected.add(token); verified.delete(token); current = null
      if (attempt || !canRefresh) throw new TokenError('authentication', { operation: 'request', status: 401 })
      token = await refresh(); current = token
    }
    throw new TokenError('authentication', { status: 401 })
  }

  return { ensureToken, request, origin, profile, expectedUserId }
}

module.exports = { createTokenSession, qaTokenSources, toolTokenSources, readTokenCandidate, TokenError, formatTokenError, targetPolicy, normalizeLoginCredentials }
