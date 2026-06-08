// Unified token resolver: prefer OAuth (owner's Google account) if logged in,
// otherwise fall back to the service-account key. Both stats scripts use this.
const oauth = require('./google-oauth')
const sa = require('./google-auth')

async function getAccessToken(scopes, keyPath) {
  if (oauth.hasToken()) {
    return oauth.getAccessToken(scopes)
  }
  return sa.getAccessToken(scopes, keyPath)
}

function authMode() {
  return oauth.hasToken() ? 'oauth' : 'service-account'
}

module.exports = { getAccessToken, authMode }
