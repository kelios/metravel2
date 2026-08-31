/**
 * scripts/lib/fetchJson.js
 * Shared JSON fetch helper with bounded retries for build-time API calls.
 *
 * Deploy-time catalog fetches (SEO generation, static verification) hit the
 * production API dozens of times per build. A single transient 502 used to drop
 * a whole content surface from the release, so transient failures (5xx, 429,
 * timeouts, socket errors) retry with backoff while deterministic ones (other
 * 4xx, malformed JSON) still fail fast.
 *
 * #1394: prod nginx guards /api with `limit_req zone=api rate=30r/s burst=60
 * nodelay` keyed by client IP, so a build that floods the API is rejected by
 * its own load. A rate-limit answer therefore gets its own, much longer backoff
 * (plus `Retry-After` when the server sends one) — a 500 ms retry just lands
 * back inside the still-closed window. Every request also carries a build
 * User-Agent so such a burst is attributable in the prod access log.
 */

const https = require('https')
const http = require('http')

const { readResponseText, withAcceptEncoding } = require('./httpText')

const DEFAULT_ATTEMPTS = 3
const DEFAULT_BASE_DELAY_MS = 500
const DEFAULT_TIMEOUT_MS = 30000
const RETRYABLE_HTTP_STATUS = new Set([408, 425, 429, 500, 502, 503, 504])
/** Rate-limit answers need to outwait the limiter window, not just a blip */
const RATE_LIMIT_HTTP_STATUS = new Set([429, 503])
const RATE_LIMIT_BASE_DELAY_MS = 2000
/** Ceiling for one wait, so a hostile/absurd Retry-After cannot stall a build */
const MAX_RETRY_DELAY_MS = 30000
/** Batched retries fire in lockstep otherwise and re-trigger the same limiter */
const RETRY_JITTER_RATIO = 0.25
const DEFAULT_USER_AGENT = 'MeTravelSeoBuild/1.0 (+https://metravel.by)'

/** Promise-based delay (injectable in tests via options.sleep) */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** Transient failures are worth another attempt; deterministic ones are not */
const isRetryableFetchError = (error) => {
  if (!error) return false
  if (typeof error.statusCode === 'number') return RETRYABLE_HTTP_STATUS.has(error.statusCode)
  return error.retryable === true
}

/** 429/503 mean "you are too fast", not "the upstream is broken" */
const isRateLimitError = (error) =>
  typeof error?.statusCode === 'number' && RATE_LIMIT_HTTP_STATUS.has(error.statusCode)

/** Retry-After per RFC 9110: delta-seconds or an HTTP-date. Null when absent/unparseable. */
const parseRetryAfterMs = (headerValue, nowMs = Date.now()) => {
  if (headerValue === undefined || headerValue === null) return null
  const raw = String(headerValue).trim()
  if (!raw) return null
  if (/^\d+$/.test(raw)) return Number(raw) * 1000
  // Every HTTP-date form carries a month/day name. Without this guard Date.parse
  // swallows junk like `-5`, `+5` or `1.5` as a year and reports "retry now".
  if (!/[a-z]/i.test(raw)) return null
  const retryAt = Date.parse(raw)
  if (Number.isNaN(retryAt)) return null
  return Math.max(0, retryAt - nowMs)
}

/** How long to wait before the next attempt: own jittered backoff, extended by Retry-After */
const retryDelayMs = (error, options = {}) => {
  const attempt = options.attempt ?? 1
  const random = options.random || Math.random

  const base = isRateLimitError(error)
    ? options.rateLimitBaseDelayMs ?? RATE_LIMIT_BASE_DELAY_MS
    : options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS
  const backoff = base * 2 ** (attempt - 1) * (1 + RETRY_JITTER_RATIO * random())
  // A server hint may only lengthen the wait. `Retry-After: 0`, or a date that
  // clock skew already put in the past, would otherwise turn the retry into a
  // hot loop straight back into the still-closed limiter window.
  const hinted = Number.isFinite(error?.retryAfterMs) ? Math.max(0, error.retryAfterMs) : 0
  // Clamp last: jitter applied after the cap used to push a wait past the ceiling.
  return Math.min(MAX_RETRY_DELAY_MS, Math.round(Math.max(backoff, hinted)))
}

/** Single GET returning parsed JSON (follows redirects) */
const fetchJsonOnce = (
  url,
  { timeoutMs = DEFAULT_TIMEOUT_MS, userAgent = DEFAULT_USER_AGENT, headers } = {},
) => {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http
    const opts = {
      timeout: timeoutMs,
      // #1649: advertise exactly the encodings readResponseText() can undo, so
      // an intermediary never hands us compressed bytes we would read as text.
      headers: withAcceptEncoding({ 'User-Agent': userAgent, Accept: 'application/json', ...(headers || {}) }),
    }
    // Allow self-signed certs in CI/local environments
    if (mod === https) opts.rejectUnauthorized = false

    const req = mod.get(url, opts, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume()
        return fetchJsonOnce(res.headers.location, { timeoutMs, userAgent, headers }).then(resolve, reject)
      }
      if (res.statusCode !== 200) {
        res.resume()
        const error = new Error(`HTTP ${res.statusCode} for ${url}`)
        error.statusCode = res.statusCode
        const retryAfterMs = parseRetryAfterMs(res.headers['retry-after'])
        if (retryAfterMs !== null) error.retryAfterMs = retryAfterMs
        return reject(error)
      }

      // #1649: the whole body is buffered and decoded once. Accumulating
      // `body += chunk` decoded every transport chunk on its own and turned a
      // code point split across a chunk boundary into two U+FFFD.
      readResponseText(res).then(
        (body) => {
          try {
            resolve(JSON.parse(body))
          } catch (error) {
            // A 200 with unparseable JSON is a contract problem, not a blip.
            error.retryable = false
            reject(error)
          }
        },
        (error) => {
          // A truncated or half-decompressed body is a transport failure; an
          // undecodable codec is tagged non-retryable where it is detected.
          if (error.retryable === undefined) error.retryable = true
          reject(error)
        },
      )
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
  const shouldRetry = options.shouldRetry || isRetryableFetchError
  const wait = options.sleep || sleep

  let lastError
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await run(attempt)
    } catch (error) {
      lastError = error
      if (attempt >= attempts || !shouldRetry(error)) break
      const delayMs = retryDelayMs(error, {
        attempt,
        baseDelayMs: options.baseDelayMs,
        rateLimitBaseDelayMs: options.rateLimitBaseDelayMs,
        random: options.random,
      })
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
  DEFAULT_USER_AGENT,
  MAX_RETRY_DELAY_MS,
  RATE_LIMIT_BASE_DELAY_MS,
  RATE_LIMIT_HTTP_STATUS,
  RETRYABLE_HTTP_STATUS,
  RETRY_JITTER_RATIO,
  fetchJson,
  fetchJsonOnce,
  isRateLimitError,
  isRetryableFetchError,
  parseRetryAfterMs,
  retryDelayMs,
  sleep,
  withRetries,
}
