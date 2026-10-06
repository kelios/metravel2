/** @jest-environment node */
import { PRINT_RESOURCE_TIMEOUT_MS, preflightPrintResources } from '@/utils/printResourcePreflight'

type FetchInit = { method?: string; signal: AbortSignal }
const hang = () => new Promise<Response>(() => {})
const image = (bytes = [1, 2, 3]) => ({
  ok: true,
  headers: { get: (name: string) => name === 'content-type' ? 'image/jpeg' : null },
  arrayBuffer: async () => new Uint8Array(bytes).buffer,
}) as Response
const images = (origin: string, count: number) =>
  Array.from({ length: count }, (_, i) => `<img src="${origin}/p${i}.jpg" alt="">`).join('')
const options = (fetchImpl: unknown, deadline = 120_000, signal?: AbortSignal) => ({
  deadlineAt: Date.now() + deadline, fetchImpl: fetchImpl as typeof fetch, signal,
})

describe('preflightPrintResources', () => {
  beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(new Date('2026-10-06T12:00:00Z')) })
  afterEach(() => jest.useRealTimers())

  it('keeps content and links, adds a network-denying policy; inline images need no fetch', async () => {
    const fetchImpl = jest.fn()
    const html = '<p>x</p><img src="data:image/png;base64,AAA"><a href="https://metravel.by">metravel</a>'
    const result = await preflightPrintResources(html, options(fetchImpl))
    expect(result).toEqual(expect.objectContaining({ skippedImages: 0, aborted: false }))
    expect(result.html).toContain(html)
    expect(result.html).toContain('data-print-resource-policy')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('does one bounded GET including body, embeds exact bytes; WKWebView never refetches the URL', async () => {
    const fetchImpl = jest.fn(async () => image())
    const result = await preflightPrintResources('<img src="https://cdn.example/a.jpg?w=1&amp;q=2">', options(fetchImpl))
    expect(fetchImpl).toHaveBeenCalledWith('https://cdn.example/a.jpg?w=1&q=2', expect.objectContaining({ method: 'GET' }))
    expect(result.html).toContain('src="data:image/jpeg;base64,AQID"')
    expect(result.html).not.toContain('cdn.example')
    expect(result.skippedImages).toBe(0)
  })

  it('a dead origin is skipped after one resource window, even when fetch ignores abort', async () => {
    const fetchImpl = jest.fn((url: string) => url.startsWith('https://dead.example') ? hang() : Promise.resolve(image()))
    const result = preflightPrintResources(images('https://dead.example', 20) + '<img src="https://ok.example/a.jpg">', options(fetchImpl))
    await jest.advanceTimersByTimeAsync(PRINT_RESOURCE_TIMEOUT_MS)
    const out = await result
    expect(out.skippedImages).toBe(20)
    expect(out.html).not.toContain('dead.example')
    expect(out.html).toContain('src="data:image/jpeg;base64,AQID"')
    expect(fetchImpl.mock.calls.filter(([url]) => url.startsWith('https://dead.example')).length).toBeLessThanOrEqual(6)
  })

  it('body timeout is bounded even after successful headers, preserving other images on that origin', async () => {
    const fetchImpl = jest.fn(async (url: string) => url.endsWith('/slow.jpg')
      ? { ...image(), arrayBuffer: hang }
      : image([255, 216]))
    const pending = preflightPrintResources('<img src="https://cdn.example/slow.jpg"><img src="https://cdn.example/ok.jpg">', options(fetchImpl))
    await jest.advanceTimersByTimeAsync(PRINT_RESOURCE_TIMEOUT_MS)
    const result = await pending
    expect(result.skippedImages).toBe(1)
    expect(result.html).toContain('data:image/jpeg;base64,/9g=')
    expect(result.html).not.toContain('cdn.example')
  })

  it('the absolute document deadline bounds every worker', async () => {
    const pending = preflightPrintResources(images('https://slow.example', 9), options(hang, 5_000))
    await jest.advanceTimersByTimeAsync(5_000)
    await expect(pending).resolves.toEqual(expect.objectContaining({ skippedImages: 9, aborted: false }))
  })

  it.each([
    { ...image(), ok: false },
    { ...image(), headers: { get: () => 'text/html' } },
    image([]),
  ])('HTTP failure, non-image or empty bytes produce a placeholder', async (response) => {
    const result = await preflightPrintResources('<img src="https://cdn.example/missing.jpg">', options(async () => response))
    expect(result.skippedImages).toBe(1)
    expect(result.html).toContain('src="data:image/gif;base64,')
    expect(result.html).not.toContain('cdn.example')
  })

  it('removes stylesheets/imports/frames/scripts and srcset; handles CSS, unquoted and SVG image resources', async () => {
    const fetchImpl = jest.fn(async () => image())
    const html = '<head><link rel="stylesheet" href="https://fonts.example/style.css">' +
      '<style>@import "https://fonts.example/other.css"; div {background:url(//cdn.example/bg.jpg)}</style></head>' +
      '<body><img src=https://cdn.example/a.jpg srcset="https://cdn.example/large.jpg 2x">' +
      '<svg><image href="https://cdn.example/svg.jpg"></image></svg>' +
      '<iframe src="https://frame.example"></iframe><script src="https://script.example"></script></body>'
    const result = await preflightPrintResources(html, options(fetchImpl))
    expect(fetchImpl.mock.calls.map(([url]) => url).sort()).toEqual([
      'https://cdn.example/a.jpg', 'https://cdn.example/bg.jpg', 'https://cdn.example/svg.jpg',
    ])
    expect(result.html).not.toMatch(/(?:fonts|cdn|frame|script)\.example/)
    expect(result.html).not.toContain('@import')
    expect(result.html).not.toContain('<script')
    expect(result.html).toContain('srcset=""')
  })

  it('cancel resolves immediately even if the request never observes AbortSignal; late body cannot change output', async () => {
    const controller = new AbortController()
    const fetchImpl = jest.fn((_url: string, _init: FetchInit) => hang())
    const html = images('https://dead.example', 3)
    const pending = preflightPrintResources(html, options(fetchImpl, 120_000, controller.signal))
    controller.abort()
    await expect(pending).resolves.toEqual({ html, skippedImages: 0, aborted: true })
  })
})
