/**
 * Regression tests for scripts/lib/fetchJson.js
 *
 * A single transient 502 on the last quest catalog page used to drop every
 * quest page, city landing and travel quest promo from a production build
 * while the build still reported success. Transient failures must retry;
 * deterministic ones must still fail fast so a dead endpoint is not masked.
 *
 * #1394: a rate-limited build hit its own nginx `limit_req` zone, and a fixed
 * 500 ms retry landed back inside the still-closed window. 429/503 must back
 * off far longer, honour `Retry-After`, and every build request must carry an
 * attributable User-Agent.
 */

import http from 'http'
import type { AddressInfo } from 'net'

const {
  DEFAULT_USER_AGENT,
  MAX_RETRY_DELAY_MS,
  RATE_LIMIT_BASE_DELAY_MS,
  fetchJson,
  isRateLimitError,
  isRetryableFetchError,
  parseRetryAfterMs,
  retryDelayMs,
  withRetries,
} = require('@/scripts/lib/fetchJson')

const httpError = (statusCode: number): Error =>
  Object.assign(new Error(`HTTP ${statusCode}`), { statusCode })

describe('isRetryableFetchError', () => {
  it('treats transient upstream statuses as retryable', () => {
    for (const statusCode of [408, 425, 429, 500, 502, 503, 504]) {
      expect(isRetryableFetchError(httpError(statusCode))).toBe(true)
    }
  })

  it('treats deterministic client errors as final', () => {
    for (const statusCode of [400, 401, 403, 404, 410, 422]) {
      expect(isRetryableFetchError(httpError(statusCode))).toBe(false)
    }
  })

  it('retries socket/timeout failures but not malformed JSON', () => {
    expect(isRetryableFetchError(Object.assign(new Error('socket hang up'), { retryable: true }))).toBe(true)
    expect(isRetryableFetchError(Object.assign(new SyntaxError('Unexpected token'), { retryable: false }))).toBe(false)
    expect(isRetryableFetchError(new Error('unclassified'))).toBe(false)
    expect(isRetryableFetchError(null)).toBe(false)
  })
})

describe('isRateLimitError', () => {
  it('separates "you are too fast" from "the upstream is broken"', () => {
    expect(isRateLimitError(httpError(429))).toBe(true)
    expect(isRateLimitError(httpError(503))).toBe(true)
    expect(isRateLimitError(httpError(502))).toBe(false)
    expect(isRateLimitError(httpError(500))).toBe(false)
    expect(isRateLimitError(Object.assign(new Error('socket hang up'), { retryable: true }))).toBe(false)
    expect(isRateLimitError(null)).toBe(false)
  })
})

describe('parseRetryAfterMs', () => {
  const now = Date.parse('2026-08-10T12:00:00Z')

  it('reads delta-seconds', () => {
    expect(parseRetryAfterMs('0', now)).toBe(0)
    expect(parseRetryAfterMs('7', now)).toBe(7000)
    expect(parseRetryAfterMs(' 30 ', now)).toBe(30000)
  })

  it('reads an HTTP-date relative to now', () => {
    expect(parseRetryAfterMs('Mon, 10 Aug 2026 12:00:05 GMT', now)).toBe(5000)
  })

  it('clamps a date already in the past to zero', () => {
    expect(parseRetryAfterMs('Mon, 10 Aug 2026 11:59:00 GMT', now)).toBe(0)
  })

  it('returns null when the header is absent or unusable', () => {
    expect(parseRetryAfterMs(undefined, now)).toBeNull()
    expect(parseRetryAfterMs(null, now)).toBeNull()
    expect(parseRetryAfterMs('', now)).toBeNull()
    expect(parseRetryAfterMs('soon', now)).toBeNull()
  })

  it('rejects numeric junk instead of letting Date.parse read it as a year', () => {
    // Date.parse('-5') is the year 2001, i.e. "retry immediately" — the exact
    // hot loop this helper exists to prevent.
    for (const junk of ['-5', '+5', '1.5', '5s']) {
      expect(parseRetryAfterMs(junk, now)).toBeNull()
    }
  })
})

