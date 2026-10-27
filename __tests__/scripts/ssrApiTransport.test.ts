/** @jest-environment node */
import type { IncomingMessage, Server, ServerResponse } from 'node:http'
import type { Socket } from 'node:net'

const http = require('node:http')
const { ssrApiRequest, installSsrApiTransport, SSR_API_TRANSPORT } = require('@/scripts/lib/ssrApiTransport')

describe('SSR internal API transport', () => {
  let server: Server
  let origin = ''
  let handleRequest: ((request: IncomingMessage, response: ServerResponse) => void) | undefined
  const seen: Array<{ host?: string; forwarded?: string; path?: string; socket: Socket }> = []

  beforeEach(async () => {
    seen.length = 0
    handleRequest = undefined
    server = http.createServer((request: IncomingMessage, response: ServerResponse) => {
      seen.push({ host: request.headers.host, forwarded: request.headers['x-forwarded-proto'] as string | undefined,
        path: request.url, socket: request.socket })
      if (handleRequest) return handleRequest(request, response)
      if (request.url === '/redirect') {
        response.writeHead(301, { Location: '/elsewhere' })
        response.end()
        return
      }
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({ slug: 'demo' }))
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    origin = `http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}`
  })

  afterEach(async () => {
    jest.restoreAllMocks()
    server.closeAllConnections()
    await new Promise((resolve) => server.close(resolve))
    delete (globalThis as unknown as Record<symbol, unknown>)[SSR_API_TRANSPORT]
  })

  async function warmConnection() {
    await ssrApiRequest(`${origin}/warm`)
    // Let the HTTP agent return the completed connection to its free pool.
    await new Promise<void>((resolve) => setImmediate(resolve))
    return seen[0].socket
  }

  // Node fetch replaces a custom Host with the connection target; Django then
  // rejects the internal request as DisallowedHost.
  it('delivers the public Host header to the internal origin', async () => {
    const response = await ssrApiRequest(`${origin}/api/travels/by-slug/demo/`, {
      headers: { Accept: 'application/json', Host: 'metravel.by', 'X-Forwarded-Proto': 'https' },
      signal: new AbortController().signal,
    })
    expect(response.ok).toBe(true)
    await expect(response.json()).resolves.toEqual({ slug: 'demo' })
    expect(seen.at(-1)).toMatchObject({ host: 'metravel.by', forwarded: 'https' })
  })

  it('reports a redirect as a failed response instead of following it', async () => {
    const response = await ssrApiRequest(`${origin}/redirect`, { headers: { Host: 'metravel.by' } })
    expect(response).toMatchObject({ ok: false, status: 301 })
  })

  it('rejects an aborted request and installs one shared transport', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(ssrApiRequest(`${origin}/api/`, { headers: {}, signal: controller.signal })).rejects.toThrow()
    expect(installSsrApiTransport()).toBe(ssrApiRequest)
    expect(installSsrApiTransport()).toBe((globalThis as unknown as Record<symbol, unknown>)[SSR_API_TRANSPORT])
  })

  it('retries a reset reused socket once on a fresh connection, preserving public headers', async () => {
    const warmSocket = await warmConnection()
    let attempts = 0
    handleRequest = (request, response) => {
      if (++attempts === 1) request.socket.destroy()
      else response.end(JSON.stringify({ recovered: true }))
    }
    const response = await ssrApiRequest(`${origin}/retry`, {
      headers: { Accept: 'application/json', Host: 'metravel.by', 'X-Forwarded-Proto': 'https' },
    })
    await expect(response.json()).resolves.toEqual({ recovered: true })
    expect(attempts).toBe(2)
    expect(seen[1].socket).toBe(warmSocket)
    expect(seen[2].socket).not.toBe(warmSocket)
    expect(seen.slice(1)).toEqual([
      expect.objectContaining({ path: '/retry', host: 'metravel.by', forwarded: 'https' }),
      expect.objectContaining({ path: '/retry', host: 'metravel.by', forwarded: 'https' }),
    ])
  })

  it('does not retry a reset on a fresh connection', async () => {
    handleRequest = (request) => request.socket.destroy()
    await expect(ssrApiRequest(`${origin}/reset`)).rejects.toMatchObject({ code: 'ECONNRESET' })
    expect(seen).toHaveLength(1)
  })

  it('never makes a third attempt after the fresh retry also resets', async () => {
    await warmConnection()
    handleRequest = (request) => request.socket.destroy()
    await expect(ssrApiRequest(`${origin}/reset`)).rejects.toMatchObject({ code: 'ECONNRESET' })
    expect(seen.filter((request) => request.path === '/reset')).toHaveLength(2)
  })

  it('does not retry other request errors even on a reused socket', async () => {
    await warmConnection()
    const originalRequest = http.request
    const error = Object.assign(new Error('write failed'), { code: 'EPIPE' })
    let reusedSocket = false
    const requestSpy = jest.spyOn(http, 'request').mockImplementation((...args: unknown[]) => {
      const request = originalRequest.apply(http, args)
      request.once('socket', () => {
        reusedSocket = request.reusedSocket
        request.destroy(error)
      })
      return request
    })
    await expect(ssrApiRequest(`${origin}/broken-pipe`)).rejects.toBe(error)
    expect(reusedSocket).toBe(true)
    expect(requestSpy).toHaveBeenCalledTimes(1)
  })

  it('does not retry a reused connection after the response has started', async () => {
    const warmSocket = await warmConnection()
    handleRequest = (_request, response) => {
      response.writeHead(200, { 'Content-Type': 'application/json', 'Content-Length': '100' })
      response.write('{"slug":')
      setImmediate(() => response.destroy())
    }
    await expect(ssrApiRequest(`${origin}/truncated`)).rejects.toMatchObject({ code: 'ECONNRESET' })
    expect(seen[1].socket).toBe(warmSocket)
    expect(seen.filter((request) => request.path === '/truncated')).toHaveLength(1)
  })

  it('cancels the fresh retry with the original signal instead of extending its deadline', async () => {
    await warmConnection()
    let acknowledgeRetry: () => void = () => {}
    const retryStarted = new Promise<void>((resolve) => { acknowledgeRetry = resolve })
    let attempts = 0
    handleRequest = (request) => {
      if (++attempts === 1) request.socket.destroy()
      else acknowledgeRetry()
    }
    const controller = new AbortController()
    const pending = ssrApiRequest(`${origin}/retry-wait`, { signal: controller.signal })
    const assertion = expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    await retryStarted
    controller.abort()
    await assertion
    expect(attempts).toBe(2)
  })

  it('returns an HTTP failure once without retrying it', async () => {
    await warmConnection()
    handleRequest = (_request, response) => {
      response.writeHead(503, { 'Content-Type': 'application/json' })
      response.end('{}')
    }
    await expect(ssrApiRequest(`${origin}/unavailable`)).resolves.toMatchObject({ status: 503, ok: false })
    expect(seen.filter((request) => request.path === '/unavailable')).toHaveLength(1)
  })

  it('does not retry a response that exceeds the body bound', async () => {
    await warmConnection()
    handleRequest = (_request, response) => response.end(Buffer.alloc(32 * 1024 * 1024 + 1))
    await expect(ssrApiRequest(`${origin}/oversize`)).rejects.toThrow('byte bound')
    expect(seen.filter((request) => request.path === '/oversize')).toHaveLength(1)
  })

  it('does not retry invalid JSON', async () => {
    await warmConnection()
    handleRequest = (_request, response) => response.end('not JSON')
    const response = await ssrApiRequest(`${origin}/invalid-json`)
    await expect(response.json()).rejects.toThrow()
    expect(seen.filter((request) => request.path === '/invalid-json')).toHaveLength(1)
  })

  it('rejects synchronous request construction errors on the retry', async () => {
    await warmConnection()
    handleRequest = (request) => request.socket.destroy()
    const originalRequest = http.request
    const error = new Error('request construction failed')
    const requestSpy = jest.spyOn(http, 'request').mockImplementation((...args: unknown[]) => {
      if (requestSpy.mock.calls.length === 2) throw error
      return originalRequest.apply(http, args)
    })
    await expect(ssrApiRequest(`${origin}/retry-invalid`)).rejects.toBe(error)
    expect(requestSpy).toHaveBeenCalledTimes(2)
  })
})
