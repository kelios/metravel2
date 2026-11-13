/** @jest-environment node */
import { EventEmitter } from 'node:events'
import type { IncomingMessage, RequestOptions } from 'node:http'

const http = require('node:http')
const { ssrApiRequest } = require('@/scripts/lib/ssrApiTransport')

describe('SSR API request header construction', () => {
  const url = 'http://app:8000/api/travels/by-slug/demo/'
  const attempts: Array<{ target: URL; options: RequestOptions }> = []
  let outcomes: Array<number | Error> = []

  beforeEach(() => {
    jest.useFakeTimers()
    jest.spyOn(console, 'warn').mockImplementation(() => {})
    attempts.length = 0
    outcomes = []
    // Only the network primitive is mocked; the real transport constructs all
    // request options, handles responses, and decides whether to retry.
    jest.spyOn(http, 'request').mockImplementation((...args: unknown[]) => {
      const [target, options, onResponse] = args as [URL, RequestOptions, (response: IncomingMessage) => void]
      attempts.push({ target, options })
      const request = new EventEmitter()
      return Object.assign(request, {
        end: () => {
          const outcome = outcomes.shift() ?? 200
          if (outcome instanceof Error) {
            request.emit('error', outcome)
            return
          }
          const response = Object.assign(new EventEmitter(), { statusCode: outcome })
          onResponse(response as IncomingMessage)
          response.emit('data', Buffer.from('{"slug":"demo"}'))
          response.emit('end')
        },
      })
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
    jest.useRealTimers()
  })

  it('marks renderer reads even when callers omit all headers', async () => {
    const response = await ssrApiRequest(url)
    await expect(response.json()).resolves.toEqual({ slug: 'demo' })
    expect(attempts).toHaveLength(1)
    expect(attempts[0].target.href).toBe(url)
    expect(attempts[0].options).toMatchObject({ method: 'GET', headers: { 'X-Metravel-Render': 'ssr' } })
  })

  it('preserves forwarded and custom headers without changing the caller object', async () => {
    const headers = Object.freeze({ Accept: 'application/json', Host: 'metravel.by', 'X-Forwarded-Proto': 'https', 'X-Request-ID': 'render-1' })
    const signal = new AbortController().signal
    await ssrApiRequest(url, { headers, signal })
    expect(attempts[0].options).toMatchObject({ method: 'GET', signal })
    expect(attempts[0].options.headers).toEqual({ ...headers, 'X-Metravel-Render': 'ssr' })
    expect(attempts[0].options.headers).not.toBe(headers)
    expect(headers).not.toHaveProperty('X-Metravel-Render')
  })

  it.each([
    { 'X-Metravel-Render': 'human' },
    { 'x-metravel-render': 'human' },
    { 'X-Metravel-Render': 'human', 'x-MeTrAvEl-ReNdEr': 'other' },
  ])('replaces conflicting renderer marker variants without mutating them: %j', async (conflicting) => {
    const headers = Object.freeze({ Host: 'metravel.by', ...conflicting })
    const original = { ...headers }
    await ssrApiRequest(url, { headers })
    expect(attempts[0].options.headers).toEqual({ Host: 'metravel.by', 'X-Metravel-Render': 'ssr' })
    expect(headers).toEqual(original)
  })

  it('marks both attempts while retaining the original signal, GET and header values', async () => {
    outcomes = [Object.assign(new Error('socket reset'), { code: 'ECONNRESET' }), 200]
    const headers = Object.freeze({ Host: 'metravel.by', 'X-Forwarded-Proto': 'https' })
    const signal = new AbortController().signal
    const pending = ssrApiRequest(url, { headers, signal })
    expect(attempts).toHaveLength(1)
    await jest.advanceTimersByTimeAsync(150)
    await expect(pending).resolves.toMatchObject({ status: 200, ok: true })
    expect(attempts).toHaveLength(2)
    for (const attempt of attempts) {
      expect(attempt.target.href).toBe(url)
      expect(attempt.options).toMatchObject({ method: 'GET', signal })
      expect(attempt.options.headers).toEqual({ ...headers, 'X-Metravel-Render': 'ssr' })
    }
    expect(attempts[0].options.agent).toBeUndefined()
    expect(attempts[1].options.agent).toBe(false)
    expect(jest.getTimerCount()).toBe(0)
  })

  it('marks a failed HTTP read without retrying or posting a view event', async () => {
    outcomes = [503]
    await expect(ssrApiRequest(url)).resolves.toMatchObject({ status: 503, ok: false })
    expect(attempts).toHaveLength(1)
    expect(attempts[0].target.pathname).not.toMatch(/\/view\//)
    expect(attempts[0].options).toMatchObject({ method: 'GET', headers: { 'X-Metravel-Render': 'ssr' } })
    expect(jest.getTimerCount()).toBe(0)
  })
})
