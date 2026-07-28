/**
 * Regression tests for scripts/lib/fetchJson.js
 *
 * A single transient 502 on the last quest catalog page used to drop every
 * quest page, city landing and travel quest promo from a production build
 * while the build still reported success. Transient failures must retry;
 * deterministic ones must still fail fast so a dead endpoint is not masked.
 */

import http from 'http'
import type { AddressInfo } from 'net'

const {
  fetchJson,
  isRetryableFetchError,
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
        sleep: async (ms: number) => {
          delays.push(ms)
        },
      },
    )

    expect(result).toBe('recovered')
    expect(attempts).toBe(3)
    expect(delays).toEqual([10, 20])
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
  let handler: (req: http.IncomingMessage, res: http.ServerResponse) => void = () => {}

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      requests += 1
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
  })

  const options = { baseDelayMs: 1, onRetry: () => {} }

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
})