describe('retryDelayMs', () => {
  const noJitter = { random: () => 0 }

  it('backs off far longer for rate limits than for a broken upstream', () => {
    const rateLimited = retryDelayMs(httpError(503), { attempt: 1, ...noJitter })
    const brokenUpstream = retryDelayMs(httpError(502), { attempt: 1, baseDelayMs: 500, ...noJitter })

    expect(rateLimited).toBe(RATE_LIMIT_BASE_DELAY_MS)
    expect(brokenUpstream).toBe(500)
    expect(rateLimited).toBeGreaterThan(brokenUpstream)
  })

  it('grows exponentially per attempt', () => {
    expect(retryDelayMs(httpError(429), { attempt: 2, rateLimitBaseDelayMs: 1000, ...noJitter })).toBe(2000)
    expect(retryDelayMs(httpError(429), { attempt: 3, rateLimitBaseDelayMs: 1000, ...noJitter })).toBe(4000)
  })

  it('lets Retry-After lengthen the wait beyond its own backoff', () => {
    const error = Object.assign(httpError(503), { retryAfterMs: 12000 })
    expect(retryDelayMs(error, { attempt: 1, ...noJitter })).toBe(12000)
  })

  it('never lets Retry-After shorten the wait into the still-closed window', () => {
    // `Retry-After: 0` and a date already in the past both parse to 0 ms. Taking
    // that literally would retry instantly against the limiter that just said no.
    for (const retryAfterMs of [0, 200]) {
      const error = Object.assign(httpError(503), { retryAfterMs })
      expect(retryDelayMs(error, { attempt: 1, ...noJitter })).toBe(RATE_LIMIT_BASE_DELAY_MS)
    }
  })

  it('caps any single wait so an absurd Retry-After cannot stall the build', () => {
    const error = Object.assign(httpError(503), { retryAfterMs: 3600_000 })
    expect(retryDelayMs(error, { attempt: 1, ...noJitter })).toBe(MAX_RETRY_DELAY_MS)
    expect(retryDelayMs(httpError(503), { attempt: 20, ...noJitter })).toBe(MAX_RETRY_DELAY_MS)
  })

  it('applies the cap after jitter, so the ceiling is a real ceiling', () => {
    expect(retryDelayMs(httpError(503), { attempt: 20, random: () => 1 })).toBe(MAX_RETRY_DELAY_MS)
  })

  it('adds bounded jitter so a rejected batch does not retry in lockstep', () => {
    const base = retryDelayMs(httpError(503), { attempt: 1, rateLimitBaseDelayMs: 1000, random: () => 0 })
    const jittered = retryDelayMs(httpError(503), { attempt: 1, rateLimitBaseDelayMs: 1000, random: () => 1 })

    expect(base).toBe(1000)
    expect(jittered).toBeGreaterThan(base)
    expect(jittered).toBeLessThanOrEqual(1500)
  })
})

describe('withRetries', () => {
  it('returns the first successful attempt without waiting', async () => {
    const delays: number[] = []
    const result = await withRetries(async () => 'ok', {
      baseDelayMs: 10,
      sleep: async (ms: number) => {
        delays.push(ms)
      },
    })

    expect(result).toBe('ok')
    expect(delays).toEqual([])
  })

  it('retries transient failures with exponential backoff', async () => {
    const delays: number[] = []
    let attempts = 0

    const result = await withRetries(
      async () => {
        attempts += 1
        if (attempts < 3) throw httpError(502)
        return 'recovered'
      },
      {
        baseDelayMs: 10,
        random: () => 0,
        sleep: async (ms: number) => {
          delays.push(ms)
        },
      },
    )

    expect(result).toBe('recovered')
    expect(attempts).toBe(3)
    expect(delays).toEqual([10, 20])
  })

  it('waits out a rate limit for the interval the server asked for', async () => {
    const delays: number[] = []
    let attempts = 0

    const result = await withRetries(
      async () => {
        attempts += 1
        if (attempts < 2) throw Object.assign(httpError(503), { retryAfterMs: 4000 })
        return 'recovered'
      },
      {
        baseDelayMs: 10,
        random: () => 0,
        sleep: async (ms: number) => {
          delays.push(ms)
        },
      },
    )

    expect(result).toBe('recovered')
    expect(delays).toEqual([4000])
  })

  it('rethrows the last error once the attempt budget is spent', async () => {
    let attempts = 0

    await expect(
      withRetries(
        async () => {
          attempts += 1
          throw httpError(503)
        },
        { baseDelayMs: 1, sleep: async () => {} },
      ),
    ).rejects.toThrow('HTTP 503')

    expect(attempts).toBe(3)
  })

  it('does not burn attempts on a non-retryable error', async () => {
    let attempts = 0

    await expect(
      withRetries(
        async () => {
          attempts += 1
          throw httpError(404)
        },
        { baseDelayMs: 1, sleep: async () => {} },
      ),
    ).rejects.toThrow('HTTP 404')

    expect(attempts).toBe(1)
  })
})

