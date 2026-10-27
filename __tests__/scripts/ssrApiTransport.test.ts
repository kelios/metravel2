/** @jest-environment node */
const http = require('node:http')
const { ssrApiRequest, installSsrApiTransport, SSR_API_TRANSPORT } = require('@/scripts/lib/ssrApiTransport')

describe('SSR internal API transport', () => {
  let server: import('node:http').Server
  let origin = ''
  const seen: Array<{ host?: string; forwarded?: string }> = []

  beforeAll(async () => {
    server = http.createServer((request: import('node:http').IncomingMessage, response: import('node:http').ServerResponse) => {
      seen.push({ host: request.headers.host, forwarded: request.headers['x-forwarded-proto'] as string | undefined })
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

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve))
    delete (globalThis as unknown as Record<symbol, unknown>)[SSR_API_TRANSPORT]
  })

  // Node fetch replaces a custom Host with the connection target; Django then
  // rejects the internal request as DisallowedHost.
  it('delivers the public Host header to the internal origin', async () => {
    const response = await ssrApiRequest(`${origin}/api/travels/by-slug/demo/`, {
      headers: { Accept: 'application/json', Host: 'metravel.by', 'X-Forwarded-Proto': 'https' },
      signal: new AbortController().signal,
    })
    expect(response.ok).toBe(true)
    await expect(response.json()).resolves.toEqual({ slug: 'demo' })
    expect(seen.at(-1)).toEqual({ host: 'metravel.by', forwarded: 'https' })
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
})
