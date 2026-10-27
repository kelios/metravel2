/** @jest-environment node */
import type { IncomingMessage, Server, ServerResponse } from 'node:http'
import type { Socket } from 'node:net'

const http = require('node:http')
const { fetchUrl } = require('@/scripts/post-deploy-seo-check')

// #2827: nginx closes an idle keep-alive socket; the next GET written into it
// fails with "socket hang up" before reaching the server.
describe('post-deploy SEO check page fetch', () => {
  let server: Server
  let origin = ''
  let handleRequest: ((request: IncomingMessage, response: ServerResponse) => void) | undefined
  const seen: Array<{ path?: string; socket: Socket }> = []

  beforeEach(async () => {
    seen.length = 0
    handleRequest = undefined
    server = http.createServer((request: IncomingMessage, response: ServerResponse) => {
      seen.push({ path: request.url, socket: request.socket })
      if (handleRequest) return handleRequest(request, response)
      response.writeHead(200, { 'Content-Type': 'text/html' })
      response.end('<html><title>ok</title></html>')
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    origin = `http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}`
  })

  afterEach(async () => {
    server.closeAllConnections()
    await new Promise((resolve) => server.close(resolve))
  })

  async function warmConnection() {
    await fetchUrl(`${origin}/warm`)
    await new Promise<void>((resolve) => setImmediate(resolve))
  }

  it('retries a GET once on a new connection after a reused socket resets before the response', async () => {
    await warmConnection()
    let attempts = 0
    handleRequest = (request, response) => {
      if (++attempts === 1) return request.socket.destroy()
      response.writeHead(200, { 'Content-Type': 'text/html' })
      response.end('<html><title>page</title></html>')
    }
    const result = await fetchUrl(`${origin}/travels/demo`)
    expect(result).toMatchObject({ status: 200, url: `${origin}/travels/demo` })
    expect(result.body).toContain('<title>page</title>')
    expect(attempts).toBe(2)
    expect(seen[1].socket).toBe(seen[0].socket)
    expect(seen[2].socket).not.toBe(seen[0].socket)
  })

  it('does not retry a reset on a fresh connection or a second reset', async () => {
    handleRequest = (request) => request.socket.destroy()
    await expect(fetchUrl(`${origin}/fresh`)).rejects.toMatchObject({ code: 'ECONNRESET' })
    expect(seen).toHaveLength(1)

    seen.length = 0
    handleRequest = undefined
    await warmConnection()
    handleRequest = (request) => request.socket.destroy()
    await expect(fetchUrl(`${origin}/twice`)).rejects.toMatchObject({ code: 'ECONNRESET' })
    expect(seen.filter((request) => request.path === '/twice')).toHaveLength(2)
  })

  it('does not turn a timeout on a reused socket into a retry', async () => {
    await warmConnection()
    const realGet = http.get
    const getSpy = jest.spyOn(http, 'get').mockImplementation((...args: unknown[]) => {
      const [target, options, callback] = args as [string, Record<string, unknown>, () => void]
      return realGet.call(http, target, { ...options, timeout: 100 }, callback)
    })
    try {
      handleRequest = () => {}
      await expect(fetchUrl(`${origin}/slow`)).rejects.toThrow(`Timeout: ${origin}/slow`)
      await new Promise((resolve) => setTimeout(resolve, 150))
      expect(seen.filter((request) => request.path === '/slow')).toHaveLength(1)
      expect(getSpy).toHaveBeenCalledTimes(1)
    } finally {
      getSpy.mockRestore()
    }
  })

  it('returns an HTTP error status once without retrying it', async () => {
    await warmConnection()
    handleRequest = (_request, response) => {
      response.writeHead(503, { 'Content-Type': 'text/plain' })
      response.end('unavailable')
    }
    await expect(fetchUrl(`${origin}/down`)).resolves.toMatchObject({ status: 503 })
    expect(seen.filter((request) => request.path === '/down')).toHaveLength(1)
  })
})