describe('fetchJson over HTTP', () => {
  let server: http.Server
  let baseUrl = ''
  let requests = 0
  let seenHeaders: http.IncomingHttpHeaders = {}
  let handler: (req: http.IncomingMessage, res: http.ServerResponse) => void = () => {}

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      requests += 1
      seenHeaders = req.headers
      handler(req, res)
    })
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', resolve)
    })
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  })

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve())
    })
  })

  beforeEach(() => {
    requests = 0
    seenHeaders = {}
  })

  const options = { baseDelayMs: 1, rateLimitBaseDelayMs: 1, random: () => 0, onRetry: () => {} }

  it('recovers the payload after transient 502s', async () => {
    handler = (_req, res) => {
      if (requests < 3) {
        res.writeHead(502)
        res.end('bad gateway')
        return
      }
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ results: [{ quest_id: 'krakow-wawel', city_id: '12' }] }))
    }

    await expect(fetchJson(`${baseUrl}/api/quests/?page=7`, options)).resolves.toEqual({
      results: [{ quest_id: 'krakow-wawel', city_id: '12' }],
    })
    expect(requests).toBe(3)
  })

  it('gives up after the attempt budget when the endpoint stays down', async () => {
    handler = (_req, res) => {
      res.writeHead(503)
      res.end('unavailable')
    }

    await expect(fetchJson(`${baseUrl}/api/quests/`, options)).rejects.toThrow('HTTP 503')
    expect(requests).toBe(3)
  })

  it('fails fast on 404 instead of retrying a missing endpoint', async () => {
    handler = (_req, res) => {
      res.writeHead(404)
      res.end('not found')
    }

    await expect(fetchJson(`${baseUrl}/api/articles/`, options)).rejects.toThrow('HTTP 404')
    expect(requests).toBe(1)
  })

  it('does not retry a 200 that carries malformed JSON', async () => {
    handler = (_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end('<html>maintenance</html>')
    }

    await expect(fetchJson(`${baseUrl}/api/travels/`, options)).rejects.toThrow()
    expect(requests).toBe(1)
  })

  it('identifies itself so a build burst is attributable in the prod access log', async () => {
    handler = (_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ ok: true }))
    }

    await fetchJson(`${baseUrl}/api/travels/1/`, options)

    expect(seenHeaders['user-agent']).toBe(DEFAULT_USER_AGENT)
    expect(String(seenHeaders['user-agent'])).toContain('MeTravelSeoBuild')
  })

  it('waits the Retry-After the limiter sent before trying again', async () => {
    const delays: number[] = []
    handler = (_req, res) => {
      if (requests < 2) {
        res.writeHead(503, { 'retry-after': '3' })
        res.end('unavailable')
        return
      }
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ description: '<p>body</p>' }))
    }

    await expect(
      fetchJson(`${baseUrl}/api/travels/641/`, {
        ...options,
        sleep: async (ms: number) => {
          delays.push(ms)
        },
      }),
    ).resolves.toEqual({ description: '<p>body</p>' })

    expect(delays).toEqual([3000])
  })

  it('backs off past the limiter window when the 503 carries no Retry-After', async () => {
    const delays: number[] = []
    handler = (_req, res) => {
      res.writeHead(503)
      res.end('unavailable')
    }

    await expect(
      fetchJson(`${baseUrl}/api/travels/641/`, {
        onRetry: () => {},
        random: () => 0,
        sleep: async (ms: number) => {
          delays.push(ms)
        },
      }),
    ).rejects.toThrow('HTTP 503')

    expect(delays).toEqual([RATE_LIMIT_BASE_DELAY_MS, RATE_LIMIT_BASE_DELAY_MS * 2])
  })
})
