// Unified token resolver: prefer OAuth (owner's Google account) if logged in,
// otherwise fall back to the service-account key. Both stats scripts use this.
const oauth = require('./google-oauth')
const sa = require('./google-auth')

async function getAccessToken(scopes, keyPath, options = {}) {
  if (oauth.hasToken()) {
    return oauth.getAccessToken(options)
  }
  return sa.getAccessToken(scopes, keyPath, options)
}

function authMode() {
  return oauth.hasToken() ? 'oauth' : 'service-account'
}

module.exports = { getAccessToken, authMode }
