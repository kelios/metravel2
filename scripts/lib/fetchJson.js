/**
 * scripts/lib/fetchJson.js
 * Shared JSON fetch helper with bounded retries for build-time API calls.
 *
 * Deploy-time catalog fetches (SEO generation, static verification) hit the
 * production API dozens of times per build. A single transient 502 used to drop
 * a whole content surface from the release, so transient failures (5xx, 429,
 * timeouts, socket errors) retry with backoff while deterministic ones (other
 * 4xx, malformed JSON) still fail fast.
 */

const https = require('https')
const http = require('http')

const DEFAULT_ATTEMPTS = 3
const DEFAULT_BASE_DELAY_MS = 500
const DEFAULT_TIMEOUT_MS = 30000
const RETRYABLE_HTTP_STATUS = new Set([408, 425, 429, 500, 502, 503, 504])

/** Promise-based delay (injectable in tests via options.sleep) */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** Transient failures are worth another attempt; deterministic ones are not */
const isRetryableFetchError = (error) => {
  if (!error) return false
  if (typeof error.statusCode === 'number') return RETRYABLE_HTTP_STATUS.has(error.statusCode)
  return error.retryable === true
}

/** Single GET returning parsed JSON (follows redirects) */
const fetchJsonOnce = (url, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) => {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http
    const opts = { timeout: timeoutMs }
    // Allow self-signed certs in CI/local environments
    if (mod === https) opts.rejectUnauthorized = false

    const req = mod.get(url, opts, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume()
        return fetchJsonOnce(res.headers.location, { timeoutMs }).then(resolve, reject)
      }
      if (res.statusCode !== 200) {
        res.resume()
        const error = new Error(`HTTP ${res.statusCode} for ${url}`)
        error.statusCode = res.statusCode
        return reject(error)
      }

      let body = ''
      res.setEncoding('utf8')
      res.on('data', (chunk) => {
        body += chunk
      })
      res.on('end', () => {
        try {
          resolve(JSON.parse(body))
        } catch (error) {
          // A 200 with unparseable JSON is a contract problem, not a blip.
          error.retryable = false
          reject(error)
        }
      })
    })

    req.on('error', (error) => {
      error.retryable = true
      reject(error)
    })
    req.on('timeout', () => {
      req.destroy()
      const error = new Error(`Timeout: ${url}`)
      error.retryable = true
      reject(error)
    })
  })
}

/** Run an async task, retrying while shouldRetry() accepts the failure */
const withRetries = async (run, options = {}) => {
  const attempts = Math.max(1, options.attempts ?? DEFAULT_ATTEMPTS)
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS
  const shouldRetry = options.shouldRetry || isRetryableFetchError
  const wait = options.sleep || sleep

  let lastError
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await run(attempt)
    } catch (error) {
      lastError = error
      if (attempt >= attempts || !shouldRetry(error)) break
      const delayMs = baseDelayMs * 2 ** (attempt - 1)
      if (options.onRetry) options.onRetry({ error, attempt, attempts, delayMs })
      await wait(delayMs)
    }
  }
  throw lastError
}

const defaultOnRetry = ({ error, attempt, attempts, delayMs }) => {
  console.warn(`  ⚠️  ${error.message} — retry ${attempt}/${attempts - 1} in ${delayMs}ms`)
}

/** Fetch JSON with retries on transient failures */
const fetchJson = (url, options = {}) => {
  return withRetries(() => fetchJsonOnce(url, options), {
    ...options,
    onRetry: options.onRetry || defaultOnRetry,
  })
}

module.exports = {
  DEFAULT_ATTEMPTS,
  DEFAULT_BASE_DELAY_MS,
  RETRYABLE_HTTP_STATUS,
  fetchJson,
  fetchJsonOnce,
  isRetryableFetchError,
  sleep,
  withRetries,
}
