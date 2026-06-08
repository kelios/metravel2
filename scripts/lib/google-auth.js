// Zero-dependency Google service-account auth (JWT -> access token).
// Uses Node built-in crypto + global fetch (Node 18+). No googleapis dep.
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const DEFAULT_KEY_PATHS = [
  process.env.GOOGLE_APPLICATION_CREDENTIALS,
  path.join(process.cwd(), '.secrets', 'gcp-service-account.json'),
].filter(Boolean)

function loadServiceAccount(keyPath) {
  const candidates = keyPath ? [keyPath, ...DEFAULT_KEY_PATHS] : DEFAULT_KEY_PATHS
  for (const p of candidates) {
    if (p && fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf8'))
    }
  }
  throw new Error(
    'Service-account key not found. Put it at .secrets/gcp-service-account.json ' +
      'or set GOOGLE_APPLICATION_CREDENTIALS to its path.'
  )
}

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

// Exchange a service-account key for an OAuth2 access token with given scopes.
async function getAccessToken(scopes, keyPath) {
  const sa = loadServiceAccount(keyPath)
  const now = Math.floor(Date.now() / 1000)
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claim = base64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: Array.isArray(scopes) ? scopes.join(' ') : scopes,
      aud: sa.token_uri,
      iat: now,
      exp: now + 3600,
    })
  )
  const signingInput = `${header}.${claim}`
  const signer = crypto.createSign('RSA-SHA256')
  signer.update(signingInput)
  const signature = signer
    .sign(sa.private_key)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
  const assertion = `${signingInput}.${signature}`

  const res = await fetch(sa.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Token exchange failed (${res.status}): ${text}`)
  }
  const json = await res.json()
  return { accessToken: json.access_token, serviceAccount: sa }
}

module.exports = { getAccessToken, loadServiceAccount }
