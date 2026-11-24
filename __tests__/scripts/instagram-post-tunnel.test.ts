/**
 * @jest-environment node
 */
// #3483: slides reach Instagram through the temporary tunnel, not the site. The ssh tunnel is
// stubbed; Meta's fetcher is played by the test against the real local server behind it.
const { EventEmitter } = require('events')
const fs = require('fs')
const http = require('http')
const path = require('path')
const { makeTempDir } = require('./cli-test-utils')

jest.mock('child_process', () => ({ ...jest.requireActual('child_process'), spawn: jest.fn() }))

const { spawn } = require('child_process')
const { createImageContainers } = require('../../scripts/instagram-post')

const ORIGIN = 'https://fixture.a.pinggy.link'

describe('instagram-post image tunnel', () => {
  const dir = makeTempDir('ig-tunnel-')
  const originalFetch = global.fetch
  let port: number
  let ssh: any

  beforeEach(() => {
    spawn.mockImplementation((_cmd: string, argv: string[]) => {
      port = Number(/127\.0\.0\.1:(\d+)$/.exec(argv.find((a) => a.startsWith('-R0:')) || '')![1])
      ssh = Object.assign(new EventEmitter(), { stdout: new EventEmitter(), stderr: new EventEmitter(), kill: jest.fn() })
      setImmediate(() => ssh.stdout.emit('data', `Forwarding ${ORIGIN}\n`))
      return ssh
    })
  })
  afterEach(() => {
    global.fetch = originalFetch
    spawn.mockReset()
  })
  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }))

  const local = (url: string) => url.replace(ORIGIN, `http://127.0.0.1:${port}`)

  /** Meta's fetcher, over plain http: the jest fetch polyfill cannot reach a local server. */
  function request(url: string, { method = 'GET', headers = {} }: { method?: string; headers?: Record<string, string> } = {}) {
    return new Promise<{ ok: boolean; status: number; headers: { get: (name: string) => string | null }; text: string }>((resolve, reject) => {
      const req = http.request(local(url), { method, headers, agent: false }, (res: any) => {
        let text = ''
        res.setEncoding('utf8')
        res.on('data', (chunk: string) => (text += chunk))
        res.on('end', () =>
          resolve({ ok: res.statusCode < 300, status: res.statusCode, headers: { get: (name) => res.headers[name.toLowerCase()] ?? null }, text })
        )
      })
      req.on('error', reject)
      req.end()
    })
  }

  function stubNetwork(onMedia: (params: URLSearchParams) => Promise<object>) {
    global.fetch = jest.fn(async (url: string, init: RequestInit = {}) => {
      if (url.startsWith(ORIGIN)) return request(url, { method: init.method }) as unknown as Response
      if (init.method === 'POST' && /\/media$/.test(url)) {
        const body = await onMedia(new URLSearchParams(String(init.body)))
        return { ok: !('error' in body), status: 'error' in body ? 400 : 200, json: async () => body } as Response
      }
      return { ok: true, status: 200, json: async () => ({ status_code: 'FINISHED' }) } as Response
    }) as typeof fetch
  }

  it('serves every slide with its media type and byte ranges, then closes the tunnel', async () => {
    const files = ['01.jpg', '02.png'].map((name, i) => {
      const file = path.join(dir, name)
      fs.writeFileSync(file, `slide-${i + 1}-bytes`)
      return file
    })
    const seen: string[] = []
    const posts: URLSearchParams[] = []
    stubNetwork(async (params) => {
      posts.push(params)
      if (params.get('image_url')) {
        const url = params.get('image_url')!
        const res = await request(url)
        seen.push(`${res.headers.get('content-type')} ${res.text}`)
        const part = await request(url, { headers: { Range: 'bytes=0-4' } })
        expect(part.status).toBe(206)
        expect(part.text).toBe('slide')
        expect((await request(`${ORIGIN}/other.jpg`)).status).toBe(404)
      }
      return { id: `c${posts.length}` }
    })

    await expect(createImageContainers(files, 'caption', { token: 't', igUserId: '42' })).resolves.toBe('c3')
    expect(seen).toEqual(['image/jpeg slide-1-bytes', 'image/png slide-2-bytes'])
    expect(posts.slice(0, 2).every((p) => p.get('is_carousel_item') === 'true' && !p.get('caption'))).toBe(true)
    expect(posts[2].get('children')).toBe('c1,c2')
    expect(posts[2].get('caption')).toBe('caption')
    expect(ssh.kill).toHaveBeenCalledTimes(1)
    await expect(request(`${ORIGIN}/`)).rejects.toThrow('ECONNREFUSED')
    expect((global.fetch as jest.Mock).mock.calls.some(([url]) => /metravel\.by/.test(String(url)))).toBe(false)
  })

  it('closes the tunnel when a slide fails and puts the caption on a single image', async () => {
    const files = ['01.jpg', '02.jpg'].map((name) => {
      const file = path.join(dir, `fail-${name}`)
      fs.writeFileSync(file, 'x')
      return file
    })
    let calls = 0
    stubNetwork(async () => (++calls === 2 ? { error: { message: 'Only photo or video can be accepted' } } : { id: 'c1' }))
    await expect(createImageContainers(files, 'caption', { token: 't', igUserId: '42' })).rejects.toThrow('Graph API 400')
    expect(ssh.kill).toHaveBeenCalledTimes(1)

    const single: URLSearchParams[] = []
    stubNetwork(async (params) => (single.push(params), { id: 'only' }))
    await expect(createImageContainers([files[0]], 'caption', { token: 't', igUserId: '42' })).resolves.toBe('only')
    expect(single).toHaveLength(1)
    expect(single[0].get('caption')).toBe('caption')
    expect(single[0].get('is_carousel_item')).toBeNull()
    expect(ssh.kill).toHaveBeenCalledTimes(1)
  })
})
