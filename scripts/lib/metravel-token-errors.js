'use strict'

const REASONS = new Set([
  'configuration', 'origin', 'token-format', 'missing-token', 'identity', 'authentication',
  'credentials', 'network', 'timeout', 'redirect', 'response', 'cache', 'lock', 'body',
])
const OPERATIONS = new Set(['configure', 'read', 'verify', 'login', 'refresh', 'request', 'persist', 'cli'])

class TokenError extends Error {
  constructor(reason, { operation = 'request', status } = {}) {
    const safeReason = REASONS.has(reason) ? reason : 'response'
    const safeOperation = OPERATIONS.has(operation) ? operation : 'request'
    const safeStatus = Number.isInteger(status) && status >= 100 && status <= 599 ? status : undefined
    super(`metravel-auth: ${safeOperation}/${safeReason}${safeStatus ? ` (HTTP ${safeStatus})` : ''}`)
    this.name = 'TokenError'
    this.reason = safeReason
    this.operation = safeOperation
    this.status = safeStatus
  }
}

// Never interpolate an arbitrary exception, URL, response body or credential.
function formatTokenError(error) {
  return error instanceof TokenError
    ? new TokenError(error.reason, { operation: error.operation, status: error.status }).message
    : 'metravel-auth: request/response'
}

function containsControl(value, includeSpace = false) {
  return Array.from(value).some((character) => character.charCodeAt(0) <= (includeSpace ? 32 : 31) || character.charCodeAt(0) === 127)
}

function validateToken(value) {
  if (typeof value !== 'string' || !value.length || value.length > 4096 || (containsControl(value) || /\s/.test(value))) {
    throw new TokenError('token-format', { operation: 'read' })
  }
  return value
}

module.exports = { TokenError, formatTokenError, validateToken, containsControl }
